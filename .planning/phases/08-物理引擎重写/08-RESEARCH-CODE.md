# Phase 8 代码层技术调研：Rapier WASM API 精确行为与集成改造

**项目**: Physis - Web 端交互物理模拟平台
**调研日期**: 2026/05/31
**调研范围**: Rapier3D WASM + @react-three/rapier 的 API 精确行为、电磁场注入实现模式、性能瓶颈、与现有代码集成点
**约束**: 纯调研，不修改源代码；聚焦代码实现层，不重复架构级结论

---

## 1. Rapier WASM API 精确行为

### 1.1 `body.addForce(force, wakeUp)` 是持续力还是瞬时力？

**发现**: `addForce` 施加的力是**持续力（persistent force）**，会累积到刚体的内部力缓冲区中，在后续的物理步积分阶段持续作用。

**关键事实**（来自 [Rapier 官方文档](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)）：
- "Added forces are persistent across simulation steps, and can be cleared manually."
- 力在物理步内的积分公式：`velocity += (force / mass) * dt`
- 调用 `addForce` 后**不会自动清零**，需要显式调用 `body.resetForces(true)` 清除

**代码示例（当前代码的问题）**:

```tsx
// ForceFieldSystem.tsx 当前实现（第 126-129 行）
if (F.x !== 0 || F.y !== 0 || F.z !== 0) {
  if (typeof body.addForce === 'function') {
    body.addForce(F, true);
  }
}
```

**风险**: 上述代码每帧调用 `addForce`，但**没有先调用 `resetForces`**。如果 Rapier 的力在步间不清零，力会无限累积。然而观察 Physics.tsx 源码（第 580-590 行），`useBeforePhysicsStep` 回调在 `world.step()` 之前执行，而 Rapier 的力缓冲区在 `world.step()` 内部被读取后**是否清零取决于版本**。v0.8.0+ 后力不再自动清零。

**推荐做法**:
```tsx
// 安全的力注入模式
body.resetForces(true);  // 先清零
body.addForce(F, true);  // 再施加新力
```

或改用 `applyImpulse`（一次性冲量，不累积）：
```tsx
// 如果每帧重新计算完整力，用 impulse 更精确
const impulse = { x: F.x * dt, y: F.y * dt, z: F.z * dt };
body.applyImpulse(impulse, true);
```

**注意事项**:
- `addForce` 适合"力持续作用多帧"的场景（如重力、恒定电场）
- 如果每帧重新计算力，推荐 `resetForces + addForce` 或直接用 `applyImpulse`
- `wakeUp=true` 确保休眠体被唤醒，但频繁唤醒会影响性能

---

### 1.2 `useBeforePhysicsStep` 中调用 `body.setLinvel()` 是否会与 Rapier 内部积分器冲突？

**发现**: `setLinvel` **直接覆盖速度**，绕过 Rapier 的速度积分器。这会导致以下问题：

1. **与积分器冲突**: Rapier 的积分流程是：
   ```
   1. 读取 accumulated forces → 计算加速度
   2. 显式欧拉积分: v_new = v_old + a * dt
   3. 位置积分: p_new = p_old + v_new * dt
   ```
   在 `useBeforePhysicsStep` 中调用 `setLinvel` 后，Rapier 在步骤 2 中会**覆盖**你设置的速度（如果步骤 1 中有累积力）。

2. **当前代码的时序问题**（ForceFieldSystem.tsx 第 132-145 行）：
   ```tsx
   body.addForce(F, true);           // 力累积到缓冲区
   // ...
   body.setLinvel(newVel, true);     // 直接设速度
   ```
   如果 `addForce` 的力非零，Rapier 在 `world.step()` 时会用 `F/m * dt` 修改速度，**覆盖** `setLinvel` 的结果。

**物理正确性边界条件**:
- 磁场力必须**单独处理**，不能与 `addForce` 混用（当前代码已正确分离）
- `setLinvel` 应在**无其他力作用**的刚体上使用，或确保 `resetForces` 已清空其他力
- 对于同时受电场力和磁场力的带电体，应：
  1. 用电场力通过 `applyImpulse` 改变速度
  2. 用 Rodriguez 旋转处理磁场
  3. 合并两个速度变化后一次性 `setLinvel`

