# Codebase Structure

**Analysis Date:** 2026-05-23

## Directory Layout

```
frontend/src/
├── __tests__/              # Integration and component tests
│   ├── ecs/                # ECS-related tests
│   └── physics/            # Physics behavior tests
├── components/             # React UI components
│   ├── __tests__/          # Component unit tests
│   ├── ui/                 # shadcn/ui primitive components
│   ├── App.tsx             # Root application component
│   ├── Scene3D.tsx         # R3F Canvas + Physics world
│   ├── EntityRenderer.tsx  # ECS -> R3F/Rapier translator
│   ├── SpringRenderer.tsx  # Spring constraint visualization
│   ├── ForceFieldSystem.tsx     # Physics step force injection
│   ├── ForceFieldRenderer.tsx   # Force field 3D visualization
│   ├── ForceFieldLines.tsx      # Force field line visualization
│   ├── TrajectoryRenderer.tsx   # Trail/trajectory rendering
│   ├── VectorRenderer.tsx       # Force/velocity arrow rendering
│   ├── ChartPanel.tsx           # Draggable chart panel container
│   ├── ChartCanvas.tsx          # lightweight-charts wrapper
│   ├── ChartMetricTabs.tsx      # Chart metric selector tabs
│   ├── PropertyPanel.tsx        # Entity property editor
│   ├── Toolbox.tsx              # Left-side tool buttons
│   ├── Toolbar.tsx              # Top floating control bar
│   ├── MenuBar.tsx              # Top menu bar (File/View/Help)
│   ├── EntityList.tsx           # Scrollable entity list
│   ├── SnapshotManager.tsx      # Snapshot drawer (5 slots)
│   ├── PresetSelector.tsx       # Preset scene library dialog
│   ├── SceneLoader.tsx          # Import/export/confirm utilities
│   ├── CreationDialog.tsx       # Entity creation form dialog
│   ├── SpringCreationDialog.tsx # Spring parameter dialog
│   ├── ForceFieldDialog.tsx     # Force field creation dialog
│   ├── SpringCreationBanner.tsx # Spring mode status banner
│   ├── LoadingScreen.tsx        # WASM loading splash
│   ├── ErrorFallback.tsx        # Fatal error display
│   ├── Arrow3D.tsx              # 3D arrow primitive component
│   ├── RigidBodyRefContext.tsx  # Ref registry context
│   └── contactForceStore.ts     # Module-level contact force cache
├── ecs/                    # ECS core types and logic
│   ├── __tests__/          # ECS unit tests
│   ├── components/         # Component default values
│   │   ├── Collider.ts
│   │   ├── Material.ts
│   │   ├── RigidBody.ts
│   │   ├── Transform.ts
│   │   └── Velocity.ts
│   ├── types.ts            # Component type definitions
│   ├── Entity.ts           # Entity factory functions
│   ├── ChartSampler.ts     # 60Hz physics sampling
│   ├── TrajectoryBuffer.ts # Ring buffer for trail points
│   └── forceFieldCalc.ts   # Force field physics formulas
├── lib/                    # Utility libraries
│   └── utils.ts            # cn() helper (clsx + tailwind-merge)
├── presets/                # JSON preset scene files
│   ├── double-spring.json
│   ├── free-fall-stack.json
│   ├── inclined-plane.json
│   ├── projectile.json
│   └── spring-oscillator.json
├── simulation/             # Legacy/deprecated types
│   └── types.ts            # Phase 1 scene object types (deprecated)
├── store/                  # Zustand state stores
│   ├── __tests__/          # Store unit tests
│   ├── index.ts            # useSimulationStore (merged slices)
│   ├── simulationSlice.ts  # Play/pause/reset/environment
│   ├── entitySlice.ts      # Entity CRUD
│   ├── uiSlice.ts          # UI panel/dialog state
│   ├── chartDataStore.ts   # Chart tracking config
│   ├── chartBuffer.ts      # Float64Array ring buffers
│   ├── snapshotSlice.ts    # Snapshot persistence (localStorage)
│   ├── visualizationStore.ts # Trail/vector visibility (persisted)
│   └── api.ts              # Backend API integration (unused)
├── test/                   # Test setup
│   └── setup.ts            # jsdom polyfills, vitest mocks
├── utils/                  # Domain utilities
│   ├── __tests__/          # Utility tests
│   ├── nowSeconds.ts       # Shared time helper
│   ├── physicsCalc.ts      # Energy + acceleration calculations
│   ├── sceneSerializer.ts  # Scene JSON serialize/deserialize
│   ├── sceneValidation.ts  # Zod schema validation
│   └── vectorScale.ts      # Arrow length scaling functions
├── index.css               # Global styles, Tailwind, Geist font
└── main.tsx                # React entry point
```

## Directory Purposes

**`src/components/`: React UI Components**
- Purpose: All React components that render UI or 3D scenes
- Contains: 30+ component files, shadcn/ui primitives in `ui/`
- Key files: `App.tsx`, `Scene3D.tsx`, `EntityRenderer.tsx`, `PropertyPanel.tsx`

**`src/ecs/`: Entity Component System Core**
- Purpose: Type definitions, entity factories, physics sampling, force calculations
- Contains: Type-safe component unions, factory functions, trajectory buffers
- Key files: `types.ts`, `Entity.ts`, `forceFieldCalc.ts`, `ChartSampler.ts`

