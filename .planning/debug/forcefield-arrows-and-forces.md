---
status: fixed
trigger: PHASE3所创造的通用力场完全不可行
created: 2026-05-23
updated: 2026-05-23
---

# Debug Session: forcefield-arrows-and-forces

## Symptoms

1. 力场创建后没有箭头显示
2. 点电荷场创建后没有提供力的作用，无论是从物体运行的轨迹还是从物体运行时的受力箭头状态
3. 箭头刷新率需要改为50FPS

## Expected Behavior
- 创建通用力场后，应显示力场方向的箭头
- 创建点电荷场后，应对附近物体施加电场力，物体轨迹应发生偏转，受力箭头应显示电场力
- 箭头刷新率应为50FPS

## Actual Behavior
- 力场创建后完全没有箭头显示
- 点电荷场创建后，物体轨迹无变化，受力箭头不显示电场力
- 箭头刷新率可能不是50FPS

## Timeline
- 问题在完成 Phase 3 后出现
- 具体是通用力场系统的功能缺陷

## Reproduction Steps
1. 打开场景
2. 创建通用力场（如重力场、电场等）
3. 观察：没有力场箭头显示
4. 创建点电荷场
5. 放置物体并播放
6. 观察：物体轨迹不受力场影响，受力箭头不显示电场力

## Current Focus

hypothesis: "VectorRenderer 未计算力场产生的力；ForceFieldRenderer/ForceFieldLines 依赖可视化开关"
test: "检查 VectorRenderer 力计算逻辑和可视化 store 默认值"
expecting: "确认三处根因并修复"
next_action: "apply fixes"
reasoning_checkpoint: "已找到三处根因"

## Evidence

### 证据 1: VectorRenderer 未包含力场力的计算 (2026-05-23)

文件: `frontend/src/components/VectorRenderer.tsx`

`VectorRenderer` 的 `useFrame` 中计算 forces 时，只包含：
- gravity (环境重力)
- drag (环境阻力)
- spring (弹簧力)
- contact (接触力)

**完全没有调用 `computeTotalForce` 或读取力场组件来计算力场力。**

相关代码段 (第 191-224 行):
```typescript
const forces: ForceEntry[] = [];

if (showForceVectors && gravityStrength > 0 && mass > 0) {
  forces.push({ type: 'gravity', direction: [...], magnitude: mass * gravityStrength });
}

if (showForceVectors && dragCoeff > 0 && speed > 0.01) {
  forces.push({ type: 'drag', direction: [...], magnitude: dragCoeff * speed });
}

if (showForceVectors) {
  const springForces = springForceMap.get(entityId);
  if (springForces) forces.push(...springForces);
}

if (showForceVectors) {
  const cf = getRecentContactForce(entityId);
  if (cf && cf.length() > 0.01) { ... }
}
```

**缺失**: 没有遍历 `forceField` 组件并调用 `computeFieldForce` 来计算电场力、引力场力、均匀场力、磁场力。

### 证据 2: 可视化 Store 默认关闭力场显示 (2026-05-23)

文件: `frontend/src/store/visualizationStore.ts`

```typescript
showForceLines: false,
showForceVectors: false,
showVelocityVectors: false,
```

所有力场相关的可视化开关默认都是 `false`。用户创建力场后，即使 ForceFieldRenderer 渲染了箭头/球体，ForceFieldLines 也不会显示力线（因为 `showForceLines` 默认 false）。

### 证据 3: VectorRenderer 力计算刷新率为 2FPS (2026-05-23)

文件: `frontend/src/components/VectorRenderer.tsx` 第 109-110 行:

```typescript
lastForceCalcRef.current += delta;
const shouldRecalc = lastForceCalcRef.current >= 0.5; // 0.5秒 = 2FPS
```

力计算每 0.5 秒才刷新一次，即 **2FPS**。用户要求改为 50FPS，即间隔应为 `1/50 = 0.02` 秒。

### 证据 4: 力场实体创建正确 (2026-05-23)

文件: `frontend/src/ecs/Entity.ts` 第 202-227 行

`createForceFieldEntity` 正确创建了只含 `transform` + `forceField` 组件的实体。