**推荐做法**:
```tsx
// 合并电场和磁场对速度的影响
const F_electric = computeNonMagneticForce(fields, pos, charge);
const dt = getTimeStep(); // 从 World 读取

// 电场产生的速度变化（显式欧拉）
const dv_electric = {
  x: (F_electric.x / mass) * dt,
  y: (F_electric.y / mass) * dt,
  z: (F_electric.z / mass) * dt,
};

// 磁场产生的速度变化（Rodriguez 旋转）
const vel_after_electric = {
  x: vel.x + dv_electric.x,
  y: vel.y + dv_electric.y,
  z: vel.z + dv_electric.z,
};
const vel_after_magnetic = rotateVelocityByMagneticField(
  vel_after_electric, bodyB, charge, mass, dt
);

// 一次性设置最终速度
body.setLinvel(vel_after_magnetic, true);
```

---

### 1.3 Rapier 的 `timeStep` 与 `useBeforePhysicsStep` 的调用频率关系

**发现**: 调用频率取决于 `Physics` 组件的 `updateLoop` 和 `timeStep` 配置。

**Physics.tsx 源码分析**（第 580-620 行）:

```tsx
// 固定 timestep 模式（当前 Scene3D 使用 timeStep={1/120}）
if (timeStepVariable) {
  stepWorld(clampedDelta);  // 每渲染帧一步，dt = 帧间隔
} else {
  steppingState.accumulator += clampedDelta;
  while (steppingState.accumulator >= timeStep) {
    // 保存插值状态
    if (interpolate) {
      steppingState.previousState = {};
      world.forEachRigidBody((body) => {
        steppingState.previousState[body.handle] = {
          position: body.translation(),
          rotation: body.rotation()
        };
      });
    }
    stepWorld(timeStep);      // 固定 dt = timeStep
    steppingState.accumulator -= timeStep;
  }
}
```

**关键事实**:
- `updateLoop="follow"`（默认）: 物理在 `useFrame` 回调中执行，与渲染帧同步
- 当渲染帧率 < 物理步进频率时（如 30fps 渲染 + 120Hz 物理），**`useBeforePhysicsStep` 会在同一渲染帧中被调用多次**（通过 `while` 循环）
- 每次 `stepWorld` 都会触发所有 `beforeStepCallbacks`

**代码示例**:
```tsx
// Scene3D.tsx 当前配置
<Physics timeStep={1 / 120} paused={!isRunning} interpolate={true}>
```

如果显示器刷新率是 60Hz，每帧渲染间隔 ~16.67ms：
```
accumulator += 0.01667
while (accumulator >= 0.00833) {
  stepWorld(0.00833);  // 第一次
  accumulator -= 0.00833;  // accumulator = 0.00834
}
// accumulator = 0.00834 < 0.00833? 否，继续
while (accumulator >= 0.00833) {
  stepWorld(0.00833);  // 第二次
  accumulator -= 0.00833;  // accumulator = 0.00001
}
```

**结果**: 60fps 渲染时，每帧调用 2 次 `useBeforePhysicsStep`，每次 `dt = 1/120`。

**风险**: `useBeforePhysicsStep` 回调**不接收 dt 参数**，无法知道当前是第几次子步进。如果回调内部依赖"每帧一次"的假设（如计数器、历史记录），会出错。

**推荐做法**:
```tsx
// 在回调内部通过 World 读取 timestep
useBeforeStep(() => {
  const { world } = useRapier();  // 需要导入 useRapier
  const dt = world.timestep;      // 当前物理步的实际 dt
  // 使用 dt 而非硬编码 DT
});
```

---

### 1.4 如何正确获取 World 的 timeStep 配置（避免硬编码 DT）

**发现**: 可通过 `useRapier()` hook 获取 `world` 实例，进而读取 `world.timestep`。

**当前代码问题**（ForceFieldSystem.tsx 第 28 行）:
```tsx
const DT = 1 / 120;  // 硬编码，与 Scene3D.tsx 中 Physics timeStep 保持一致
```