**`src/store/`: Zustand State Management**
- Purpose: All application state stores
- Contains: Slice pattern stores, module-level buffer storage
- Key files: `index.ts`, `entitySlice.ts`, `simulationSlice.ts`, `chartBuffer.ts`

**`src/utils/`: Domain Utilities**
- Purpose: Serialization, validation, physics math, time helpers
- Contains: Pure functions with no React dependencies
- Key files: `sceneSerializer.ts`, `sceneValidation.ts`, `physicsCalc.ts`

**`src/lib/`: Shared Library Helpers**
- Purpose: Minimal utility wrappers
- Contains: `cn()` for Tailwind class merging

**`src/test/`: Test Infrastructure**
- Purpose: Vitest setup and polyfills
- Contains: `setup.ts` with ResizeObserver mock, react-dom mock for React 19

**`src/presets/`: Static Scene Data**
- Purpose: JSON files for preset scenes
- Contains: 5 preset scene definitions

**`src/simulation/`: Legacy Types**
- Purpose: Phase 1 deprecated types (marked @deprecated)
- Contains: Old SceneObject interface

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React application bootstrap
- `src/components/App.tsx`: Root component with init logic

**Configuration:**
- `vite.config.ts`: Vite + React + Tailwind + Vitest config
- `tsconfig.json`: TypeScript project references
- `package.json`: Dependencies (React 19, R3F 9, Rapier 2.2, Zustand 5)

**Core Logic:**
- `src/ecs/types.ts`: All component type definitions (9 component types)
- `src/ecs/Entity.ts`: Factory functions for all entity types
- `src/store/entitySlice.ts`: Entity CRUD with immutable Map updates
- `src/store/simulationSlice.ts`: Simulation control + environment

**Testing:**
- `src/test/setup.ts`: Vitest globals, jsdom environment
- Pattern: Co-located `__tests__/` directories

## Naming Conventions

**Files:**
- React components: PascalCase (`EntityRenderer.tsx`, `ChartPanel.tsx`)
- Stores/hooks: camelCase ending in Store/Slice (`entitySlice.ts`, `chartDataStore.ts`)
- Utilities: camelCase (`physicsCalc.ts`, `vectorScale.ts`)
- Types: PascalCase with Component suffix (`TransformComponent`, `RigidBodyComponent`)

**Directories:**
- kebab-case for feature grouping (`force-field-system` in planning)
- camelCase for source directories (`ecs/`, `store/`, `utils/`)

**Exports:**
- Default export for page/screen components (`export default function App`)
- Named exports for utilities and reusable components (`export function ChartCanvas`)
- Barrel file pattern: `src/store/index.ts` re-exports all stores

## Where to Add New Code

**New Feature (e.g., new constraint type):**
- Component type: `src/ecs/types.ts` (add to ComponentType union + interface)
- Entity factory: `src/ecs/Entity.ts` (add factory function)
- Renderer: `src/components/` (new `*Renderer.tsx`)
- Store action: `src/store/entitySlice.ts` (if needed)
- Validation: `src/utils/sceneValidation.ts` (add Zod schema)
- Tests: `src/ecs/__tests__/` or `src/components/__tests__/` (co-located)

**New Component/Module:**
- Implementation: `src/components/{ComponentName}.tsx`
- If ECS-related: `src/ecs/{module}.ts`

**Utilities:**
- Shared helpers: `src/utils/{name}.ts`
- React-specific helpers: `src/lib/{name}.ts`

**New Store Slice:**
- Implementation: `src/store/{name}Slice.ts`
- Registration: `src/store/index.ts` (merge into useSimulationStore)

## Special Directories

**`src/components/ui/`: shadcn/ui Primitives**
- Purpose: Radix UI wrapped components (dialog, button, input, slider, etc.)
- Generated: Yes (via shadcn CLI)
- Committed: Yes
- Files: `dialog.tsx`, `button.tsx`, `input.tsx`, `slider.tsx`, `switch.tsx`, `label.tsx`, `badge.tsx`, `separator.tsx`, `scroll-area.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `sonner.tsx`

**`__tests__/` directories:**
- Purpose: Co-located test files
- Pattern: Every major directory has a `__tests__/` subdirectory
- Files: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`

**`.planning/` (repo root):**
- Purpose: GSD phase planning documents
- Generated: Yes (by GSD workflow)
- Committed: Yes
- Contains: `phases/`, `milestones/`, `codebase/`, `todos/`

## Monolithic Files and Split Candidates

**`src/components/PropertyPanel.tsx` (~1100 lines):**
- Contains: PhysicsField, Vector3Field sub-components + full property editor for all entity types (regular, spring, forceField)
- Concern: Too many responsibilities in one file
- Split candidate: Extract `PhysicsField.tsx`, `Vector3Field.tsx`, `ForceFieldEditor.tsx`, `SpringEditor.tsx`, `RegularEntityEditor.tsx`

**`src/components/SceneLoader.tsx` (~360 lines):**
- Contains: Banner state, confirm dialog state, export/import functions, loadSceneWithConfirm, React components
- Concern: Mixes module-level state, utility functions, and React components
- Split candidate: Separate `sceneExport.ts`, `sceneImport.ts`, `confirmDialog.ts` from React components

**`src/utils/sceneValidation.ts` (~375 lines):**
- Contains: All Zod schemas for all component types + validation functions
- Concern: Large file, grows with each new component type
- Split candidate: `schemas/transform.ts`, `schemas/rigidBody.ts`, etc. or `schemas/forceField.ts`

---

*Structure analysis: 2026-05-23*
