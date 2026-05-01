---
phase: 02-entity-component-system-property-editing
plan: 03
type: execute
subsystem: ECS Rendering Bridge + 3D Scene Selection
tags: [ecs, rendering, @react-three/rapier, @react-three/drei, click-selection, outlines]
depends_on: [02-02]
requires: [02-01-ecs-types, 02-02-entity-store]
provides: [02-03-ecs-renderer, 02-03-scene-refactor, 02-03-click-selection]
affects: [Scene3D.tsx, EntityRenderer.tsx, Scene3D.test.tsx]
tech-stack:
  added: [EntityRenderer (ECS-to-R3F translator), useShallow (Zustand), Outlines (drei)]
  patterns: [ECS-driven rendering, R3F event system for click selection, useShallow to prevent re-render storms]
key-files:
  created:
    - frontend/src/components/EntityRenderer.tsx
  modified:
    - frontend/src/components/Scene3D.tsx
    - frontend/src/components/Scene3D.test.tsx
decisions:
  - "ECS EntityRenderer replaces hardcoded PhysicsObject — any entity with Transform+RigidBody+Collider+Material components renders correctly"
  - "useShallow selector prevents re-render storms when entity IDs are stable (RESEARCH Pitfall 6)"
  - "onClick on mesh (not RigidBody) per RESEARCH Anti-Pattern #1 to ensure visual surface click accuracy"
  - "Outlines depthTest handled internally by drei 10.7.7 (RESEARCH Pitfall 3 verification)"

metrics:
  duration: "9m 10s"
  completed_date: "2026-05-01T16:46:45Z"
  tasks: 2
  commits: 2
---

# Phase 02 Plan 03: ECS-Driven Scene Rendering with Click Selection

将 Phase 1 硬编码的 PhysicsObject 组件替换为 ECS 驱动的 EntityRenderer，重构 Scene3D 以从 Zustand entitySlice 读取实体并渲染，实现 D-06（空场景初始状态）、D-07（3D 点击选中 + 蓝色 Outlines 高亮）和 D-01（ECS 架构驱动渲染）的集中实施。

## Tasks Executed

### Task 1: EntityRenderer — ECS Component to R3F+Rapier JSX Translator

Created `frontend/src/components/EntityRenderer.tsx` — a single component translating ECS Entity component maps into declarative @react-three/rapier JSX.

**Key implementation details:**
- Reads Entity components (transform, rigidBody, collider, velocity, material) from `entity.components` Map
- Renders Rapier `<RigidBody>` with correct `type` (dynamic/fixed), position, rotation, restitution, friction, velocity
- `<Collider>` selection via `collider.shape` switch: sphere→BallCollider, cuboid→CuboidCollider, cylinder→CylinderCollider
- Visual geometry matches collider shape: sphere→sphereGeometry, cuboid→boxGeometry, cylinder→cylinderGeometry
- `onClick` bound to `<mesh>` (not RigidBody) with `e.stopPropagation()` per RESEARCH Anti-Pattern #1
- Conditional `<Outlines>` with `color="#3b82f6"`, `thickness={0.05}`, `screenspace={false}`, `opacity={0.8}`, `angle={Math.PI}`
- T-02-01 mitigation: defensive null check returns null + console.warn for entities missing required components

**Commit:** `3b64495` — feat(02-03): create EntityRenderer

### Task 2: Scene3D Refactor — ECS-driven Entities + Click Selection + Empty Initial Scene

Rewrote `frontend/src/components/Scene3D.tsx` with three major architectural changes:

**Removed:**
- `import { INITIAL_SCENE_OBJECTS, SCENE_STATS }` from hardcodedScene
- `import type { SceneObject }` from simulation types
- `PhysicsObject` component (replaced by EntityRenderer)
- `INITIAL_SCENE_OBJECTS.map(...)` in JSX

**Added:**
- `useShallow` from `zustand/react/shallow` for entity subscription
- `EntityRenderer` import and usage via `entityEntries.map(([id, entity]) => ...)`
- Invisible mesh with `onPointerMissed={() => selectEntity(null)}` for deselection