**风险**: 如果 Scene3D 的 `timeStep` 改变，ForceFieldSystem 的 DT 不会同步，导致磁场旋转角度错误。

**推荐做法**:
```tsx
import { useRapier } from '@react-three/rapier';

export function ForceFieldSystem() {
  const { getRef } = useRigidBodyRefRegistry();
  const { world } = useRapier();  // 获取 World 实例
  
  useBeforeStep(() => {
    const dt = world.timestep;  // 动态读取，与 Physics 配置同步
    // 使用 dt 进行磁场旋转计算
  });
}
```

**注意事项**:
- `world.timestep` 在 `updateLoop="follow"` 模式下等于 `Physics` 的 `timeStep` prop
- 在 `updateLoop="independent"` 模式下，物理在独立循环中运行，`useBeforePhysicsStep` 的调用频率与渲染解耦
- `world.timestep` 是 Rapier World 的属性，类型为 `number`

---

## 2. 电磁场注入的具体实现模式

### 2.1 电场力：每帧 `addForce(qE, true)` 是否物理正确？

**发现**: 物理正确，但取决于积分方法。

**物理分析**:
- 电场力 `F = qE` 是**位置相关力**（与速度无关）
- Rapier 使用**半隐式欧拉积分**（Symplectic Euler）：
  ```
  v_{n+1} = v_n + (F_n / m) * dt
  x_{n+1} = x_n + v_{n+1} * dt
  ```
- 这种积分方法对位置相关力是**能量守恒的**（长期行为稳定）

**与直接修改速度的差异**:

| 方法 | 物理正确性 | 碰撞检测 | 适用场景 |
|------|-----------|---------|---------|
| `addForce(qE, true)` | 正确（通过积分器） | 正常工作 | 电场力、重力等位置力 |
| `applyImpulse(qE*dt, true)` | 正确（等价于力×时间） | 正常工作 | 每帧重新计算力时更精确 |
| `setLinvel(v + qE/m*dt)` | 绕过积分器 | 可能错过碰撞 | 不推荐用于电场 |

**推荐做法**:
```tsx
// 方式 1: 使用 addForce（力持续作用）
body.resetForces(true);
body.addForce({ x: q * Ex, y: q * Ey, z: q * Ez }, true);

// 方式 2: 使用 applyImpulse（每帧重新计算，更精确）
const F = computeElectricForce(fields, pos, charge);
const impulse = {
  x: F.x * dt,
  y: F.y * dt,
  z: F.z * dt,
};
body.applyImpulse(impulse, true);
```

**注意事项**:
- 如果电场力是唯一的力，两种方式等价
- 如果有多个力（重力 + 电场 + 弹簧），`addForce` 允许 Rapier 正确叠加
- `applyImpulse` 更适合"每帧重新计算所有力"的模式（如当前 ForceFieldSystem）

---

### 2.2 磁场洛伦兹力：为什么不能直接用 `addForce(qv×B)`？

**发现**: 磁场力 `F = q(v × B)` 是**速度相关力**，直接用 `addForce` 会导致数值能量不守恒。

**数学推导**:
- 半隐式欧拉对速度相关力的处理：
  ```
  v_{n+1} = v_n + (q/m)(v_n × B) * dt
  ```
- 取模平方：
  ```
  |v_{n+1}|^2 = |v_n|^2 + (q|B|dt/m)^2 |v_n|^2
  ```
  速度大小**单调增长**，能量不守恒。

**当前 Rodriguez 旋转的物理正确性**:

```tsx
// forceFieldCalc.ts 第 280-318 行
export function rotateVelocityByMagneticField(vel, B, bodyCharge, mass, dt) {
  const omega = (bodyCharge * Bmag) / mass;
  const theta = omega * dt;
  // 罗德里格斯旋转：保持 |v| 严格不变
}
```

**物理正确性边界条件**:
1. **B 场均匀且恒定**: 旋转公式假设 B 在 dt 内不变
2. **无其他力作用**: 如果同时有电场力，应先叠加电场速度变化，再旋转
3. **dt 足够小**: `theta = omega * dt << 1`，否则离散误差累积
4. **质量恒定**: `mass()` 在步间不变

