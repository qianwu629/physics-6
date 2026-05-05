---
phase: 02-实时物理量图表
plan: 02
subsystem: 物理量采样核心
tags: [physicsCalc, ChartSampler, energy, SMA, useFrame]
requires:
  - 02-01 (chartBuffer.ts, chartDataStore.ts)
provides:
  - computeEnergy
  - AccelerationSmoother
  - ChartSampler (60Hz sampling loop)
affects:
  - frontend/src/components/Scene3D.tsx
tech-stack:
  added: []
  patterns: [Float64Array环形缓冲, SMA(5)平滑, useFrame采样, Zustand配置+Ref数据分离]
key-files:
  created:
    - frontend/src/utils/physicsCalc.ts (能量计算 + SMA 平滑)
    - frontend/src/utils/__tests__/physicsCalc.test.ts (7 测试)
    - frontend/src/ecs/ChartSampler.ts (60Hz useFrame 采样组件)
    - frontend/src/ecs/__tests__/ChartSampler.test.ts (5 测试)
    - frontend/src/store/chartBuffer.ts (Rule 3 短路桩)
    - frontend/src/store/chartDataStore.ts (Rule 3 短路桩)
  modified:
    - frontend/src/components/Scene3D.tsx (挂载 ChartSampler)
decisions: []
metrics:
  duration_seconds: 660
  completed_date: 2026-05-05T14:09:00Z
---

# Phase 02 Plan 02: 物理量采样核心 Summary

**One-liner:** 构建物理量计算引擎（能量公式 + SMA(5) 加速度平滑）和 60Hz useFrame 采样循环，将 Rapier 物理引擎的原始数据实时转换为 12 项图表指标。

## Deliverables

| File | Purpose | Lines |
|------|---------|-------|
| `frontend/src/utils/physicsCalc.ts` | computeEnergy() + AccelerationSmoother | 130 |
| `frontend/src/utils/__tests__/physicsCalc.test.ts` | 能量守恒 + 加速度平滑单元测试 | 220 |
| `frontend/src/ecs/ChartSampler.ts` | 60Hz useFrame 采样逻辑组件 | 155 |
| `frontend/src/ecs/__tests__/ChartSampler.test.ts` | 缓冲集成测试（暂停/重置/指标/多实体） | 195 |
| `frontend/src/components/Scene3D.tsx` | +2 行：import + mount `<ChartSampler />` | ~370 |

## Verification Results

### Unit Tests
- `physicsCalc.test.ts`: 7/7 PASS
  - computeEnergy: KE, PE_gravity, PE_spring, total energy
  - AccelerationSmoother: static body accel < 0.05 m/s^2, constant acceleration detection
  - Energy conservation: spring oscillator drift < 5% over 30s simulation
- `ChartSampler.test.ts`: 5/5 PASS
  - V-CHART-04: pause freeze (no data written)
  - Tracked/untracked entity separation
  - V-CHART-05: reset clears all buffers
  - 12 metrics at correct indices (pos:0-2, vel:3-5, accel:6-8, energy:9-11)
  - Multi-entity independent buffers

### Full Suite
- 29 test files, 248 tests — ALL PASSING (no regressions)

### TypeScript
- `npx tsc --noEmit` — clean, no errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] chartBuffer.ts and chartDataStore.ts dependency stubs**
- **Found during:** Pre-Task 1
- **Issue:** Plan 02-02 depends on chartBuffer.ts and chartDataStore.ts from Plan 02-01, but those files did not exist yet (parallel wave execution)
- **Fix:** Created functional stubs implementing the full API specified in the plan's interfaces section
- **Files modified:** frontend/src/store/chartBuffer.ts, frontend/src/store/chartDataStore.ts
- **Commit:** a6a5108

**2. [Rule 1 - Bug] require() incompatible with ESM**
- **Found during:** Task 1 RED phase
- **Issue:** physicsCalc.test.ts used `require('../physicsCalc')` which fails in ESM mode (package.json has `"type": "module"`)
- **Fix:** Replaced all `require()` calls with top-level ESM `import` statements
- **Files modified:** frontend/src/utils/__tests__/physicsCalc.test.ts
- **Commit:** cca0606

**3. [Rule 1 - Bug] chartBuffers.size assertion inflated by prior test state**
- **Found during:** Task 2 RED phase
- **Issue:** `expect(chartBuffers.size).toBe(3)` failed because module-level Map retained entries from Test 1 and Test 2
- **Fix:** Replaced size assertion with individual `has()` checks per entity ID
- **Files modified:** frontend/src/ecs/__tests__/ChartSampler.test.ts
- **Commit:** da02a84

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `frontend/src/store/chartBuffer.ts` | entire file | chartBuffer 实现 | Plan 02-01 未执行时创建的短路桩；功能完整，API 与计划接口一致 |
| `frontend/src/store/chartDataStore.ts` | entire file | chartDataStore 实现 | Plan 02-01 未执行时创建的短路桩；功能完整，API 与计划接口一致 |

注：这两个文件将在 Plan 02-01 执行时被正式实现覆盖。

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. All data stays within the client-side chartBuffer Map.

## Commits

| Hash | Message |
|------|---------|
| a6a5108 | chore(02-实时物理量图表): create chartBuffer and chartDataStore stubs |
| e5e08ee | test(02-02): add failing test for physicsCalc (RED) |
| cca0606 | feat(02-02): implement physicsCalc with energy calc and SMA smoothing |
| da02a84 | test(02-02): add ChartSampler integration tests (RED) |
| c9c532c | feat(02-02): implement ChartSampler with 60Hz useFrame sampling loop |

## TDD Gate Compliance

- RED gate (physicsCalc): e5e08ee `test(02-02): add failing test for physicsCalc (RED)` ✅
- GREEN gate (physicsCalc): cca0606 `feat(02-02): implement physicsCalc with energy calc and SMA smoothing` ✅
- RED gate (ChartSampler): da02a84 `test(02-02): add ChartSampler integration tests (RED)` ✅
- GREEN gate (ChartSampler): c9c532c `feat(02-02): implement ChartSampler with 60Hz useFrame sampling loop` ✅

Both features follow the RED-GREEN TDD cycle with proper gate commit ordering.

## Success Criteria

1. ✅ physicsCalc.ts exports computeEnergy() and AccelerationSmoother — formulas match RESEARCH.md
2. ✅ physicsCalc.test.ts: 7/7 PASS (energy conservation < 5%, accel noise < 0.05)
3. ✅ ChartSampler.ts: 60Hz useFrame sampling, writes to chartBuffer
4. ✅ ChartSampler.test.ts: 5/5 PASS (pause freeze, reset clear)
5. ✅ Scene3D.tsx: `<ChartSampler />` mounted inside Physics provider
6. ✅ TypeScript compilation clean, no new errors

## Self-Check: PASSED

- All 5 commits verified in git history
- SUMMARY.md file exists
- All files referenced in key-files exist on disk
- Full test suite: 29 files, 248 tests PASSING
