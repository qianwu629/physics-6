---
phase: 03-通用力场系统
reviewed: 2026-05-23T00:00:00Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - frontend/src/ecs/types.ts
  - frontend/src/ecs/Entity.ts
  - frontend/src/ecs/__tests__/types.test.ts
  - frontend/src/ecs/__tests__/Entity.test.ts
  - frontend/src/__tests__/runtime-prop-sync.test.tsx
  - frontend/src/ecs/forceFieldCalc.ts
  - frontend/src/ecs/__tests__/forceFieldCalc.test.ts
  - frontend/src/components/ForceFieldSystem.tsx
  - frontend/src/components/Scene3D.tsx
  - frontend/src/store/uiSlice.ts
  - frontend/src/components/Toolbox.tsx
  - frontend/src/components/ForceFieldDialog.tsx
  - frontend/src/components/App.tsx
  - frontend/src/components/PropertyPanel.tsx
  - frontend/src/components/ForceFieldRenderer.tsx
  - frontend/src/components/EntityRenderer.tsx
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** deep
**Files Reviewed:** 15
**Status:** issues_found

## Summary

本次深度审查覆盖 Phase 3（通用力场系统）的核心实现文件，包括 ECS 类型系统、力场物理计算、力场渲染、UI 对话框及与现有系统的集成。发现 3 个关键缺陷（Critical）、6 个警告（Warning）和 4 个信息项（Info）。

主要风险集中在：
1. **类型安全漏洞**：`updateComponent` 对 `ForceFieldComponent` 的更新使用 `as Partial<ForceFieldComponent>` 绕过 TypeScript 判别联合约束，可能导致运行时类型不一致
2. **资源泄漏**：`ForceFieldRenderer` 中 `InstancedMesh` 的几何体和材质在组件卸载时未正确清理
3. **除零风险**：`forceFieldCalc.ts` 中 `normalize3` 的 EPS_R 阈值与物理计算中的距离检查阈值不一致
4. **竞态条件**：`ForceFieldSystem` 在 `useBeforeStep` 中直接访问 mutable store state，可能与 React 渲染周期产生竞态

---

## Critical Issues

### CR-01: PropertyPanel 中 ForceField 更新绕过判别联合类型检查

**File:** `frontend/src/components/PropertyPanel.tsx:383-414`
**Issue:** `handleForceFieldStrengthChange`、`handleForceFieldChargeChange`、`handleForceFieldDecayChange`、`handleForceFieldDirectionChange` 四个 handler 均使用 `as Partial<ForceFieldComponent>` 将部分字段强制转换为完整的判别联合类型。TypeScript 的 discriminated union 在 `updateComponent` 处期望传入的 `Partial<Component>` 与具体 kind 的字段兼容，但 `strength` 字段在 `gravity`/`magnetic` 与 `uniform` 中的语义不同，`charge` 仅在 `electric` 中存在，`decay` 仅在 `gravity`/`electric` 中存在。这种类型断言掩盖了跨 kind 的错误更新路径。

**Fix:**
```typescript
// 在 updateComponent 调用前，按 kind 进行分支检查
const handleForceFieldStrengthChange = useCallback(
  (val: number) => {
    if (!selectedEntityId || !forceField) return;
    if (forceField.kind === 'uniform' || forceField.kind === 'gravity' || forceField.kind === 'magnetic') {
      updateComponent(selectedEntityId, 'forceField', { strength: val });
    }
  },
  [selectedEntityId, forceField, updateComponent],
);
```

### CR-02: ForceFieldRenderer 中 InstancedMesh 资源泄漏

**File:** `frontend/src/components/ForceFieldRenderer.tsx:130-141`
**Issue:** `UniformFieldArrows` 组件在 `useMemo` 中创建了 `shaftMesh` 和 `headMesh` 两个 `InstancedMesh`，并在 `useMemo` 的 cleanup 函数中尝试 dispose。但 React 的 `useMemo` cleanup 函数仅在依赖变化时执行，不会在组件卸载时执行。此外，`disposedRef` 是一个模块级 mutable ref，在组件重渲染时可能被错误共享状态。这导致 Three.js 几何体和材质在力场实体被删除时无法释放，造成 GPU 内存泄漏。