**推荐做法**（改进当前实现）:
```tsx
// 合并电场和磁场的速度更新
function updateVelocityWithEMField(
  body: RigidBodyAPI,
  pos: Vec3,
  vel: Vec3,
  charge: number,
  mass: number,
  dt: number,
  fields: ForceFieldComponent[],
) {
  // 1. 计算非磁场力（电场、重力、均匀场）
  const F_nonMag = computeNonMagneticForce(fields, pos, charge);
  
  // 2. 电场产生的速度增量
  const dv_electric = {
    x: (F_nonMag.x / mass) * dt,
    y: (F_nonMag.y / mass) * dt,
    z: (F_nonMag.z / mass) * dt,
  };
  
  // 3. 先应用电场速度变化
  const vel_after_electric = {
    x: vel.x + dv_electric.x,
    y: vel.y + dv_electric.y,
    z: vel.z + dv_electric.z,
  };
  
  // 4. 再应用磁场旋转（基于更新后的速度）
  const bodyB = computeTotalMagneticField(fields, charge);
  const newVel = rotateVelocityByMagneticField(vel_after_electric, bodyB, charge, mass, dt);
  
  // 5. 一次性设置
  body.setLinvel(newVel, true);
}
```

---

### 2.3 是否存在更优雅的磁场实现方式？

**发现**: 在当前 Rapier WASM API 限制下，Rodriguez 旋转已是**最优方案**。其他方案都有严重缺陷：

| 方案 | 可行性 | 问题 |
|------|--------|------|
| 自定义积分器 | 不可行 | Rapier WASM 不暴露内部积分器接口 |
| Velocity Constraint | 不可行 | Rapier 的约束求解器不支持速度相关约束 |
| `applyImpulse` 模拟磁场 | 可行但差 | 每帧需要计算 `qv×B*dt`，仍会导致能量漂移 |
| 外部 RK4 积分器 | 复杂 | 需要完全接管物理步进，与 Rapier 冲突 |
| **Rodriguez 旋转** | **最优** | 能量严格守恒，实现简单，与 Rapier 兼容 |

**结论**: 保持当前 Rodriguez 旋转方案，但改进电场-磁场的耦合顺序（先电场增量，后磁场旋转）。

---

## 3. 性能瓶颈的具体数据

### 3.1 Rapier WASM API 调用开销量级

**发现**: 无官方微基准数据，但基于 WASM-JS 边界穿越的一般特性可估算。

**WASM-JS 边界穿越开销**:
- 现代 JS 引擎（V8/SpiderMonkey）中，WASM 函数调用开销约 **0.5-3 微秒/次**
- 简单 getter（如 `translation()`）约 **1-2 微秒**
- 带参数的 setter（如 `addForce()`）约 **2-5 微秒**

**当前 ForceFieldSystem 每帧调用量**（50 实体场景）:

| API 调用 | 次数/帧 | 估算开销 |
|---------|--------|---------|
| `body.translation()` | 50 | ~100 μs |
| `body.linvel()` | 50 | ~100 μs |
| `body.mass()` | 50（磁场路径） | ~100 μs |
| `body.addForce()` | 50 | ~150 μs |
| `body.setLinvel()` | 50（磁场路径） | ~150 μs |
| **总计** | **250** | **~600 μs = 0.6 ms** |

**结论**: 50 实体每帧 250 次 WASM-JS 穿越**不构成瓶颈**（仅占 120fps 帧预算 8.33ms 的 ~7%）。

**注意事项**:
- 如果实体数增加到 200，调用量达 1000 次/帧，开销 ~2.4ms，开始显著
- Rapier WASM 的 SIMD 版本（`@dimforge/rapier3d-simd`）可减少内部计算时间，但不减少边界穿越开销
- 无批量 API：`@dimforge/rapier3d-compat` 未暴露批量 getter/setter

---

### 3.2 `@react-three/rapier` 的 `useBeforePhysicsStep` 性能反模式

**发现**: `useBeforePhysicsStep` 本身不会导致 re-render，但使用不当会引入性能问题。

