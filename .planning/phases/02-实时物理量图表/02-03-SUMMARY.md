---
phase: "02-实时物理量图表"
plan: "03"
subsystem: "components"
tags: ["chart", "lightweight-charts", "canvas", "react", "visualization"]
requires: ["02-01 (chartDataStore, chartBuffer)"]
provides: ["ChartCanvas (lightweight-charts wrapper)", "ChartMetricTabs (metric switcher)"]
affects: ["02-04 (ChartPanel — consumes ChartCanvas + ChartMetricTabs)"]
tech-stack:
  added: ["lightweight-charts ^5.2.0 (Canvas chart engine)"]
  patterns: ["forwardRef + useImperativeHandle (imperative API)", "useRef for chart instance (bypass React re-render)", "ResizeObserver for responsive sizing", "TDD RED-GREEN cycle"]
key-files:
  created:
    - "frontend/src/components/ChartCanvas.tsx"
    - "frontend/src/components/ChartMetricTabs.tsx"
    - "frontend/src/components/__tests__/ChartCanvas.test.tsx"
  modified: []
decisions:
  - "ChartCanvas uses forwardRef + useImperativeHandle to expose refreshAll() and setTimeWindow() — imperative API avoids React re-render storms for 60Hz updates"
  - "METRIC_INDICES map MetricType to buffer indices: position=[0,1,2], velocity=[3,4,5], acceleration=[6,7,8], energy=[9,10,11]"
  - "Color scheme follows D-02-03: blue/green/orange/purple with depth shading by entity index"
  - "Timestamp uses Date.now()/1000 (Unix seconds) for lightweight-charts Time compatibility"
  - "useEffect cleanup calls chart.remove() + ResizeObserver.disconnect() — mitigates T-03-01 and T-03-02"
  - "ChartMetricTabs styling matches EnvironmentPanel preset buttons: rounded-lg, border, bg-[rgba]"
metrics:
  duration: "~8 min"
  completed_date: "2026-05-05"
---

# Phase 02 Plan 03: ChartCanvas + ChartMetricTabs Summary

ChartCanvas.tsx（lightweight-charts imperative wrapper）和 ChartMetricTabs.tsx（4 类物理量指标 Tab 切换器），图表数据的消费端——将环形缓冲区数据渲染为高性能 Canvas 实时折线图。

## What Was Built

**ChartCanvas.tsx** — React 组件封装 lightweight-charts Canvas 图表引擎，通过 `useRef` + `useImperativeHandle` 暴露 imperative API（`refreshAll`、`setTimeWindow`），完全绕开 React 重渲染。支持根据 `trackedEntityIds` 动态增删 LineSeries，按指标优先配色方案（位置蓝/速度绿/加速度橙/能量紫）。ResizeObserver 驱动自适应尺寸，cleanup 阶段释放 chart 实例和 observer。

**ChartMetricTabs.tsx** — 4 个 Tab 按钮（位置/速度/加速度/能量），样式与 EnvironmentPanel 预设按钮一致（rounded-lg + bg-[rgba] + border），active 状态使用蓝色高亮。

**ChartCanvas.test.tsx** — 6 个集成测试，mock lightweight-charts API，覆盖：
1. createChart 在挂载时被调用
2. 添加追踪实体后 chart.addSeries 被调用
3. refreshAll() 从 buffer 读取数据并调用 series.update()
4. 卸载时 chart.remove() 被调用（无泄漏）
5. setTimeWindow('5s') 调用 timeScale.setVisibleRange()
6. overlay 模式下多个实体共用一个 Chart

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `d3bf3da` — test(02-03): add failing tests | PASS |
| GREEN | `205764a` — feat(02-03): implement ChartCanvas | PASS |
| REFACTOR | N/A — code clean from start | SKIPPED |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useImperativeHandle missing dependency array caused stale closures**
- **Found during:** Task 1 GREEN phase
- **Issue:** `useImperativeHandle` callback captured initial `trackedEntityIds` and `timeWindow` values; after Zustand state changes, `refreshAll()` used stale values
- **Fix:** Added `[trackedEntityIds, metric, timeWindow]` dependency array to `useImperativeHandle`
- **Files modified:** `frontend/src/components/ChartCanvas.tsx`
- **Commit:** `205764a`

**2. [Rule 2 - Missing Error Handling] timeScale operations wrapped with try/catch**
- **Found during:** Task 1 execution (parallel agent/linter enhancement)
- **Issue:** `timeScale().setVisibleRange()` and `fitContent()` throw when chart has no data; unhandled exceptions would crash the component
- **Fix:** Wrapped timeScale calls in `try/catch` blocks with graceful fallback
- **Files modified:** `frontend/src/components/ChartCanvas.tsx`
- **Commit:** `e6fe788`

**3. [Rule 2 - Correctness] Timestamp source changed to Date.now()**
- **Found during:** Task 1 execution (parallel agent/linter enhancement)
- **Issue:** `performance.now()` returns milliseconds since page load (~small value); lightweight-charts expects Unix timestamps; mismatch would cause incorrect time-based data queries
- **Fix:** Changed to `Date.now() / 1000` for Unix-second timestamps, test updated to match
- **Files modified:** `frontend/src/components/ChartCanvas.tsx`, `frontend/src/components/__tests__/ChartCanvas.test.tsx`
- **Commit:** `e6fe788`

## Threat Flags

No new threat flags. Existing T-03-01 (series leak) and T-03-02 (ResizeObserver leak) are mitigated by useEffect cleanup.

## Known Stubs

None. Both components are fully implemented with real data flow.

## Verification

### Automated
```bash
cd frontend
npx vitest run src/components/__tests__/ChartCanvas.test.tsx --reporter=verbose
# Result: 6 passed, 0 failed

npx tsc --noEmit
# Result: No errors
```

### Self-Check: PASSED

All created files exist, all commits verified in git log:
- `d3bf3da` test — RED gate
- `205764a` feat — GREEN gate
- `e4b39e2` feat — ChartMetricTabs
- `e6fe788` fix — timestamp + error handling