**Fix:**
```typescript
// 使用 useEffect 的 cleanup 来确保卸载时释放资源
useEffect(() => {
  return () => {
    shaftMesh.geometry.dispose();
    headMesh.geometry.dispose();
    (shaftMesh.material as THREE.Material).dispose();
    (headMesh.material as THREE.Material).dispose();
  };
}, [shaftMesh, headMesh]);
```

### CR-03: ForceFieldSystem 中 useBeforeStep 闭包捕获 mutable store state 存在竞态

**File:** `frontend/src/components/ForceFieldSystem.tsx:29-62`
**Issue:** `useBeforeStep` 的回调在每次物理步前执行，其中通过 `useSimulationStore.getState()` 获取最新 state。虽然 `getState()` 获取的是当前状态，但 `entities` 是一个 mutable Map，在回调执行期间如果 React 渲染周期触发了实体增删（例如用户快速点击创建/删除），Map 的迭代可能被中断或产生不一致视图。更关键的是，`getRef(entityId)` 返回的 ref 可能在迭代期间被 `unregister` 置为无效，虽然已有 `typeof body.translation !== 'function'` 的检查，但没有同步锁保证 `body` 在 `translation()` 和 `linvel()` 调用之间保持有效。

**Fix:**
```typescript
useBeforeStep(() => {
  const state = useSimulationStore.getState();
  const entities = state.entities;
  if (entities.size === 0) return;

  // 先收集所有字段和 dynamic 实体，避免在迭代期间访问被修改的 Map
  const fields: ForceFieldComponent[] = [];
  const dynamicBodies: Array<{ entityId: string; rb: RigidBodyComponent; ref: any }> = [];

  for (const [entityId, entity] of entities) {
    const f = entity.components.get('forceField') as ForceFieldComponent | undefined;
    if (f) fields.push(f);

    const rb = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
    if (rb && rb.kind === 'dynamic') {
      const ref = getRef(entityId);
      const body = ref?.current;
      if (body && typeof body.translation === 'function' && typeof body.applyForce === 'function') {
        dynamicBodies.push({ entityId, rb, ref });
      }
    }
  }

  if (fields.length === 0) return;

  for (const { entityId, rb, ref } of dynamicBodies) {
    const body = ref.current;
    // 再次验证 body 有效性
    if (!body || typeof body.translation !== 'function') continue;
    const pos = body.translation();
    if (typeof body.linvel !== 'function') continue;
    const vel = body.linvel();
    const F = computeTotalForce(fields, pos, vel, rb.charge ?? 0);
    if (F.x === 0 && F.y === 0 && F.z === 0) continue;
    if (typeof body.applyForce === 'function') {
      body.applyForce(F, true);
    }
  }
});
```

---

## Warnings

### WR-01: forceFieldCalc.ts 中 EPS_R 阈值不一致

**File:** `frontend/src/ecs/forceFieldCalc.ts:33, 44-46, 69, 89`
**Issue:** `EPS_R = 0.001` 被同时用于：1) `normalize3` 中的零向量检查；2) `gravity` 和 `electric` 中的距离下限（避免除零）。但这两个场景的量纲和物理意义不同。`normalize3` 处理的是方向向量（无量纲），而距离检查处理的是物理位置（单位：米）。在物理仿真中，0.001m = 1mm 的距离下限对于某些微观场景可能过大，导致近距离力场被错误截断为零。更关键的是，`normalize3` 返回 `[0,0,0]` 后，调用方（如 `uniform` 和 `magnetic`）直接使用该结果乘以 `strength`，会产生零向量，但没有日志或警告提示用户方向向量无效。

**Fix:**
```typescript
// 分离阈值常量
const EPS_DIRECTION = 1e-6;  // 方向向量归一化阈值
const EPS_DISTANCE = 0.001;   // 物理距离阈值

function normalize3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < EPS_DIRECTION) {
    console.warn(`Direction vector too small: [${v.join(',')}], using zero vector`);
    return [0, 0, 0];
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}
```