**hooks.ts 源码分析**（第 45-55 行）:
```tsx
export const useBeforePhysicsStep = (callback: WorldStepCallback) => {
  const { beforeStepCallbacks } = useRapier();
  const ref = useMutableCallback(callback);
  useEffect(() => {
    beforeStepCallbacks.add(ref);
    return () => {
      beforeStepCallbacks.delete(ref);
    };
  }, []);
};
```

**关键事实**:
- 回调存储在 `Set<{ current: WorldStepCallback }>` 中，通过 ref 引用
- `useMutableCallback` 确保回调更新不会触发 effect 重新注册
- **回调内部如果调用 React state setter，会导致组件 re-render**（但 ForceFieldSystem 返回 null，无此问题）

**当前代码的反模式检查**:

```tsx
// ForceFieldSystem.tsx 第 36-148 行
useBeforeStep(() => {
  const state = useSimulationStore.getState();  // 直接读取 store，不触发 re-render
  // ... 纯计算逻辑，无 React state 更新
});
```

**结论**: 当前实现**无性能反模式**。所有 store 读取通过 `getState()`（非 hook），不触发 re-render。

**潜在优化**:
```tsx
// 如果需要在回调中使用外部状态，避免闭包捕获旧值
const fieldsRef = useRef(fields);
fieldsRef.current = fields;

useBeforeStep(() => {
  const currentFields = fieldsRef.current;  // 始终读取最新值
});
```

---

## 4. 与现有代码的集成改造建议

### 4.1 `forceFieldCalc.ts` 中添加场-源计算函数

**新增类型**（`types.ts` 中已定义 `FieldSourceComponent`，此处复用）：

```ts
// types.ts 新增（如尚未定义）
export interface FieldSourceComponent extends Component {
  type: 'fieldSource';
  kind: 'charge' | 'current';
  current?: {
    magnitude: number;
    direction: [number, number, number];
  };
  timeVarying?: {
    enabled: boolean;
    amplitude: number;
    frequency: number;
    phase: number;
  };
}
```

**新增场-源计算函数**（`forceFieldCalc.ts` 或新建 `fieldSourceCalc.ts`）：

```ts
// fieldSourceCalc.ts
import type { FieldSourceComponent } from './types';

interface FieldSource {
  entityId: string;
  position: Vec3;
  charge: number;
  current?: {
    magnitude: number;
    direction: [number, number, number];
  };
}

const MAX_RANGE = 100;  // 场源最大作用距离
const MAX_FORCE = 1e6;  // 力上限，防止数值爆炸

/**
 * 从 ECS 实体收集场源数据
 */
export function collectFieldSources(
  entities: Map<string, Entity>,
  getRef: (id: string) => RefObject<RigidBodyAPI | null> | undefined,
  time: number,
): FieldSource[] {
  const sources: FieldSource[] = [];
  
  for (const [entityId, entity] of entities) {
    const src = entity.components.get('fieldSource') as FieldSourceComponent | undefined;
    const rb = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
    if (!src || !rb) continue;
    
    const ref = getRef(entityId)?.current;
    if (!ref) continue;
    
    const pos = ref.translation();
    let charge = rb.charge ?? 0;
    
    // 时变场处理
    if (src.timeVarying?.enabled) {
      const tv = src.timeVarying;
      charge += tv.amplitude * Math.sin(2 * Math.PI * tv.frequency * time + tv.phase);
    }
    
    sources.push({
      entityId,
      position: { x: pos.x, y: pos.y, z: pos.z },
      charge,
      current: src.current,
    });
  }
  
  return sources;
}

/**
 * 计算场源在指定位置产生的电场强度 E
 * 复杂度: O(S)，S = 场源数
 */
export function computeElectricFieldFromSources(
  sources: FieldSource[],
  targetPos: Vec3,
  excludeId?: string,  // 排除自身，防止自相互作用
): Vec3 {
  let Ex = 0, Ey = 0, Ez = 0;
  
  for (const src of sources) {
    if (src.entityId === excludeId) continue;
    if (src.charge === 0) continue;
    
    const rx = targetPos.x - src.position.x;
    const ry = targetPos.y - src.position.y;
    const rz = targetPos.z - src.position.z;
    const r = Math.hypot(rx, ry, rz);
    
    if (r > MAX_RANGE || r < 1e-6) continue;
    
    const rSoft2 = r * r + SOFTENING * SOFTENING;
    const inv_rSoft3 = 1 / (rSoft2 * Math.sqrt(rSoft2));
    
    Ex += src.charge * rx * inv_rSoft3;
    Ey += src.charge * ry * inv_rSoft3;
    Ez += src.charge * rz * inv_rSoft3;
  }
  
  return {
    x: COULOMB_K * Ex,
    y: COULOMB_K * Ey,
    z: COULOMB_K * Ez,
  };
}

/**
 * 计算带电体在场源电场中的受力
 */
export function computeForceFromFieldSources(
  sources: FieldSource[],
  bodyPos: Vec3,
  bodyCharge: number,
  bodyId: string,
): Vec3 {
  if (bodyCharge === 0 || sources.length === 0) return ZERO;
  
  const E = computeElectricFieldFromSources(sources, bodyPos, bodyId);
  const F = {
    x: bodyCharge * E.x,
    y: bodyCharge * E.y,
    z: bodyCharge * E.z,
  };
  
  // 力上限截断
  const mag = Math.hypot(F.x, F.y, F.z);
  if (mag > MAX_FORCE) {
    const scale = MAX_FORCE / mag;
    return { x: F.x * scale, y: F.y * scale, z: F.z * scale };
  }
  
  return F;
}
```

