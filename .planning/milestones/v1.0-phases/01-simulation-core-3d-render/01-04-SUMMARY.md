---
phase: 01-simulation-core-3d-render
plan: 04
type: gap-closure
status: complete
completed: 2026-05-01T11:22:00Z
gap_closure: true
gaps_resolved:
  - CR-02  # BLOCKER — Reset功能无效
  - CR-01  # CRITICAL — 2D/3D WASM依赖不匹配
  - WR-02  # WARNING — objectCount语义不一致
  - WR-04  # WARNING — 不安全类型断言
---

# 01-04 Gap Closure Summary

## What Was Built

关闭 Phase 1 验证和代码审查发现的 4 个差距：1 个 BLOCKER（Reset 无效）、1 个 CRITICAL（WASM 引擎不匹配）、2 个 WARNING（objectCount 语义、类型断言）。

## Tasks Executed

### Task 1: 修复 Reset 功能 (CR-02)
- `simulationSlice.ts`: 添加 `resetCounter` 状态，`reset()` action 递增计数器 + 暂停
- `Scene3D.tsx`: `<Physics key={resetCounter}>` — 重置时 React 卸载旧物理世界并挂载新物理世界，所有 RigidBody 回到 `INITIAL_SCENE_OBJECTS` 定义的初始位置/速度

### Task 2: 修复 WASM 依赖不匹配 (CR-01, WR-04)
- `package.json`: 移除 `@dimforge/rapier2d-compat` 依赖 (~1.5MB 节省)
- `vite.config.ts`: `optimizeDeps.exclude` 改为排除 `@dimforge/rapier3d-compat`
- `App.tsx`: 移除 `Rapier.init()` 手动初始化 → `<Suspense fallback={<LoadingScreen />}>` 包裹 `Scene3D`，@react-three/rapier 内部处理 WASM 加载
- `App.tsx`: 键盘处理器 `e.target as HTMLElement` → `target instanceof HTMLElement` 类型守卫

### Task 3: 修复 objectCount 语义 (WR-02)
- `Scene3D.tsx`: `SceneInitializer` 使用 `SCENE_STATS.dynamicCount`(11) 替代 `totalObjects`(14)，与 JSDoc "动态物体数量" 一致

## Verification

- 52/52 测试通过（3 test suites, 0 failures）
- TypeScript 编译：Phase 1 代码零新错误
- 所有 plan grep 验证通过
- `npm install` 确认 rapier2d-compat 包已移除

## Key Files Modified

- `frontend/src/store/simulationSlice.ts` — 添加 resetCounter
- `frontend/src/components/Scene3D.tsx` — Physics key + dynamicCount
- `frontend/src/components/App.tsx` — Suspense 边界 + 类型守卫 + 移除 WASM 手动初始化
- `frontend/package.json` — 移除 rapier2d-compat
- `frontend/vite.config.ts` — 排除 rapier3d-compat

## Self-Check: PASSED

All acceptance criteria met. Reset 通过 Physics key 重新挂载恢复初始场景。WASM 加载由 @react-three/rapier 内部 Suspense 处理。类型安全通过 instanceof 守卫确保。
