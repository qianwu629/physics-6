# Phase 2 Validation Strategy — 实时物理量图表

## Nyquist Compliance

| Decision | Rate | Nyquist Limit | Meaning |
|----------|------|--------------|---------|
| D-02-04 | 60 Hz render sampling | 30 Hz physical signal ceiling | Any physical oscillation >30 Hz (period <33 ms) will alias. For the target scenarios (projectile, spring oscillator, stacked blocks, free fall), the fastest physical frequency is the stiff spring (~1-5 Hz), well below the limit. **No anti-alias pre-filter required.** |

## Critical Failure Modes → Tests

### V-CHART-01: Energy Conservation
**Why:** If `KE + PE_gravity + PE_spring` drifts during a simple harmonic motion scene, the energy calculation is wrong.
**Test:** Load the "弹簧振子" preset, enable chart tracking, run for 30 s. At each sample, compute `delta_E = E(t) - E(0)`. Assert `abs(delta_E) / E(0) < 0.05` (5% relative drift tolerated due to numerical damping in Rapier).
**Scope:** Unit test `physicsCalc.test.ts` with synthetic rigidBody mocks.

### V-CHART-02: Acceleration Noise Floor
**Why:** Numerical differentiation `a = dv/dt` at 60 Hz amplifies measurement noise.
**Test:** Create a static body (v=0) and sample 60 frames. Raw acceleration must be within `±0.1 m/s²`; SMA(5) smoothed acceleration must be within `±0.05 m/s²`.
**Scope:** Unit test `ChartSampler.test.ts`.

### V-CHART-03: Buffer Memory Cap
**Why:** 500K point cap must prevent unbounded growth during long runs.
**Test:** Simulate 70 minutes of data at 60 Hz (exceeding 500K). Assert `buffer.count === 500_000` and `buffer.head` wraps correctly.
**Scope:** Unit test `chartBuffer.test.ts`.

### V-CHART-04: Pause Freeze
**Why:** Paused chart must not accumulate new data points.
**Test:** Run for 10 samples, pause, wait 60 frames (1 s simulated), resume. Assert buffer length increased by exactly 10 (not 70).
**Scope:** Unit test `ChartSampler.test.ts`.

### V-CHART-05: Reset Clear
**Why:** Reset must zero all buffers, matching `TrajectoryBuffer.reset()` contract.
**Test:** Push 100 samples, trigger `resetCounter` change, assert `buffer.count === 0` and all series data empty.
**Scope:** Unit test `chartBuffer.test.ts` + integration `ChartCanvas.test.tsx`.

### V-CHART-06: Time Window Switch Integrity
**Why:** Switching 5s/30s/all must not mutate the underlying buffer.
**Test:** Push 10 minutes of data, switch to 5s, assert `buffer.count` unchanged. Switch to "all", assert all 10 minutes visible.
**Scope:** Unit test `chartBuffer.test.ts`.

### V-CHART-07: Multi-Series Performance Baseline
**Why:** 16 curves × 30 s must not drop FPS below 55.
**Test:** Enable 4 tracked entities, run `performance.now()` timing around `chart.update()` in a 30 s benchmark. Assert median update cost < 3 ms per frame (leaving 13+ ms for physics + render at 60 Hz).
**Scope:** Manual benchmark script `benchmark/chart-fps.ts` (run via dev console).

## Coverage Matrix

| Req | Unit | Integration | E2E/Benchmark |
|-----|------|-------------|---------------|
| CHART-01 (4 metrics) | V-02, V-01 | ChartCanvas mock test | — |
| CHART-02 (multi-entity) | — | ChartCanvas 16-series test | V-07 |
| CHART-03 (panel/window/pause/reset) | V-03, V-04, V-05, V-06 | ChartPanel interaction test | — |

## Guardrails

- **Float64Array index overflow:** All buffer writes use modulo arithmetic; head pointer capped at `MAX_POINTS`.
- **Chart instance leak:** `useEffect` cleanup must call `chart.remove()` + disconnect ResizeObserver.
- **Time stamp unit mismatch:** `time` field must be `performance.now() / 1000` (seconds), never milliseconds.

## Production Monitoring

- Memory: `performance.memory.usedJSHeapSize` trend over 10 min run (target: stable, no sawtooth growth).
- FPS: On-screen FPS counter already exists (from Phase 1); chart enabled vs disabled delta should be < 2 fps.
