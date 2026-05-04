---
phase: 01-simulation-core-3d-render
plan: 03
subsystem: ui-components
tags: [toolbar, loading-screen, error-fallback, app-root, wasm-init, keyboard-shortcuts, state-orchestration]
depends_on: ["01-01", "01-02"]
provides: full-interactive-physics-sandbox
affects: frontend/src/components/
tech-stack:
  added: []
  patterns: [TDD RED/GREEN cycle, Zustand store selectors, React state machine (loading/error/ready), keyboard event filtering, visibilitychange auto-pause]
key-files:
  created: [frontend/src/components/Toolbar.tsx, frontend/src/components/Toolbar.test.tsx, frontend/src/components/LoadingScreen.tsx, frontend/src/components/ErrorFallback.tsx, frontend/src/components/LoadingScreen.test.tsx]
  modified: [frontend/src/components/App.tsx]
decisions:
  - "WASM init delays 100ms for LoadingScreen DOM render — avoids white flash during page load"
  - "Keyboard shortcuts filter INPUT/TEXTAREA/SELECT/contentEditable targets — prevents accidental simulation control while typing"
  - "visibilitychange auto-pause but no auto-resume — educational UX respects user intent on tab return"
  - "R key checks !ctrlKey && !metaKey && !altKey — prevents intercepting Ctrl+R browser refresh"
  - "Store accessed via .getState() in visibilitychange handler (not useSimulationStore hook) — avoids stale closure bugs"
metrics:
  duration: "~11.6 min"
  completed_date: "2026-05-01T07:43:36Z"
---

# Phase 01 Plan 03: UI Components and App Assembly Summary

**One-liner:** Built full interactive physics sandbox UI — floating glassmorphism toolbar with play/pause/reset/debug controls, WASM loading screen with spin animation, dual error fallback cards (WebGL/WASM), and App root component orchestrating WASM init, keyboard shortcuts, and state machine transitions.

## Task Summary

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 (RED) | Add failing tests for Toolbar component | `559a439` | Complete |
| 1 (GREEN) | Implement Toolbar component with all controls | `2dc3d09` | Complete |
| 2 (RED) | Add failing tests for LoadingScreen and ErrorFallback | `f0db91c` | Complete |
| 2 (GREEN) | Implement LoadingScreen and ErrorFallback components | `f821a21` | Complete |
| 3 | Implement App root component | `bfdfcf4` | Complete |

## Verification Results

