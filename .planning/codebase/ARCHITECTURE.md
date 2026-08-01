# Architecture

**Analysis Date:** 2026-05-23

## System Overview

```text
+-------------------------------------------------------------+
|                      Editor Layer (React UI)                 |
|  Toolbar | Toolbox | PropertyPanel | MenuBar | Dialogs      |
|  `src/components/Toolbar.tsx` | `src/components/Toolbox.tsx` |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    Rendering Layer (R3F)                     |
|  Scene3D -> EntityRenderer | SpringRenderer | ForceField*   |
|  TrajectoryRenderer | VectorRenderer | ChartSampler        |
|  `src/components/Scene3D.tsx`                               |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                 Simulation Layer (Rapier WASM)               |
|  Physics (120Hz) -> RigidBody | Collider | SpringJoint      |
|  ForceFieldSystem (useBeforePhysicsStep)                     |
|  `src/components/ForceFieldSystem.tsx`                      |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    Store Layer (Zustand)                     |
|  useSimulationStore = simulationSlice + entitySlice + uiSlice|
|  useChartDataStore | useVisualizationStore | useSnapshotStore|
|  chartBuffers (module-level Float64Array)                   |
|  `src/store/index.ts` | `src/store/chartBuffer.ts`          |
+-------------------------------------------------------------+
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | WASM init coordination, keyboard shortcuts, page visibility, layout orchestration | `src/components/App.tsx` |
| Scene3D | R3F Canvas, Physics world config, camera/lighting/scene setup | `src/components/Scene3D.tsx` |
| EntityRenderer | ECS Entity -> Rapier RigidBody + Three.js mesh translator | `src/components/EntityRenderer.tsx` |
| SpringRenderer | Helix visualization + useSpringJoint constraint creation | `src/components/SpringRenderer.tsx` |
| ForceFieldSystem | Per-physics-step force injection via useBeforePhysicsStep | `src/components/ForceFieldSystem.tsx` |
| ForceFieldRenderer | InstancedMesh arrows / radial spheres for field visualization | `src/components/ForceFieldRenderer.tsx` |
| ForceFieldLines | LineSegments for field line visualization (uniform/gravity/electric/magnetic) | `src/components/ForceFieldLines.tsx` |
| TrajectoryRenderer | 30Hz trail sampling with BufferGeometry line rendering | `src/components/TrajectoryRenderer.tsx` |
| VectorRenderer | Force/velocity arrow groups with 0.5s cached recalc | `src/components/VectorRenderer.tsx` |
| ChartSampler | 60Hz physics sampling -> chartBuffer (12 metrics per entity) | `src/ecs/ChartSampler.ts` |
| ChartCanvas | lightweight-charts rendering with incremental update | `src/components/ChartCanvas.tsx` |
| PropertyPanel | Entity property editor (transform/rigidBody/collider/material/forceField) | `src/components/PropertyPanel.tsx` |
| SceneLoader | Scene import/export/confirm dialog + banner state | `src/components/SceneLoader.tsx` |

## Pattern Overview

**Overall:** ECS Variant with 4-layer separation (simulation -> rendering -> store -> editor)

**Key Characteristics:**
- Physics-authoritative rendering: Rapier drives transforms, React Three Fiber reads them
- Fixed 120Hz timestep in `<Physics timeStep={1/120}>`
- State bifurcation: control metadata in Zustand, physics frame data bypasses React (imperative refs)
- Component-driven entity behavior: Entity = id + name + Map<ComponentType, Component>
- Immutable updates in store: new Map() on every entity mutation

## Layers

**Editor Layer:**
- Purpose: User-facing UI controls and panels
- Location: `src/components/Toolbar.tsx`, `Toolbox.tsx`, `PropertyPanel.tsx`, `MenuBar.tsx`, `*Dialog.tsx`
- Contains: React components, form handling, keyboard shortcuts
- Depends on: Store layer (Zustand selectors)
- Used by: End user

**Rendering Layer:**
- Purpose: Translate ECS entities to Three.js/Rapier JSX
- Location: `src/components/Scene3D.tsx`, `EntityRenderer.tsx`, `SpringRenderer.tsx`, `*Renderer.tsx`
- Contains: R3F components, useFrame loops, visual geometry
- Depends on: Store layer (entity definitions), Simulation layer (Rapier refs)
- Used by: Editor layer (mounts in App)

**Simulation Layer:**
- Purpose: Run physics simulation at fixed timestep
- Location: `@react-three/rapier` `<Physics>`, `src/components/ForceFieldSystem.tsx`
- Contains: Rapier WASM world, rigid bodies, colliders, joints, force injection
- Depends on: Store layer (entity definitions for force field params)
- Used by: Rendering layer (reads transforms), ChartSampler (reads velocities)

**Store Layer:**
- Purpose: Authoritative scene definition and UI state
- Location: `src/store/`, `src/ecs/types.ts`, `src/ecs/Entity.ts`
- Contains: Entity Maps, environment params, UI flags, chart buffers
- Depends on: Nothing (pure data)
- Used by: All other layers

## Data Flow

### Primary Request Path (User Action -> Physics Update)

1. User clicks Toolbox button -> `openDialog('sphere')` (`src/store/uiSlice.ts:91`)
2. CreationDialog opens -> form submit -> `createSphereEntity()` -> `addEntity()` (`src/store/entitySlice.ts:47`)
3. Scene3D re-renders with new entity in `entityEntries` array (`src/components/Scene3D.tsx:274`)
4. EntityRenderer mounts `<RigidBody>` with initial props (`src/components/EntityRenderer.tsx:171`)
5. Rapier WASM creates body in physics world
6. ForceFieldSystem.useBeforeStep injects forces each physics tick (`src/components/ForceFieldSystem.tsx:29`)
7. EntityRenderer reads `ref.current.translation()` for visual sync (automatic via R3F/Rapier)

### Property Edit Path

1. User edits mass slider in PropertyPanel (`src/components/PropertyPanel.tsx:913`)
2. `updateComponent(entityId, 'rigidBody', { mass: val })` (`src/store/entitySlice.ts:93`)
3. EntityRenderer useEffect detects `rigidBody?.mass` change (`src/components/EntityRenderer.tsx:57`)
4. Calls `rb.setAdditionalMass(mass, true)` imperatively

### Chart Data Path

1. ChartSampler.useFrame runs at 60Hz when `isRunning` (`src/ecs/ChartSampler.ts:53`)
2. Reads rigidBody ref for position/velocity/mass
3. Computes energy via `computeEnergy()` + `AccelerationSmoother`
4. Writes 12-metric Float64Array to `chartBuffers` module-level Map (`src/store/chartBuffer.ts:92`)
5. ChartCanvas.refreshAll() reads from `chartBuffers` and updates lightweight-charts series (`src/components/ChartCanvas.tsx:186`)

### Scene Save/Load Path

1. MenuBar -> exportSceneToFile() (`src/components/SceneLoader.tsx:197`)
2. `serializeScene()` converts Entity Map -> JSON with component records (`src/utils/sceneSerializer.ts:55`)
3. Import: `deserializeScene()` validates with Zod -> rebuilds Entity Map (`src/utils/sceneSerializer.ts:119`)
4. `loadSceneWithConfirm()` pauses -> resets -> loads entities -> increments resetCounter (`src/components/SceneLoader.tsx:268`)

**State Management:**
- Global simulation state: `useSimulationStore` (simulationSlice + entitySlice + uiSlice)
- Chart config state: `useChartDataStore` (independent to avoid re-render storms)
- Visualization state: `useVisualizationStore` (persisted to localStorage)
- Snapshot state: `useSnapshotStore` (persisted to localStorage, 5 slots)
- Physics frame data: Module-level `chartBuffers` Map + `contactForceMap` (bypasses React)

## Key Abstractions

**Entity:**
- Purpose: Scene graph node whose behavior is determined by attached components
- Examples: `src/ecs/types.ts:130`, `src/ecs/Entity.ts`
- Pattern: ECS composition over inheritance

**Component:**
- Purpose: Typed data bag for a specific aspect of an entity
- Examples: `TransformComponent`, `RigidBodyComponent`, `ForceFieldComponent` (`src/ecs/types.ts`)
- Pattern: Discriminated union with `type` field

**RigidBodyRefContext:**
- Purpose: Share Rapier body refs across components without prop drilling
- File: `src/components/RigidBodyRefContext.tsx`
- Pattern: React Context with register/unregister/getRef API

**ChartDataBuffer:**
- Purpose: Ring buffer for time-series physics metrics
- File: `src/store/chartBuffer.ts`
- Pattern: Float64Array circular buffer, module-level singleton

## Entry Points

**Application Bootstrap:**
- Location: `src/main.tsx`
- Triggers: DOM ready
- Responsibilities: React root creation, StrictMode, mount App

**App Component:**
- Location: `src/components/App.tsx`
- Triggers: React render
- Responsibilities: WebGL detection, WASM init (via Suspense), keyboard shortcuts, layout

**Scene3D:**
- Location: `src/components/Scene3D.tsx`
- Triggers: App renders when appState === 'ready'
- Responsibilities: R3F Canvas, Physics world, entity rendering dispatch

## Architectural Constraints

- **Threading:** Single-threaded event loop. Rapier WASM runs on main thread. No Web Workers used.
- **Global state:** Module-level singletons: `chartBuffers` (`src/store/chartBuffer.ts:92`), `contactForceMap` (`src/components/contactForceStore.ts:8`), entity counter (`src/ecs/Entity.ts:42`), banner/confirm dialog state (`src/components/SceneLoader.tsx:49-63`)
- **Circular imports:** None detected. Store -> ECS types -> Entity -> components/Material is acyclic. Components -> store is one-way.
- **Physics frame data bypass:** Position/velocity data NEVER flows through Zustand. Only control metadata (isRunning, showDebug) and entity definitions (components) go through store.
- **Max entities:** Hard limit of 50 entities (`src/store/entitySlice.ts:14`) to prevent WASM memory exhaustion.
- **Chart buffer memory:** ~52 MB per entity at max capacity (500,000 points * 12 metrics * 8 bytes).

## Anti-Patterns

### Store-Physics Tight Coupling in EntityRenderer

**What happens:** EntityRenderer directly accesses `useSimulationStore` for `frictionScale`, `restitutionScale`, `drag` inside the render component, then applies them via imperative useEffect.
**Why it's wrong:** Mixes rendering concerns with environment state reading. The component has 8 dependencies in its useEffect.
**Do this instead:** Consider an EnvironmentSync component that subscribes to environment changes and applies them to all bodies globally, rather than per-EntityRenderer.

### Module-Level Mutable State for Cross-Cutting Concerns

**What happens:** SceneLoader uses module-level `_warnings`, `_confirmResolver`, `_bannerListeners` arrays for global banner/confirm dialog state.
**Why it's wrong:** Hard to test, no React lifecycle integration, potential memory leaks if listeners not cleaned.
**Do this instead:** Use a dedicated Zustand store slice or React Context for banner/confirm state.

### ForceField Position Dual Source

**What happens:** ForceField entities store `position` in both `transform` component and `forceField` component. PropertyPanel updates both on edit.
**Why it's wrong:** Risk of desynchronization if one update path is missed.
**Do this instead:** ForceField component should read position from transform component only (single source of truth).

## Error Handling

**Strategy:** Defensive programming with graceful degradation

**Patterns:**
- Invalid entity data: EntityRenderer returns `null` with console.warn if required components missing (`src/components/EntityRenderer.tsx:93`)
- NaN/Infinity in physics: `forceFieldCalc.ts` returns ZERO vector if any component invalid (`src/ecs/forceFieldCalc.ts:166`)
- Scene import failures: Zod validation with warnings + errors, non-blocking where possible (`src/utils/sceneValidation.ts`)
- Storage quota exceeded: try/catch around localStorage writes with user-facing error (`src/store/snapshotSlice.ts:114`)

## Cross-Cutting Concerns

**Logging:** Console-based only. No structured logging framework.
**Validation:** Zod schemas for forms (CreationDialog, ForceFieldDialog) and scene JSON (sceneValidation.ts)
**Authentication:** Not applicable (client-side only application)

---

*Architecture analysis: 2026-05-23*
