---
phase: 04-轨迹与矢量可视化
plan: "01"
subsystem: visualization
tags: [ecs, zustand, threejs, typescript, ring-buffer]

# Dependency graph
requires:
  - phase: 02
    provides: ECS entity system (Entity.ts, entitySlice.ts, ComponentType, Entity interface)
  - phase: 03
    provides: ConstraintComponent, SpringConstraintParams (for future vector force calculation)
provides:
  - TrailComponent and VectorComponent ECS component types
  - toggleTrailVisibility / toggleVectorVisibility reducers on entitySlice
  - Default trail (visible=true) and vector (showVelocity=true, showForces=true) on all new entities
  - Standalone visualizationStore with zustand persist (showTrails, showVelocityVectors, showForceVectors, vectorDisplayMode)
  - TrajectoryBuffer ring buffer (Float32Array, 300 points, 5s age cutoff, O(1) push)
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone store pattern: visualizationStore is NOT combined into useSimulationStore — follows PITFALLS #6 (per-frame data stays out of Zustand)"
    - "Ring buffer with dual array (positions + timestamps) for O(1) append and age-based pruning"

key-files:
  created:
    - frontend/src/store/visualizationStore.ts — Zustand persist store for global visualization toggles
    - frontend/src/ecs/TrajectoryBuffer.ts — Float32Array ring buffer for trajectory point storage
    - frontend/src/ecs/__tests__/TrajectoryBuffer.test.ts — 9 unit tests for ring buffer behavior
  modified:
    - frontend/src/ecs/types.ts — TrailComponent + VectorComponent interfaces and union types
    - frontend/src/store/entitySlice.ts — toggleTrailVisibility + toggleVectorVisibility reducers
    - frontend/src/ecs/Entity.ts — Default trail + vector components in createEntity

key-decisions:
  - "TrajectoryBuffer stores both positions AND timestamps (dual Float32Array) for 5-second age cutoff — not just ring buffer index"
  - "visualizationStore is completely independent from useSimulationStore — per PITFALLS #6 design constraint"
  - "All new entities auto-attach trail and vector components via createEntity factory to avoid missing-component edge cases"

patterns-established:
  - "Ring buffer with time-based pruning: push appends head+position+time; getPoints filters by age then returns chronological order"
  - "Toggle reducers use immutable Map update pattern matching existing entitySlice conventions"

requirements-completed: [DIF-02]

# Metrics
duration: 8.5min
completed: 2026-05-03
---

# Phase 04 Plan 01: 可视化基础层（类型 + 状态 + 缓冲区）Summary

**ECS TrailComponent/VectorComponent types, visualizationStore with zustand persist, and Float32Array ring buffer TrajectoryBuffer with 5s age-based pruning**

## Performance

- **Duration:** 8.5 min
- **Started:** 2026-05-03T09:00:25Z
- **Tasks:** 4
- **Files modified:** 8 (5 modified, 3 created)

## Accomplishments

- TrailComponent and VectorComponent integrated into ECS type system (ComponentType union, AnyComponent union, Entity interface)
- toggleTrailVisibility and toggleVectorVisibility reducers added to entitySlice with immutable Map update pattern
- All new entities (sphere, box, cylinder, slope, spring) auto-attach default trail (visible=true) and vector (showVelocity=true, showForces=true) components
- Independent visualizationStore with zustand persist middleware (key: physis-visualization) managing 4 state fields and 4 actions
- TrajectoryBuffer ring buffer: Float32Array(900) positions + Float32Array(300) timestamps, O(1) push, chronological getPoints with 5s cutoff

## Task Commits

1. **Task 1: 定义 ECS 组件类型** - `c31e386` (feat)
2. **Task 2: 扩展 entitySlice 添加 toggle actions** - `d0c849b` (feat)
3. **Task 3: 创建 visualizationStore** - `2a1bb2f` (feat)
4. **Task 4: 实现 TrajectoryBuffer** - `586872c` (feat)
5. **Test fix: ConstraintComponent 测试更新** - `16f5010` (fix)

## Files Created/Modified

- `frontend/src/ecs/types.ts` — TrailComponent + VectorComponent interfaces, extended ComponentType and AnyComponent unions
- `frontend/src/store/entitySlice.ts` — toggleTrailVisibility(entityId, visible) and toggleVectorVisibility(entityId, visible) reducers
- `frontend/src/ecs/Entity.ts` — Default trail and vector components added to createEntity factory
- `frontend/src/store/visualizationStore.ts` — Zustand store with persist: showTrails, showVelocityVectors, showForceVectors, vectorDisplayMode
- `frontend/src/ecs/TrajectoryBuffer.ts` — Ring buffer class: Float32Array positions + timestamps, push/getPoints/clear
- `frontend/src/ecs/__tests__/Entity.test.ts` — Updated component count expectations, added trail/vector default tests
- `frontend/src/ecs/__tests__/TrajectoryBuffer.test.ts` — 9 unit tests: ring wrap, age cutoff, clear, coordinate preservation
- `frontend/src/__tests__/ecs/ConstraintComponent.test.ts` — Updated spring entity component count from 1 to 3

## Decisions Made

- None — followed plan as specified. All design decisions were pre-made in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test expectations for ConstraintComponent test**

- **Found during:** Task 4 verification (full test suite run)
- **Issue:** `createSpringEntity` test expected 1 component, but Phase 4 default trail+vector components now result in 3
- **Fix:** Updated expectation from `components.size === 1` to `3`, added assertions for trail/vector component presence
- **Files modified:** `frontend/src/__tests__/ecs/ConstraintComponent.test.ts`
- **Verification:** Full test suite: 21 files, 182 tests pass
- **Committed in:** `16f5010`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test expectation update only — no behavioral change. All plan functionality intact.

## Issues Encountered

None — all 4 tasks completed without blocking issues.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 04-02 (轨迹渲染) can consume: TrailComponent type, toggleTrailVisibility action, visualizationStore.showTrails, TrajectoryBuffer
- 04-03 (矢量箭头) can consume: VectorComponent type, toggleVectorVisibility action, visualizationStore.showVelocityVectors/showForceVectors
- 04-04 (UI控制) can consume: visualizationStore for toolbar toggle buttons

No blockers.

## Self-Check: PASSED

- All 8 files (5 modified, 3 created) verified present on disk
- All 5 commits (c31e386, d0c849b, 2a1bb2f, 586872c, 16f5010) verified in git log
- Full test suite: 21 files, 182 tests pass
- TypeScript compilation: clean (no errors)

---
*Phase: 04-轨迹与矢量可视化*
*Plan: 01-可视化基础层*
*Completed: 2026-05-03*