### Task 1: Toolbar Component
- Play button shows "▶ 播放" when not running: PASS
- Pause button shows "⏸ 暂停" with blue accent (#3b82f6) when running: PASS
- Reset button with "↺ 重置" text and aria-label: PASS
- Debug toggle active/inactive states with correct colors: PASS
- FPS display in "{n} FPS" format: PASS
- Object count in "物体: {n}" format: PASS
- Semi-transparent background rgba(26, 26, 26, 0.85) + blur(8px): PASS
- All buttons have Chinese aria-labels: PASS
- 8 useSimulationStore subscriptions: PASS
- Keyboard shortcut hints via title attributes: PASS
- 21 vitest tests passing: PASS
- TypeScript compilation (0 new errors): PASS

### Task 2: LoadingScreen and ErrorFallback
- LoadingScreen: Loader2 spin animation + "正在加载物理引擎..." text: PASS
- LoadingScreen: dark background #0a0a0a, centered flex layout: PASS
- ErrorFallback webgl: "WebGL 不可用" + "WebGL 2.0" description: PASS
- ErrorFallback wasm: "物理引擎加载失败" + "WebAssembly" description: PASS
- Both error types: AlertTriangle red icon (#ef4444): PASS
- Refresh button with window.location.reload(): PASS
- RefreshCw icon inside refresh button: PASS
- 16 vitest tests passing: PASS
- TypeScript compilation (0 new errors): PASS

### Task 3: App Root Component
- WebGL detection with webgl2 fallback: PASS
- Rapier WASM init with try/catch: PASS
- State machine: loading → error (webgl/wasm) or ready: PASS
- Keyboard shortcuts: Space = toggle, R = reset: PASS
- Input guard: ignores INPUT/TEXTAREA/SELECT/contentEditable: PASS
- R key modifier check: !ctrlKey && !metaKey && !altKey: PASS
- visibilitychange auto-pause (PITFALLS #1): PASS
- 100ms setTimeout for LoadingScreen DOM render: PASS
- All sub-components imported and conditionally rendered: PASS
- TypeScript compilation (0 new errors): PASS

### Full Test Suite
- 3 test suites, 52 tests: ALL PASSING
- Vite production build: SUCCESS (2.17s)

### Pre-existing Issues (not caused by this plan)
- `frontend/src/store/api.ts` has 8 TypeScript errors due to unresolved imports (`../api`, `../types`, `./index`). These are pre-existing code from project initialization and are outside the scope of this plan. Documented in 01-01-SUMMARY.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 2 TypeScript unused variable errors in Toolbar.test.tsx**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `ReactNode` type import and `outerDiv` variable were declared but never used, causing TS6133 errors under strict mode.
- **Fix:** Removed unused `ReactNode` import; replaced unused `outerDiv` variable assignment with direct assertion.
- **Files modified:** `frontend/src/components/Toolbar.test.tsx`
- **Commit:** `2dc3d09` (included in GREEN commit)

**2. [Rule 1 - Bug] Fixed 2 DOM traversal errors in LoadingScreen.test.tsx**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Tests used `.closest('div')?.parentElement?.style` to check inline styles on outer containers, but `.closest` returned the correct div and `.parentElement` pointed to the testing-library wrapper (empty styles). Also `ErrorType` import was unused (TS6133).
- **Fix:** Changed to `textElement.parentElement?.style` for direct parent access; removed unused `ErrorType` import.
- **Files modified:** `frontend/src/components/LoadingScreen.test.tsx`
- **Commit:** `f821a21` (included in GREEN commit)

## Known Stubs

None — all files created in this plan contain fully functional implementations:
- `Toolbar.tsx`: All 7 store subscriptions wired to real state/actions; all button handlers call store directly
- `LoadingScreen.tsx`: Full visual implementation with spin animation keyframes
- `ErrorFallback.tsx`: Both error types fully configured with exact UI-SPEC copywriting
- `App.tsx`: Complete WASM init pipeline, WebGL detection, keyboard handling, visibility protection
- No TODO/FIXME/placeholder/not available/coming soon strings in any new source files

## Threat Flags

None beyond the plan's documented `<threat_model>`. All threat mitigations implemented:
- **T-01-05 (WASM init failure):** try/catch in App.tsx → renders ErrorFallback('wasm') with refresh button
- **T-01-06 (WebGL unavailability):** checkWebGL() before WASM init → renders ErrorFallback('webgl')
- **T-01-07 (Keyboard input spoofing):** Input guard filters INPUT/TEXTAREA/SELECT/contentEditable; R key validates no modifier keys
- **T-01-08 (Elevation of Privilege):** Accepted — no user data input in Phase 1

No new network endpoints, auth paths, or trust boundaries introduced.

## Commits

| Hash | Message |
|------|---------|
| `559a439` | test(01-simulation-core-3d-render): add failing tests for Toolbar component |
| `2dc3d09` | feat(01-simulation-core-3d-render): implement Toolbar component with all controls |
| `f0db91c` | test(01-simulation-core-3d-render): add failing tests for LoadingScreen and ErrorFallback |
| `f821a21` | feat(01-simulation-core-3d-render): implement LoadingScreen and ErrorFallback components |
| `bfdfcf4` | feat(01-simulation-core-3d-render): implement App root component with WASM init, keyboard shortcuts, state orchestration |

## Self-Check: PASSED

All created files verified on disk:
- `frontend/src/components/Toolbar.tsx`: FOUND
- `frontend/src/components/Toolbar.test.tsx`: FOUND
- `frontend/src/components/LoadingScreen.tsx`: FOUND
- `frontend/src/components/ErrorFallback.tsx`: FOUND
- `frontend/src/components/LoadingScreen.test.tsx`: FOUND
- `frontend/src/components/App.tsx`: MODIFIED

All commits verified in git history:
- `559a439`: FOUND
- `2dc3d09`: FOUND
- `f0db91c`: FOUND
- `f821a21`: FOUND
- `bfdfcf4`: FOUND