---

### 4.2 `ForceFieldSystem.tsx` 中收集场源并叠加到现有力计算

**改造后的 ForceFieldSystem**:

```tsx
import { useRef, useEffect } from 'react';
import { useBeforePhysicsStep as useBeforeStep, useRapier } from '@react-three/rapier';
import { useSimulationStore } from '../store';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import {
  computeNonMagneticForce,
  computeTotalMagneticField,
  rotateVelocityByMagneticField,
} from '../ecs/forceFieldCalc';
import {
  collectFieldSources,
  computeForceFromFieldSources,
} from '../ecs/fieldSourceCalc';
import type { ForceFieldComponent, RigidBodyComponent, FieldSourceComponent } from '../ecs/types';

export function ForceFieldSystem() {
  const { getRef } = useRigidBodyRefRegistry();
  const { world } = useRapier();  // 获取 World 以读取 timestep
  const debugFramesRef = useRef<Record<string, unknown>[]>([]);
  const wasRunningRef = useRef(false);
  const frameCounterRef = useRef(0);

  useBeforeStep(() => {
    const state = useSimulationStore.getState();
    const isRunning = state.isRunning;
    const entities = state.entities;
    const dt = world.timestep;  // 动态读取，替代硬编码 DT

    // 暂停 → 运行：清空缓冲区
    if (isRunning && !wasRunningRef.current) {
      debugFramesRef.current = [];
      frameCounterRef.current = 0;
    }
    wasRunningRef.current = isRunning;
    frameCounterRef.current++;

    if (entities.size === 0) return;

    // ── 1. 收集预设力场、场源、dynamic 实体 ──
    const fields: ForceFieldComponent[] = [];
    const dynamicBodies: Array<{ entityId: string; rb: RigidBodyComponent; ref: any }> = [];

    for (const [entityId, entity] of entities) {
      const f = entity.components.get('forceField') as ForceFieldComponent | undefined;
      if (f) fields.push(f);

      const rb = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
      if (rb && rb.kind === 'dynamic') {
        const ref = getRef(entityId);
        const body = ref?.current;
        if (body && typeof body.translation === 'function' && typeof body.addForce === 'function') {
          dynamicBodies.push({ entityId, rb, ref });
        }
      }
    }

    // ── 2. 收集场源（新增）──
    const time = performance.now() / 1000;
    const fieldSources = collectFieldSources(entities, getRef, time);

    // ── 3. 预先计算总磁场 ──
    const totalB = computeTotalMagneticField(fields, 1);

    // ── 4. 对 dynamic 刚体施加力 ──
    for (const { entityId, rb, ref } of dynamicBodies) {
      const body = ref.current;
      if (!body || typeof body.translation !== 'function') continue;
      const pos = body.translation();
      if (typeof body.linvel !== 'function') continue;
      const vel = body.linvel();
      const charge = rb.charge ?? 0;
      const mass = typeof body.mass === 'function' ? body.mass() : rb.mass;

      // 4a) 预设力场（非磁场）
      const F_preset = computeNonMagneticForce(fields, pos, charge);

      // 4b) 场-源关系力（新增）
      const F_sources = computeForceFromFieldSources(fieldSources, pos, charge, entityId);

      // 4c) 合力
      const F_total = {
        x: F_preset.x + F_sources.x,
        y: F_preset.y + F_sources.y,
        z: F_preset.z + F_sources.z,
      };

      // 安全注入：先清零再施加
      if (F_total.x !== 0 || F_total.y !== 0 || F_total.z !== 0) {
        body.resetForces(true);  // 清零旧力
        body.addForce(F_total, true);
      }

      // 4d) 磁场处理（改进：先电场增量，后磁场旋转）
      if (charge !== 0 && mass > 0) {
        const bodyB = computeTotalMagneticField(fields, charge);
        if (bodyB.x !== 0 || bodyB.y !== 0 || bodyB.z !== 0) {
          // 电场产生的速度增量
          const dv_electric = {
            x: (F_total.x / mass) * dt,
            y: (F_total.y / mass) * dt,
            z: (F_total.z / mass) * dt,
          };
          const vel_after_electric = {
            x: vel.x + dv_electric.x,
            y: vel.y + dv_electric.y,
            z: vel.z + dv_electric.z,
          };
          // 磁场旋转
          const newVel = rotateVelocityByMagneticField(vel_after_electric, bodyB, charge, mass, dt);
          body.setLinvel(newVel, true);
        }
      }
    }
  });

  // DEBUG: 暂停时输出诊断数据
  const isRunning = useSimulationStore((s) => s.isRunning);
  useEffect(() => {
    if (!isRunning && debugFramesRef.current.length > 0) {
      console.log(`[ForceField DEBUG] 暂停 — 共 ${debugFramesRef.current.length} 帧采样:`);
      console.table(debugFramesRef.current);
      debugFramesRef.current = [];
    }
  }, [isRunning]);

  return null;
}
```

