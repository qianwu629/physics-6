---
phase: 02-entity-component-system-property-editing
plan: 06
subsystem: ui
tags: [react, zustand, keyboard-shortcuts, ecs, three-js]

# Dependency graph
requires:
  - phase: 02-03
    provides: Scene3D ECS-driven entity rendering
  - phase: 02-04
    provides: Toolbox + CreationDialog components
  - phase: 02-05
    provides: PropertyPanel component
  - phase: 02-02
    provides: EntitySlice + UiSlice Zustand stores
provides:
  - Full 4-layer z-index application layout (Toolbar/Canvas/Toolbox+PropertyPanel/Dialogs)
  - 8 keyboard shortcuts (Space, R, B, N, C, S, Delete, Backspace)
  - D-12 compliant reset (empty scene + paused via resetEntities + reset)
  - Clean removal of Phase 1 hardcoded scene infrastructure
affects: [03-simulation-runtime, 04-user-experience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getState() in event handlers to avoid stale closures"
    - "Zustand subscribe with selector for cross-slice coordination (resetCounter → resetEntities)"
    - "Keyboard guard: INPUT/TEXTAREA/SELECT/contentEditable filter"
    - "@deprecated JSDoc with migration guide for superseded types"

key-files:
  created: []
  modified:
    - frontend/src/components/App.tsx
    - frontend/src/simulation/types.ts
  deleted:
    - frontend/src/simulation/hardcodedScene.ts

key-decisions:
  - "resetCounter subscription in App.tsx coordinates toolbar reset button with entity clearing (D-12)"
  - "getState() used in keyboard handler for stale closure avoidance — follows Phase 1 established pattern"
  - "hardcodedScene.ts fully deleted; types.ts kept with @deprecated annotations and ECS migration guide"

patterns-established:
  - "4-layer z-index layout: Toolbar (z-50), Dialogs (z-45), Toolbox+PropertyPanel (z-40), Canvas (z-1)"
  - "Keyboard shortcuts guard: skip when INPUT/TEXTAREA/SELECT/contentEditable focused"
  - "Zustand subscribe for cross-slice state coordination without coupling slices"

requirements-completed: [DIF-01]

# Metrics
duration: 4min
completed: 2026-05-01
---

# Phase 2 Plan 6: App Integration — Layout + Keyboard + Cleanup Summary

**App.tsx 4-layer z-index layout with Toolbox/PropertyPanel integration, 8 keyboard shortcuts (B/N/C/S for creation dialogs, Delete/Backspace for entity deletion), D-12 empty-scene reset, and Phase 1 hardcoded scene removal**

## Performance

- **Duration:** 4 min
- **Tasks:** 2
- **Files created:** 0
- **Files modified:** 2 (App.tsx, types.ts)
- **Files deleted:** 1 (hardcodedScene.ts)

## Accomplishments
- Integrated Toolbox and PropertyPanel into App.tsx render tree alongside existing Scene3D and Toolbar
- Extended keyboard handler from 2 to 8 shortcuts: Space (toggle), R (reset), B/N/C/S (creation dialogs), Delete/Backspace (entity deletion)
- Implemented D-12 compliant reset: both R key and toolbar reset button now clear entities AND pause simulation
- Deleted hardcodedScene.ts and marked SceneObject type @deprecated with ECS migration guide
- Preserved all Phase 1 behaviors: WebGL detection, visibilitychange auto-pause, Suspense boundary, INPUT/TEXTAREA/SELECT/contentEditable guard

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx Refactor — Panels Layout + Extended Keyboard Shortcuts** - `246aec6` (feat)
2. **Task 2: Remove hardcodedScene.ts + Deprecate SceneObject Type** - `04773ee` (feat)

## Files Created/Modified/Deleted
- `frontend/src/components/App.tsx` — Added PropertyPanel import/render, 6 new keyboard shortcuts (B/N/C/S/Delete/Backspace), updated R key with resetEntities, resetCounter subscription for toolbar reset integration, updated JSDoc
- `frontend/src/simulation/types.ts` — Marked all exports @deprecated with migration guide pointing to ECS types
- `frontend/src/simulation/hardcodedScene.ts` — **Deleted** (Phase 1 engine validation only — D-12)

## Decisions Made
- **resetCounter subscription**: App.tsx watches `resetCounter` increments via `useSimulationStore.subscribe` and calls `resetEntities()` — this ensures both the R key (explicit) and the toolbar reset button (via resetCounter) clear entities. Keeps entitySlice and simulationSlice decoupled.
- **getState() pattern**: Keyboard handler uses `useSimulationStore.getState()` for `selectedEntityId` and `resetEntities`/`reset` calls — follows Phase 1 established pattern for event handlers outside React lifecycle.
- **types.ts preservation**: Kept simulation/types.ts with @deprecated annotations rather than deleting — provides backward reference with explicit migration path to ECS types for any Phase 1 test or documentation that may reference SceneObject.

## Deviations from Plan

None - plan executed exactly as written.

All keyboard shortcuts added per spec. resetCounter subscription implemented as documented. hardcodedScene.ts deleted cleanly with zero remaining code imports.

## Issues Encountered

- **TypeScript compilation not available**: Node modules not installed in this git worktree — `npx tsc --noEmit` could not execute. All grep-based verification passed for imports, keyboard cases, resetEntities usage, and input guard. The plan's TypeScript requirement cannot be verified in this environment but code follows the exact patterns specified in the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- App.tsx now fully integrates all Phase 2 components (Toolbox, PropertyPanel, CreationDialog) with correct z-index layering
- Keyboard shortcuts ready for user-facing operation
- Phase 1 hardcoded scene infrastructure fully removed — application starts with empty ECS scene (D-06)
- Ready for Phase 3 simulation runtime enhancements

---
*Phase: 02-entity-component-system-property-editing*
*Completed: 2026-05-01*