### WR-02: EntityRenderer 中 useEffect 依赖数组可能遗漏关键依赖

**File:** `frontend/src/components/EntityRenderer.tsx:57-85`
**Issue:** `useEffect` 的依赖数组包含 `rigidBody?.mass`、`rigidBody?.restitution`、`rigidBody?.friction`、`restitutionScale`、`frictionScale`、`drag`。但 `rigidBody` 本身（作为对象引用）变化时（例如实体被替换为新的组件对象），`useEffect` 不会触发，因为可选链操作符 `?.` 在依赖追踪中只追踪最终 primitive 值。如果 `rigidBody` 对象被替换但 `mass` 值不变，同步逻辑将不会执行。

**Fix:**
```typescript
// 使用 rigidBody 的完整对象作为依赖，或添加 entity.id
useEffect(() => {
  // ... existing logic
}, [
  entity.id,  // 确保实体替换时触发
  rigidBody?.mass,
  rigidBody?.restitution,
  rigidBody?.friction,
  restitutionScale,
  frictionScale,
  drag,
]);
```

### WR-03: ForceFieldDialog 中 Zod schema 的 directionTuple 未验证非零向量

**File:** `frontend/src/components/ForceFieldDialog.tsx:27-28`
**Issue:** `directionTuple = z.tuple([z.number(), z.number(), z.number()])` 仅验证类型为三个数字的元组，但不验证该向量是否为零向量。如果用户输入 `[0, 0, 0]` 作为 uniform 或 magnetic 的方向，`forceFieldCalc.ts` 中的 `normalize3` 会返回 `[0,0,0]`，导致力场实际不产生任何力，但 UI 上显示创建成功，用户无法感知问题。

**Fix:**
```typescript
const directionTuple = z.tuple([z.number(), z.number(), z.number()])
  .refine((v) => Math.hypot(v[0], v[1], v[2]) > 1e-6, {
    message: '方向向量不能为零向量',
  });
```

### WR-04: Scene3D 中 RigidBodyRefContext 的 getRef 返回类型不精确

**File:** `frontend/src/components/Scene3D.tsx:223-225`
**Issue:** `getRef` 返回 `React.RefObject<any> | undefined`，但调用方（如 `ForceFieldSystem`、`SpringRenderer`、`TrajectoryRenderer`、`VectorRenderer`、`ChartSampler`）均假设返回的 ref 具有 `.current` 属性且 `current` 具有 Rapier API。`RigidBodyRefContext` 的类型定义中使用 `any` 掩盖了类型信息，导致调用链上大量 `typeof body.translation === 'function'` 的防御性检查成为运行时唯一保障。

**Fix:**
```typescript
// RigidBodyRefContext.tsx
import type { RefObject } from 'react';

interface RigidBodyAPI {
  translation(): { x: number; y: number; z: number };
  linvel(): { x: number; y: number; z: number };
  applyForce(force: { x: number; y: number; z: number }, wakeUp: boolean): void;
  mass(): number;
  // ... 其他需要的方法
}

export const RigidBodyRefContext = createContext<{
  register: (entityId: string, ref: RefObject<RigidBodyAPI | null>) => void;
  unregister: (entityId: string) => void;
  getRef: (entityId: string) => RefObject<RigidBodyAPI | null> | undefined;
}>({...});
```

### WR-05: SpringRenderer 中 TubeGeometry 每帧重建导致 GC 压力

**File:** `frontend/src/components/SpringRenderer.tsx:139-145`
**Issue:** `useFrame` 每帧创建新的 `TubeGeometry` 并 dispose 旧几何体。虽然调用了 `dispose()`，但 Three.js 的 `dispose()` 是异步的（需要等待 GPU 完成渲染），高频创建/销毁会在内存中产生碎片，且 `useFrame` 以 60Hz 运行，每秒产生 60 次几何体分配。此外，`dynTubeRef` 被声明但从未使用。