---

### 4.3 需要新增的类型定义

**`types.ts` 新增**:

```ts
// ── Phase 8: FieldSource 组件 ──

export interface FieldSourceComponent extends Component {
  type: 'fieldSource';
  kind: 'charge' | 'current';
  current?: {
    magnitude: number;           // 电流大小 (A)
    direction: [number, number, number];  // 电流方向
  };
  timeVarying?: {
    enabled: boolean;
    amplitude: number;           // 振幅
    frequency: number;           // 频率 (Hz)
    phase: number;               // 初相位 (rad)
  };
}

// 更新 AnyComponent 联合类型
export type AnyComponent =
  | TransformComponent
  | RigidBodyComponent
  | ColliderComponent
  | VelocityComponent
  | MaterialComponent
  | ConstraintComponent
  | TrailComponent
  | VectorComponent
  | ForceFieldComponent
  | FieldSourceComponent;  // 新增
```

**`RigidBodyRefContext.tsx` 无需修改** — 已有的 `RigidBodyAPI` 接口已覆盖所需方法（`translation`, `linvel`, `mass`, `addForce`, `setLinvel`, `resetForces` 需确认）。

**注意**: `RigidBodyAPI` 接口当前未声明 `resetForces`，需要添加：

```ts
export interface RigidBodyAPI {
  translation(): { x: number; y: number; z: number };
  linvel(): { x: number; y: number; z: number };
  setLinvel(vel: { x: number; y: number; z: number }, wakeUp: boolean): void;
  addForce(force: { x: number; y: number; z: number }, wakeUp: boolean): void;
  applyImpulse(impulse: { x: number; y: number; z: number }, wakeUp: boolean): void;
  resetForces(wakeUp: boolean): void;  // 新增
  mass(): number;
  // ...
}
```

---

## 5. 风险提示

### 5.1 `setLinvel` 绕过物理引擎积分器的问题

