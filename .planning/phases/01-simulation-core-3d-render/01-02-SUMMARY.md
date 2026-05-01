---
phase: 01-simulation-core-3d-render
plan: 02
subsystem: physics-core
tags: [zustand, simulation-store, hardcoded-scene, r3f, rapier-physics, scene3d, physics-rendering]
depends_on: ["01-01"]
provides: simulation-control-store, initial-scene-data, physics-rendering-pipeline
affects: frontend/src/store/, frontend/src/simulation/, frontend/src/components/
tech-stack:
  added: [vitest 4, @testing-library/react, @testing-library/jest-dom, jsdom]
  patterns: [Zustand slice pattern, R3F declarative physics, fixed 120Hz timestep, physics-authoritative rendering]
key-files:
  created: [frontend/src/store/simulationSlice.ts, frontend/src/store/index.ts, frontend/src/simulation/types.ts, frontend/src/simulation/hardcodedScene.ts, frontend/src/components/Scene3D.tsx, frontend/src/components/Scene3D.test.tsx, frontend/src/test/setup.ts]
  modified: [frontend/package.json, frontend/package-lock.json, frontend/vite.config.ts]
decisions:
  - "Physics frame data bypasses Zustand (PITFALLS #6) — only simulation metadata (isRunning, showDebug, fps, objectCount) goes through store"
  - "Ground is implicit infrastructure (D-02) — created directly in Scene3D, not in INITIAL_SCENE_OBJECTS array"
  - "FPS tracking uses requestAnimationFrame + ref-based approach — writes to Zustand at ~2Hz (every 500ms) to avoid re-render storms"
  - "Cylinder collider args limited to [halfHeight, radius] (2 values) — shapeArgs 3-tuple truncated explicitly to avoid type mismatch"
metrics:
  duration: "~14.2 min"
  completed_date: "2026-05-01T07:25:08Z"
---

# Phase 01 Plan 02: Physics Core and 3D Rendering Layer Summary

**One-liner:** Built Zustand simulation control store, 14-object hardcoded physics scene (11 dynamic + 3 static, each with pastel color), and R3F Scene3D canvas with Rapier Physics at fixed 120Hz, 45-degree diagonal orbit camera, grid/axes helpers, ambient+directional lighting with shadows — all initial paused per D-04.

## Task Summary

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create Zustand simulation control store | `754c7a0` | Complete |
| 2 | Define hardcoded initial scene (14 objects) | `4845113` | Complete |
| 3 (RED) | Add failing tests for Scene3D component | `b566427` | Complete |
| 3 (GREEN) | Implement Scene3D with Physics/camera/helpers | `c8e3bb5` | Complete |

## Verification Results

### Task 1: Zustand Simulation Store
- `isRunning: false` (D-04: initial pause): PASS (3 occurrences)
- `showDebug: false` (D-07: debug default off): PASS
- `toggle:` action exists: PASS (2 occurrences)
- `createSimulationSlice` in simulationSlice.ts: PASS
- `createSimulationSlice` in index.ts: PASS (2 occurrences)
- `useSimulationStore` exported from index.ts: PASS
- `import from './simulationSlice'` in index.ts: PASS
- TypeScript compilation: PASS (0 new errors; 8 pre-existing errors in api.ts — out of scope)

### Task 2: Hardcoded Initial Scene
- `export interface SceneObject` in types.ts: PASS
- `export type RigidBodyKind` in types.ts: PASS
- `export type ColliderShape` in types.ts: PASS
- `INITIAL_SCENE_OBJECTS` exported: PASS
- Dynamic objects (kind: 'dynamic') >= 10: PASS (11)
- Fixed objects (kind: 'fixed') >= 3: PASS (3)
- Hex color values >= 14: PASS (18)
- Non-comment `color:` assignments = 14: PASS
- `SCENE_STATS` export: PASS
- TypeScript compilation: PASS (0 new errors)

