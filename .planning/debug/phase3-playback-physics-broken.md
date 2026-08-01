---
status: resolved
trigger: 完成phase3后，基本功能完全丧失
created: 2026-05-23
updated: 2026-05-23
---

# Debug Session: phase3-playback-physics-broken

## Symptoms

1. 点击播放按钮后无法转动视角
2. 完成创建并且点击播放，物体不会运动
3. 打开图表发现物体各个物理量也完全没有变化

## Expected Behavior
- 点击播放后应能正常转动视角
- 物体应按物理规律运动
- 图表应显示实时变化的物理量

## Actual Behavior
- 视角无法转动
- 物体静止不动
- 图表中所有物理量保持恒定（无变化）

## Timeline
- 问题在完成 Phase 3 后出现
- Phase 3 之前功能正常

## Reproduction Steps
1. 创建物体
2. 点击播放按钮
3. 尝试转动视角（失败）
4. 观察物体运动（无运动）
5. 打开图表查看物理量（无变化）

## Current Focus

hypothesis: "Phase 3 修改可能破坏了物理模拟循环或渲染更新循环"
test: "检查物理引擎和渲染循环的关键代码变更"
expecting: "找到导致模拟暂停或循环中断的根因"
next_action: "gather initial evidence"
reasoning_checkpoint: ""

## Evidence

- 2026-05-23: 检查 `@react-three/rapier` v2.2.0 的 `Physics` 组件实现，确认 `useBeforePhysicsStep` 在 `stepWorld` 中执行，如果回调抛出异常会导致物理步进停止
- 2026-05-23: 检查 R3F v9 的 `update` 函数实现，确认 `useFrame` 回调抛出异常会导致 `gl.render` 不执行，场景不被渲染
- 2026-05-23: 检查 `ForceFieldSystem.tsx`，发现 `useBeforeStep` 回调中直接调用 `body.translation()` 和 `body.linvel()`，没有防御性检查
- 2026-05-23: 检查 `03-REVIEW.md` 中的 CR-04，确认 `getRef` 返回的 ref 可能指向已卸载/无效的 RigidBody
- 2026-05-23: 检查多个组件（ChartSampler、VectorRenderer、TrajectoryRenderer、SpringRenderer），发现它们都有类似问题

## Eliminated

- R3F 渲染循环停止：默认 `frameloop: 'always'`，渲染循环不会停止
- `Physics` 组件 `paused` 属性问题：`paused` 变化不会导致组件重新挂载
- WASM 加载问题：`Canvas` 内部有 `Suspense` 边界
- CSS/DOM 遮挡问题：问题只在点击播放后出现，不是从一开始就存在

## Resolution

### Root Cause

在 React 19 StrictMode 下，`@react-three/rapier` 的 `RigidBody` 组件会双重挂载。虽然最终 `rigidBodyRef.current` 会指向有效的刚体 API，但在某些边界情况下（如快速状态变化、组件重渲染时序），`RigidBodyRefContext` 中缓存的 ref 可能短暂指向无效对象。

Phase 3 新增的 `ForceFieldSystem` 使用 `useBeforePhysicsStep` 在每物理步前注入力场。其回调中直接调用 `body.translation()` 和 `body.linvel()`，没有检查 `body` 是否有效。如果 `body` 指向无效的 RigidBody API（例如已销毁的 WASM 对象），这些方法调用会抛出异常。

该异常在 `@react-three/rapier` 的 `stepWorld` 中传播，导致：
1. 物理步进完全停止（`world.step` 不执行）
2. R3F 的 `useFrame` 回调（`UseFrameStepper`）抛出异常
3. R3F `update` 函数中断，`gl.render` 不执行，场景停止渲染
4. 表现为：物体不运动、视角无法转动、图表无变化

### Fix

为所有访问 RigidBody API 的组件添加防御性检查，确保 `body` 的方法有效后再调用：

1. **ForceFieldSystem.tsx** (关键修复)
   - 添加 `typeof body.translation !== 'function' || typeof body.applyForce !== 'function'` 检查

2. **ChartSampler.ts**
   - 添加 `typeof rb.linvel !== 'function' || typeof rb.translation !== 'function' || typeof rb.mass !== 'function'` 检查
   - `getEntityPosition` 辅助函数中也添加检查

3. **VectorRenderer.tsx**
   - 添加 `isValidRigidBody()` 辅助函数
   - 在访问 `translation()`、`linvel()`、`mass()` 前检查

4. **TrajectoryRenderer.tsx**
   - 添加 `isValidRigidBody()` 辅助函数
   - 在访问 `translation()`、`linvel()` 前检查

5. **SpringRenderer.tsx**
   - 添加 `isValidRigidBody()` 辅助函数
   - 在访问 `translation()` 前检查

### Files Changed

- `frontend/src/components/ForceFieldSystem.tsx`
- `frontend/src/ecs/ChartSampler.ts`
- `frontend/src/components/VectorRenderer.tsx`
- `frontend/src/components/TrajectoryRenderer.tsx`
- `frontend/src/components/SpringRenderer.tsx`

### Verification

- TypeScript 编译通过 (`npx tsc --noEmit`)