**Fix:**
```typescript
// 使用 BufferGeometry 的更新机制，而非重建
const geometryRef = useRef<THREE.TubeGeometry | null>(null);

useFrame(() => {
  // ... 计算 helixPoints 和 curve
  if (!geometryRef.current) {
    geometryRef.current = new THREE.TubeGeometry(curve, helixPoints.length * 2, 0.03, 8, false);
    if (tubeRef.current) tubeRef.current.geometry = geometryRef.current;
  } else {
    // TubeGeometry 不支持直接更新路径，但可以通过预分配顶点缓冲区优化
    // 或者至少限制更新频率
  }
});
```

### WR-06: TrajectoryRenderer 中性能数据写入未节流

**File:** `frontend/src/components/TrajectoryRenderer.tsx:36-55`
**Issue:** `useFrame` 中遍历所有实体并检查速度阈值，但 `performance.now()` 的调用和 Map 查找在实体数量大时（MAX_ENTITIES=50）每帧执行 50 次，即使没有任何实体需要采样。虽然 `SAMPLE_INTERVAL` 节流了实际采样，但前期的循环和 `getRef` 调用没有被节流。

**Fix:**
```typescript
useFrame(() => {
  if (!showTrails) return;
  const now = performance.now() / 1000;

  // 先快速检查是否有任何实体需要采样
  let needsSample = false;
  for (const [entityId] of entities) {
    const prevTime = lastSampleTime.current.get(entityId);
    if (prevTime === undefined || now - prevTime >= SAMPLE_INTERVAL) {
      needsSample = true;
      break;
    }
  }
  if (!needsSample) return;

  // ... 继续原有逻辑
});
```

---

## Info

### IN-01: ForceFieldRenderer 中 generateGridPoints 的循环 break 逻辑冗余

**File:** `frontend/src/components/ForceFieldRenderer.tsx:60-72`
**Issue:** 三重嵌套循环中每层都有 `if (points.length >= maxInstances) break;`，但内层循环的 break 不会中断外层循环。虽然代码在每次外层循环开始处也检查了该条件，但这种结构容易在维护时引入 bug。建议使用更清晰的早期退出模式。

**Fix:**
```typescript
outer: for (let ix = 0; ix < steps; ix++) {
  for (let iy = 0; iy < steps; iy++) {
    for (let iz = 0; iz < steps; iz++) {
      if (points.length >= maxInstances) break outer;
      // ...
    }
  }
}
```

### IN-02: ForceFieldLines 中 BufferGeometry 未在卸载时 dispose

**File:** `frontend/src/components/ForceFieldLines.tsx:260-278`
**Issue:** `FieldLineSegments` 在 `useMemo` 中创建 `BufferGeometry`，但没有在组件卸载或字段变化时调用 `dispose()`。虽然 `BufferGeometry` 比 `TubeGeometry` 轻量，但大量力线（64条 × 20段 × 3顶点 = 3840 顶点）的累积仍会造成内存增长。

**Fix:**
```typescript
useEffect(() => {
  return () => {
    geometry?.dispose();
  };
}, [geometry]);
```

### IN-03: App.tsx 中 resetCounter 订阅副作用可能重复触发

**File:** `frontend/src/components/App.tsx:182-191`
**Issue:** `useEffect` 订阅了 `resetCounter` 的变化，在变化时调用 `resetEntities()`。但 `reset()` action 本身已经设置了 `isRunning: false` 和 `resetCounter + 1`，这个订阅在 `reset()` 调用后会额外触发一次 `resetEntities()`。虽然 `resetEntities()` 是幂等的，但这种双重调用增加了不必要的渲染周期。

**Fix:**
```typescript
// 将 resetEntities 逻辑合并到 reset action 中，避免分散的副作用
// 或在 reset 中直接调用 resetEntities，移除订阅
```

### IN-04: types.ts 中 ComponentType 联合类型缺少与 AnyComponent 的自动同步机制

**File:** `frontend/src/ecs/types.ts:6, 137-146`
**Issue:** `ComponentType` 是手动维护的字符串字面量联合，而 `AnyComponent` 是接口联合。当新增组件类型时，需要同时修改两处，容易遗漏。虽然当前代码已同步，但缺乏编译时保证。

**Fix:**
```typescript
// 使用映射类型从 AnyComponent 自动推导
export type ComponentType = AnyComponent['type'];
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