### 证据 5: 力场物理计算正确 (2026-05-23)

文件: `frontend/src/ecs/forceFieldCalc.ts`

`computeTotalForce` 和 `computeFieldForce` 实现了 uniform/gravity/electric/magnetic 四种力场的物理计算，公式正确。

### 证据 6: ForceFieldSystem 正确注入力 (2026-05-23)

文件: `frontend/src/components/ForceFieldSystem.tsx`

`useBeforeStep` 正确遍历所有 `forceField` 组件，对 `dynamic` 刚体调用 `computeTotalForce` 并通过 `applyForce` 注入物理世界。

**所以物理模拟本身是正确的** — 力确实被施加到了刚体上。问题只在可视化层面：
1. VectorRenderer 不显示力场力
2. 力线默认不显示
3. 箭头刷新率太低

## Eliminated

- `ForceFieldSystem` 物理注入逻辑: 正确 — 力确实被施加
- `forceFieldCalc.ts` 公式: 正确 — 四种力场公式实现正确
- `createForceFieldEntity` 工厂: 正确 — 实体结构正确
- `ForceFieldRenderer` 渲染逻辑: 正确 — 但依赖可视化开关
- `Scene3D` 组件挂载: 正确 — 所有组件都已挂载

## Resolution

### Root Cause

1. **VectorRenderer 未计算力场力** (frontend/src/components/VectorRenderer.tsx:186-218)
   - 力计算只包含 gravity、drag、spring、contact 四种力
   - 完全没有遍历 forceField 组件或调用 computeTotalForce
   - 导致电场力、引力场力、均匀场力、磁场力均不显示在受力箭头中

2. **可视化 Store 默认关闭力场显示** (frontend/src/store/visualizationStore.ts:25-26)
   - `showForceVectors: false`
   - `showForceLines: false`
   - 用户创建力场后，即使 ForceFieldRenderer 渲染了箭头/球体，默认也不显示

3. **箭头刷新率仅 2FPS** (frontend/src/components/VectorRenderer.tsx:105)
   - `lastForceCalcRef.current >= 0.5` 即每 0.5 秒刷新一次
   - 远低于要求的 50FPS

4. **ForceFieldSystem 使用了错误的 Rapier API 方法名 `applyForce`** (frontend/src/components/ForceFieldSystem.tsx:46,67-68)
   - Rapier 原生 RigidBody API 只有 `addForce`，没有 `applyForce`
   - 防御性检查 `typeof body.applyForce === 'function'` 永远返回 `false`
   - 导致：① 刚体无法通过有效性检查进入 dynamicBodies 列表；② 即使进入列表，力也无法被施加
   - 这是物体实际不受力场影响的根本原因（可视化层面的修复已于 Round 1 完成）

### Fix

**Round 1 — 可视化层面修复:**

1. **VectorRenderer.tsx**
   - 导入 `computeTotalForce` 和 `ForceFieldComponent`
   - 在 COLORS 中添加 `field: '#a855f7'`（紫色，用于力场力箭头）
   - 在力计算阶段收集所有 `forceField` 组件
   - 对每个实体调用 `computeTotalForce` 计算总力场力，非零时加入 forces 数组
   - 将刷新间隔从 `0.5` 改为 `0.02`（50FPS）

2. **visualizationStore.ts**
   - `showForceVectors: true`
   - `showForceLines: true`

**Round 2 — 物理层面修复:**

3. **ForceFieldSystem.tsx**
   - 将 `typeof body.applyForce === 'function'` 改为 `typeof body.addForce === 'function'`
   - 将 `body.applyForce(F, true)` 改为 `body.addForce(F, true)`
   - 更新注释中的 API 名称引用

4. **RigidBodyRefContext.tsx**
   - 接口中将 `applyForce` 重命名为 `addForce`，与 Rapier 原生 API 对齐

### Files Changed

- frontend/src/components/VectorRenderer.tsx
- frontend/src/store/visualizationStore.ts
- frontend/src/components/ForceFieldSystem.tsx
- frontend/src/components/RigidBodyRefContext.tsx

### Verification

- TypeScript 编译通过 (`cd frontend && npx tsc --noEmit`)
- 无新增类型错误
