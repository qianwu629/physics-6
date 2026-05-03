---
phase: 04-轨迹与矢量可视化
plan: "02"
subsystem: ui
tags: [react-three-fiber, three.js, BufferGeometry, vertex-colors, trajectory, trail, ECS]

# Dependency graph
requires:
  - phase: "04-01"
    provides: "visualizationStore, TrajectoryBuffer, TrailComponent/VectorComponent types, entitySlice toggleTrailVisibility"
provides:
  - TrajectoryRenderer 组件在 useFrame 中以 30Hz 采样实体位置
  - BufferGeometry + 顶点颜色渐变渲染"彗星尾巴"轨迹
  - 静止物体跳过采样、深度测试遮挡、模拟重置清空轨迹
affects: [04-03-矢量渲染系统, 04-04-可视化集成]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PITFALLS #6 合规：轨迹数据存储在 useRef(TrajectoryBuffer)，不写入 Zustand"
    - "useRigidBodyRefRegistry().getRef() 读取物理体引用获取实时位置"
    - "每实体使用 Map<string, number> ref 跟踪上次采样时间"

key-files:
  created:
    - frontend/src/components/TrajectoryRenderer.tsx
  modified:
    - frontend/src/components/Scene3D.tsx

key-decisions:
  - "30Hz 采样频率（非每帧），降低渲染管线压力"
  - "静止阈值 0.01 m/s — 低于此速度的物体不产生轨迹"
  - "深度测试开启（depthTest: true）确保轨迹被遮挡时不可见"
  - "全局开关 showTrails 控制整组可见性"

patterns-established:
  - "ECS-Renderer 模式：组件从 RigidBodyRefContext 读取物理数据，从 Zustand 读取元数据"

requirements-completed: [DIF-02]

# Metrics
duration: 6min
completed: 2026-05-03
---

# Phase 04-02: 轨迹渲染系统 Summary

**TrajectoryRenderer 组件以 30Hz 采样实体位置，通过 BufferGeometry + 顶点颜色渐变渲染彗星尾巴轨迹效果**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-03T09:14:00Z
- **Completed:** 2026-05-03T09:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- TrajectoryRenderer 组件通过 `useRigidBodyRefRegistry().getRef()` 在 `useFrame` 中读取 Rapier 实体实时位置
- 30Hz 采样频率，静止物体（|velocity| < 0.01）跳过采样，减少 GPU 内存压力
- 顶点颜色线性渐变：旧点 alpha→0（透明消失），新点 alpha→1（实体颜色），最大 300 点 / 5 秒窗口
- 模拟重置时（isRunning false→true）所有轨迹 buffer 清空，实体删除时自动 dispose 对应 line
- 挂载于 Scene3D 的 `<RigidBodyRefContext.Provider>` 内，渲染顺序为 EntityRenderer → SpringRenderer → TrajectoryRenderer

## Task Commits

Each task was committed atomically:

1. **Task 1: 实现 TrajectoryRenderer 组件** - `2b9158a` (feat)
2. **Task 2: 挂载 TrajectoryRenderer 到 Scene3D** - `3daa5b2` (feat)

## Files Created/Modified
- `frontend/src/components/TrajectoryRenderer.tsx` - 轨迹渲染器组件：30Hz 采样、BufferGeometry 顶点颜色渐变、reset 清空、GC 清理
- `frontend/src/components/Scene3D.tsx` - 添加 TrajectoryRenderer 导入并挂载在 RigidBodyRefContext.Provider 内

## Decisions Made
- 30Hz 采样频率而非每帧采样 — 降低 GPU buffer 更新频率，300 点环形缓冲区足够覆盖快速运动
- 静止阈值 0.01 m/s — 低于此速度不产生轨迹，避免静止物体浪费 buffer 空间
- 深度测试默认开启 — 确保轨迹被遮挡时不可见，符合真实物理观察直觉

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修复 useRigidBodyRefRegistry API 调用错误**
- **Found during:** Task 1 (TrajectoryRenderer 实现)
- **Issue:** PLAN 代码使用 `rigidBodyRefs.get(entityId)`，但 `useRigidBodyRefRegistry()` 返回 `{ register, unregister, getRef }` 而非 Map 对象
- **Fix:** 改为解构 `const { getRef } = useRigidBodyRefRegistry()` 并使用 `getRef(entityId)`
- **Files modified:** `frontend/src/components/TrajectoryRenderer.tsx`
- **Verification:** TypeScript 编译通过（tsc --noEmit 无错误）
- **Committed in:** `2b9158a` (Task 1)

**2. [Rule 1 - Bug] 修复采样时序逻辑错误**
- **Found during:** Task 1 (TrajectoryRenderer 实现)
- **Issue:** PLAN 代码的 `lastTime` 计算逻辑：当 `buf.getCount() > 0` 时 `lastTime = now`，导致 `now - lastTime = 0` 始终小于 `SAMPLE_INTERVAL`，除第一帧外所有采样被跳过
- **Fix:** 使用 `useRef<Map<string, number>>` 独立跟踪每个实体的上次采样时间，每次成功采样后更新
- **Files modified:** `frontend/src/components/TrajectoryRenderer.tsx`
- **Verification:** TypeScript 编译通过，逻辑审查确认每 1/30 秒触发一次采样
- **Committed in:** `2b9158a` (Task 1)

**3. [Rule 1 - Bug] 修复未使用参数警告**
- **Found during:** Task 2 (构建验证)
- **Issue:** `useFrame((_, delta) => ...)` 中 `delta` 参数未使用，触发 TS6133 错误
- **Fix:** 移除未使用的 `delta` 参数，改为 `useFrame(() => ...)`
- **Files modified:** `frontend/src/components/TrajectoryRenderer.tsx`
- **Verification:** TypeScript 编译通过（tsc --noEmit 无 TrajectoryRenderer 相关错误）
- **Committed in:** `3daa5b2` (Task 2)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** 所有修复均为 PLAN 伪代码中的逻辑/API 错误，修复后组件功能完整满足 must_haves 全部要求。无范围蔓延。

## Issues Encountered
- `npm run build` 存在 16 个预存 TypeScript 错误（SpringCreationDialog, SpringRenderer, entitySlice tests, api.ts），均非本次变更引入。TrajectoryRenderer 和 Scene3D 的变更无编译错误。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TrajectoryRenderer 组件功能完整，支持 04-03（矢量渲染系统）和 04-04（可视化集成）的集成需求
- `TrajectoryBuffer.getPoints()` API 可用于矢量渲染系统计算轨迹方向

---
*Phase: 04-轨迹与矢量可视化*
*Completed: 2026-05-03*