### Task 3: Scene3D Component
- `export default function Scene3D` exists: PASS
- `timeStep={1 / 120}` fixed timestep: PASS
- `paused={!isRunning}` (D-04: initial pause): PASS
- `debug={showDebug}` (D-07: debug control): PASS
- Camera position `[12, 10, 12]` (D-05: 45-degree diagonal): PASS
- Fixed RigidBody for ground: PASS
- `useSimulationStore` subscriptions: PASS (5 occurrences)
- `INITIAL_SCENE_OBJECTS` import and mapping: PASS (2 occurrences)
- drei imports (OrbitControls/Grid/GizmoHelper): PASS
- Ambient light: PASS
- Directional lights (main + fill): PASS (2)
- GizmoHelper for RGB axes: PASS (4 occurrences)
- Background color `#0a0a0a`: PASS
- Standard gravity `[0, -9.81, 0]`: PASS
- Vitest: 15/15 tests passing: PASS
- TypeScript compilation: PASS (0 new errors)

### Pre-existing Issues (not caused by this plan)
- `frontend/src/store/api.ts` has 8 TypeScript errors due to unresolved imports (`../api`, `../types`, `./index`). These modules were referenced by pre-existing code and are outside the scope of this plan. Documented in 01-01-SUMMARY.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cylinder collider args type mismatch**
- **Found during:** Task 3 (GREEN phase)
- **Issue:** `Scene3D.tsx` line in colliderProps mapping had `args: obj.shapeArgs as [number, number]` which is an invalid type assertion from a 3-tuple to a 2-tuple. TypeScript reported TS2352.
- **Fix:** Changed to `args: [obj.shapeArgs[0], obj.shapeArgs[1]] as [number, number]` — explicitly extracts halfHeight and radius from the 3-tuple.
- **Files modified:** `frontend/src/components/Scene3D.tsx`
- **Commit:** `c8e3bb5` (included in GREEN commit)

**2. [Rule 1 - Bug] Fixed unused parameter TypeScript errors in test file**
- **Found during:** Task 3 (GREEN phase)
- **Issue:** Three mock component functions in `Scene3D.test.tsx` had unused `props` parameters: `RigidBody` (destructured `...props`), `Grid`, and `GizmoViewport`. TypeScript strict mode flagged these as TS6133 errors.
- **Fix:** Removed `...props` from RigidBody destructuring; changed `Grid(props)` and `GizmoViewport(props)` to take no parameters (they don't use them in mock implementations).
- **Files modified:** `frontend/src/components/Scene3D.test.tsx`
- **Commit:** `c8e3bb5` (included in GREEN commit)

## Known Stubs

None — all files created in this plan contain fully functional implementations:
- `simulationSlice.ts`: All store actions implemented with real logic
- `hardcodedScene.ts`: All 14 objects have complete specifications (position, shape, color, restitution)
- `Scene3D.tsx`: All 3D elements (ground, physics, camera, grid, axes, lighting) fully wired
- No TODO/FIXME/placeholder/not available/coming soon strings in any new source files

## Threat Flags

None — this plan creates no new network endpoints, auth paths, or trust boundaries beyond what was already documented in the plan's `<threat_model>`. All changes are client-side rendering components consuming the existing Rapier WASM and WebGL infrastructure. The plan's T-01-02 (WASM init failure) and T-01-03 (WebGL unavailability) mitigations are deferred to Plan 03's LoadingScreen and ErrorFallback components.

## Commits

| Hash | Message |
|------|---------|
| `754c7a0` | feat(01-simulation-core-3d-render): create Zustand simulation control store |
| `4845113` | feat(01-simulation-core-3d-render): define hardcoded initial scene with 14 objects |
| `b566427` | test(01-simulation-core-3d-render): add failing tests for Scene3D component |
| `c8e3bb5` | feat(01-simulation-core-3d-render): implement Scene3D component with Physics, camera, helpers |

## Self-Check: PASSED

All created files verified on disk:
- `frontend/src/store/simulationSlice.ts`: FOUND
- `frontend/src/store/index.ts`: FOUND
- `frontend/src/simulation/types.ts`: FOUND
- `frontend/src/simulation/hardcodedScene.ts`: FOUND
- `frontend/src/components/Scene3D.tsx`: FOUND
- `frontend/src/components/Scene3D.test.tsx`: FOUND
- `frontend/src/test/setup.ts`: FOUND

All commits verified in git history:
- `754c7a0`: FOUND
- `4845113`: FOUND
- `b566427`: FOUND
- `c8e3bb5`: FOUND