| 问题 | 描述 | 缓解措施 |
|------|------|---------|
| 碰撞检测不一致 | 直接设速度可能导致 CCD（连续碰撞检测）失效 | 限制最大速度 `v_max = thickness / dt` |
| 能量不守恒 | 如果 `setLinvel` 与 `addForce` 混用，能量可能漂移 | 严格分离：非磁场力用 `addForce`，磁场用 `setLinvel`，且 `setLinvel` 前清零所有力 |
| 约束求解器冲突 | 速度突变可能导致关节/接触约束抖动 | 避免在受约束的刚体上使用 `setLinvel` |

**关键检查点**:
```tsx
// 在 setLinvel 前确保无累积力
body.resetForces(true);
body.resetTorques(true);
body.setLinvel(newVel, true);
```

---

### 5.2 多力场叠加时的数值精度问题

**风险**: 当多个力场同时作用时，浮点误差累积可能导致：
- 合力方向偏离理论值
- 极小力（< 1e-10）与大力（> 1e3）相加时精度丢失

**缓解措施**:
```ts
// 1. Kahan 求和算法（补偿浮点误差）
function kahanSum(values: Vec3[]): Vec3 {
  let sum = { x: 0, y: 0, z: 0 };
  let c = { x: 0, y: 0, z: 0 };
  for (const v of values) {
    const yx = v.x - c.x;
    const t_x = sum.x + yx;
    c.x = (t_x - sum.x) - yx;
    sum.x = t_x;
    // ... y, z 同理
  }
  return sum;
}

// 2. 力阈值过滤
const MIN_FORCE = 1e-6;
if (Math.abs(F.x) < MIN_FORCE) F.x = 0;
```

**当前代码已部分防御**: `isFiniteVec()` 检查 + 零向量短路。

---

### 5.3 场-源关系中自相互作用的排除策略

**风险**: 如果带电体同时是场源（有 `fieldSource` 组件），它会对自己产生电场力，导致自加速。

**当前已有防御**: `computeForceFromFieldSources` 的 `excludeId` 参数。

**ForceFieldSystem 集成检查**:
```tsx
// 确保传入 bodyId 以排除自身
const F_sources = computeForceFromFieldSources(fieldSources, pos, charge, entityId);
```

**边界情况**:
- 两个相同 entityId 的实体（理论上不可能，但需防御）
- 场源位置与目标体重合（`r < 1e-6` 时跳过，已在 `computeElectricFieldFromSources` 中处理）

---

## 6. 调研总结

| 问题 | 结论 | 优先级 |
|------|------|--------|
| `addForce` 累积问题 | 当前代码缺少 `resetForces`，需修复 | **高** |
| `setLinvel` 与积分器冲突 | 需先 `resetForces` 再 `setLinvel`，并合并电场-磁场速度更新 | **高** |
| DT 硬编码 | 改用 `useRapier().world.timestep` 动态读取 | **中** |
| 性能瓶颈 | 50 实体下 250 次 WASM 调用/帧，~0.6ms，不构成瓶颈 | 低 |
| 场-源计算 | 新增 `fieldSourceCalc.ts`，复杂度 O(S×B)，50 实体下 <1ms | **中** |
| 类型定义 | 新增 `FieldSourceComponent`，更新 `AnyComponent` 联合类型 | **中** |
| 自相互作用 | 通过 `excludeId` 参数排除，已有防御 | 低 |

---

## 参考来源

- [Rapier Forces and Impulses 文档](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/)
- [@react-three/rapier hooks.ts 源码](https://github.com/pmndrs/react-three-rapier/blob/main/packages/react-three-rapier/src/hooks/hooks.ts)
- [@react-three/rapier Physics.tsx 源码](https://github.com/pmndrs/react-three-rapier/blob/main/packages/react-three-rapier/src/components/Physics.tsx)
- [Rapier Integration Parameters 文档](https://rapier.rs/docs/user_guides/rust/integration_parameters/)
- [Rapier Issue #177 - pre-step/post-step 设计讨论](https://github.com/pmndrs/react-three-rapier/issues/177)
- [Rapier Issue #543 - Custom gravity integration](https://github.com/dimforge/rapier/issues/543)
