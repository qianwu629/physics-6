# Phase 2 Plan Check

## Summary
- Total Plans: 6
- Issues Found: 2 blockers, 6 warnings
- Verdict: PASS_WITH_NOTES

---

## Requirement Coverage

| Req | Covered By | Status |
|-----|-----------|--------|
| CHART-01 (4 classes) | 02-01, 02-02, 02-03, 02-05, 02-06 | Covered |
| CHART-02 (multi-entity) | 02-03, 02-04, 02-05, 02-06 | Covered |
| CHART-03 (panel/window/pause/reset) | 02-01, 02-02, 02-04, 02-05, 02-06 | Covered |

---

## Decision Coverage

| Decision | Plan | Task | Status |
|----------|------|------|--------|
| D-02-01 (lightweight-charts) | 02-03 | Task 1 | Covered |
| D-02-02 (overlay/separate) | 02-03, 02-04 | Task 1 | Covered |
| D-02-03 (color scheme) | 02-03, 02-04 | Task 1 | Covered |
| D-02-04 (60Hz sampling) | 02-02 | Task 2 | Covered |
| D-02-05 (ring buffer 500K) | 02-01 | Task 2 | Covered |
| D-02-06 (chartDataStore) | 02-01 | Task 3 | Covered |
| D-02-07 (pause/reset) | 02-02 | Task 2 | Covered |
| D-02-08 (peReferenceY) | 02-01, 02-05 | Task 3, Task 2 | Covered |
| D-02-09 (PropertyPanel switch) | 02-01, 02-05 | Task 3, Task 1 | Covered |

---

## Dependency Graph

02-01 (wave 0)
  |
02-02 (wave 1)
  |
02-03 (wave 2)
  |
02-04 (wave 2, should be wave 3)
  |
02-05 (wave 3)
  |
02-06 (wave 3, should be wave 4)

- Cycle: None (valid DAG)
- 02-04 depends on 02-03 (wave 2 -> wave 2), should be wave 3
- 02-06 depends on 02-05 (wave 3 -> wave 3), should be wave 4

---

## Nyquist Coverage

| Item | Mentioned In | Status |
|------|-------------|--------|
| 60Hz sampling | 02-01, 02-02, 02-04, 02-06 | Covered |
| 30Hz Nyquist limit | 02-06 only | Partial |
| Nyquist principle | NOWHERE in plans | Missing |

---

## Scope Control

| Deferred Feature | Found In Plans | Status |
|-----------------|----------------|--------|
| CSV export (ANL-02) | Not found | Clean |
| Time manipulation (ANL-03) | Not found | Clean |
| 3D charts | Not found | Clean |
| Auto-solving | Not found | Clean |

No scope creep detected.

---

## Risk Identification

| Risk | Handled In | Status |
|------|-----------|--------|
| chart.remove() leak | 02-03 Task 1 cleanup | Handled |
| ResizeObserver leak | 02-03 Task 1 cleanup | Handled |
| Millisecond timestamp misuse | 02-01, 02-02, 02-03 | Handled |
| setData vs update mix | 02-03 uses update() | Handled |
| Acceleration noise / SMA | 02-02, 02-06 | Handled |
| Canvas vs WebGL competition | 02-06 benchmark | Partial |
| Independent rAF loop | 02-04 creates rAF | Warning |
| Memory leak / 500K cap | 02-01, 02-06 | Handled |

---

## Test Coverage

| Plan | Test Files | Test Type | Status |
|------|-----------|-----------|--------|
| 02-01 | chartBuffer.test.ts | Unit | Good |
| 02-02 | physicsCalc.test.ts, ChartSampler.test.ts | Unit | Good |
| 02-03 | ChartCanvas.test.tsx | Integration | Good |
| 02-04 | ChartPanel.test.tsx | Integration | Good |
| 02-05 | None | Manual via 02-06 checkpoint | Acceptable |
| 02-06 | benchmark/chart-fps.ts | Benchmark | Good |

---

## Reachability

All targets are compatible with existing Phase 1 code:
- chartBuffer.ts: TrajectoryBuffer.ts pattern exists (exact analog)
- ChartSampler.ts: TrajectoryRenderer.tsx useFrame pattern (exact analog)
- Scene3D.tsx mounting: VectorRenderer/TrajectoryRenderer mounted (add ChartSampler same way)
- PropertyPanel switch: Two visualization areas exist (add third Switch to both)
- EnvironmentPanel slider: HighlightSlider exists (add peReferenceY slider)
- Toolbar button: No props currently (add optional props with default {})
- App.tsx integration: Toolbar, PropertyPanel mounted (add ChartPanel + state)

---

## Issues

### Blockers (must fix before execution)

**1. [research_resolution] RESEARCH.md Open Questions unresolved**
- File: 02-RESEARCH.md
- Section: ## Open Questions (no RESOLVED suffix)
- Questions about Rapier linvel() paused state, spring PE precision, and 16-series performance baseline remain open
- Fix: Mark section as ## Open Questions (RESOLVED) with inline resolutions

**2. [key_links_planned] visibleMetrics dead state in chartDataStore**
- Plan: 02-01
- Issue: chartDataStore defines visibleMetrics and setVisibleMetrics, but no plan ever reads or uses this state. ChartMetricTabs uses activeMetric (single selection) not visibleMetrics.
- Fix: Either remove visibleMetrics/setVisibleMetrics from chartDataStore, or implement actual metric visibility filtering.

### Warnings (should fix, execution can proceed)

**3. [dependency_correctness] Wave number inconsistencies**
- 02-04 has wave=2 but depends on 02-03 (also wave=2). Should be wave=3.
- 02-06 has wave=3 but depends on 02-05 (also wave=3). Should be wave=4.

**4. [scope_sanity] 02-04 depends on 02-03, reducing Wave 2 parallelism**
- Wave 2 contains 02-03 and 02-04, but 02-04 cannot start until 02-03 completes.

**5. [nyquist_compliance] Nyquist principle not mentioned in plans**
- VALIDATION.md documents 30Hz ceiling, but no plan references this.

**6. [task_completeness] 02-05 uses grep-based verification only**
- Tasks 1-4 use grep commands, not functional tests.

**7. [key_links_planned] 02-04 ChartPanel independent rAF loop**
- ChartPanel.tsx creates its own requestAnimationFrame loop. RESEARCH.md Anti-Patterns warns against independent rAF loops.

**8. [claude_md_compliance] Toolbar.test.tsx not updated in plans**
- Test file not mentioned; safe due to default props but should be noted.

---

## Recommendations

1. Resolve RESEARCH.md Open Questions before execution.
2. Clean up visibleMetrics dead state from chartDataStore.
3. Fix wave numbers: 02-04 -> wave 3, 02-06 -> wave 4.
4. Consider merging rAF loops: Have ChartSampler call refreshAll() in useFrame.
5. Add Nyquist comment in ChartSampler.ts.

---

*Plan check completed: 2026-05-05*
*Checker: gsd-plan-checker*