**Preserved (unchanged):**
- Ground component (implicit infrastructure)
- FpsTracker (requestAnimationFrame-based)
- Physics config: `timeStep={1/120}`, `paused={!isRunning}`, `debug={showDebug}`, `gravity={[0,-9.81,0]}`, `interpolate={true}`
- Canvas setup, OrbitControls, Grid, GizmoHelper, lighting

**SceneInitializer** now derives `objectCount` from `entities.size` (reactive) instead of static `SCENE_STATS`.

**Commit:** `2750719` — feat(02-03): refactor Scene3D to ECS-driven rendering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `import * as THREE from 'three'` in EntityRenderer**
- **Found during:** Task 2 build verification
- **Issue:** TypeScript error TS6133 — `THREE` imported but never used (only individual type imports needed)
- **Fix:** Removed the `import * as THREE from 'three'` line from EntityRenderer.tsx
- **Files modified:** `frontend/src/components/EntityRenderer.tsx`
- **Commit:** `2750719`

**2. [Rule 3 - Missing mock] Added `Outlines` to @react-three/drei test mock**
- **Found during:** Task 2 test run
- **Issue:** EntityRenderer imports `<Outlines>` from drei, but Scene3D.test.tsx mock was missing it — resulting in undefined component error in jsdom environment
- **Fix:** Added `Outlines: () => <div data-testid="outlines" />` to the drei vi.mock
- **Files modified:** `frontend/src/components/Scene3D.test.tsx`
- **Commit:** `2750719`

**3. [Rule 1 - Bug] Updated stale test assertions for hardcoded scene objects**
- **Found during:** Task 2 test run
- **Issue:** Test "should render 14 scene objects from INITIAL_SCENE_OBJECTS" expected 11 dynamic RigidBodies; after refactoring, scene starts empty (D-06)
- **Fix:** Replaced test with "should render empty scene with no hardcoded dynamic objects (D-06)", asserting 0 dynamic bodies. Updated Ground test comment to remove stale references to INITIAL_SCENE_OBJECTS slopes/platform.
- **Files modified:** `frontend/src/components/Scene3D.test.tsx`
- **Commit:** `2750719`

## Verification Results

| Check | Result |
|-------|--------|
| EntityRenderer exported as default function | PASS |
| onClick on `<mesh>` (not RigidBody) | PASS |
| `e.stopPropagation()` in click handler | PASS |
| Conditional `<Outlines>` with correct props | PASS |
| `colliders={false}` on RigidBody | PASS |
| All three shape types (sphere/cuboid/cylinder) | PASS |
| Scene3D does NOT import from hardcodedScene | PASS |
| Scene3D does NOT reference SceneObject type | PASS |
| entityEntries.map() drives rendering | PASS |
| onPointerMissed calls selectEntity(null) | PASS |
| useShallow selector used | PASS |
| objectCount from entities.size | PASS |
| TypeScript compilation (plan files only) | PASS (0 errors) |
| All 15 Scene3D tests | PASS |
| Ground, Grid, Gizmo, Lights preserved | PASS |
| Physics config unchanged | PASS |

## Pre-existing Issues (Out of Scope)

The following pre-existing TypeScript errors exist in files outside this plan's scope (not introduced by these changes):

- `frontend/src/components/CreationDialog.tsx` — TS2322, TS6133, TS2345 errors
- `frontend/src/components/Toolbox.tsx` — TS6133 (unused `cn`)
- `frontend/src/store/__tests__/entitySlice.test.ts` — TS2353, TS2339 errors
- `frontend/src/store/api.ts` — multiple TS errors (module not found, unused vars)
- `frontend/src/store/entitySlice.ts` — TS6133 (unused `state` in resetEntities)

These will be addressed in their respective plans (02-04 for CreationDialog/Toolbox, 02-02 follow-up for entitySlice tests).

## Self-Check: PASSED

- [x] `frontend/src/components/EntityRenderer.tsx` exists
- [x] `frontend/src/components/Scene3D.tsx` modified with ECS-driven rendering
- [x] `frontend/src/components/Scene3D.test.tsx` updated (15/15 tests pass)
- [x] Commit `3b64495`: EntityRenderer created
- [x] Commit `2750719`: Scene3D refactored + test updates
