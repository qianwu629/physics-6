# Coding Conventions

**Analysis Date:** 2026-05-23

## Naming Patterns

**Files:**
- Components: PascalCase + `.tsx` — e.g. `EntityRenderer.tsx`, `Scene3D.tsx`
- Hooks/utilities: camelCase + `.ts` — e.g. `useChartDataStore.ts`, `physicsCalc.ts`
- Test files: co-located with source, suffix `.test.ts` or `.spec.ts` — e.g. `Entity.test.ts`, `EnvironmentPanel.spec.tsx`
- Store slices: `[name]Slice.ts` — e.g. `entitySlice.ts`, `simulationSlice.ts`
- ECS components: PascalCase in `ecs/components/` — e.g. `Material.ts`, `Collider.ts`

**Functions:**
- Component exports: `default function ComponentName()` for page-level components; `export function Helper()` for shared helpers
- Factory functions: `create` prefix — e.g. `createSphereEntity()`, `createForceFieldEntity()`
- Store slice creators: `create` + SliceName — e.g. `createEntitySlice`, `createSimulationSlice`
- Event handlers: `handle` prefix — e.g. `handleClick`, `handleEntitySelect`
- Boolean toggles: `toggle` prefix — e.g. `toggleToolbox`, `toggleTrails`

**Variables:**
- State selectors: single letter or short noun — e.g. `(s) => s.isRunning`
- Refs: `[name]Ref` — e.g. `rigidBodyRef`, `controlsRef`
- Constants: UPPER_SNAKE_CASE for true constants — e.g. `MAX_ENTITIES`, `METRICS_PER_ENTITY`, `DEFAULT_ENVIRONMENT`
- Component-level constants: PascalCase or camelCase — e.g. `COLOR_SWATCHES`, `SHAPE_OPTIONS`

**Types:**
- Interfaces: PascalCase, descriptive — e.g. `EntitySlice`, `SimulationSlice`, `SpringConstraintParams`
- Type aliases: PascalCase — e.g. `ShapeType`, `ForceFieldKind`, `TimeWindow`
- Component props: `[ComponentName]Props` — e.g. `EntityRendererProps`, `ToolbarProps`
- Union discriminators: `kind` or `type` field — e.g. `ForceFieldComponent` discriminated by `kind`

## Code Style

**Formatting:**
- No Prettier/ESLint config files detected in project root
- Default Vite + TypeScript formatting observed
- Indent: 2 spaces
- Semicolons: used consistently
- Quotes: single quotes for strings
- Trailing commas: used in multi-line objects/arrays

**Key style observations:**
- Chinese comments for business logic; English for technical terms
- JSDoc/TSDoc on public APIs and complex functions
- Inline comments prefixed with `// ──` for section dividers
- Phase markers in comments: `// Phase 3:`, `// CR-01 fix:`, `// W-07 fix:`

## Import Organization

**Order (observed pattern):**
1. React / framework imports
2. Third-party libraries (three, zustand, zod, etc.)
3. Internal absolute imports (`@/store`, `@/ecs/types`)
4. Internal relative imports (`../store`, `./ui/button`)
5. Type-only imports grouped together

**Path Aliases:**
- `@/` maps to `./src/` — configured in `vite.config.ts` and `tsconfig.json`
- Used consistently for cross-module imports

## TypeScript Usage

**Strictness:**
- Project uses TypeScript 5.7.3
- `type` imports used explicitly: `import type { Entity } from '../ecs/types'`
- Generics used for store factories: `create<EntitySlice>()((...args) => ({...}))`
- Discriminated unions for component types: `ForceFieldComponent` = `UniformFieldComponent | GravityFieldComponent | ...`

**Type Patterns:**
- Zod schemas for runtime validation: `creationSchema`, `SceneSchema`
- `Partial<T>` for update payloads: `updateComponent(entityId, type, data: Partial<Component>)`
- `Omit<T, ...>` for factory params: `ForceFieldKindParams` uses `Omit<...>`
- `never` for exhaustive checks: `const _exhaustive: never = field`

**Defensive typing:**
- Optional chaining with fallbacks: `rb?.current`, `velocity?.linearVelocity ?? [0,0,0]`
- `as any` used sparingly for mock objects in tests and Three.js interop
- `typeof` checks for runtime guards before type assertions

## React Patterns

**Component Structure:**
- Functional components only; no class components observed
- Default exports for page/container components: `export default function App()`
- Named exports for utility components: `export function ChartSampler()`
- Props interfaces defined above component

**Hooks Usage:**
- `useRef` for imperative handles (RigidBody refs, frame counters)
- `useCallback` for event handlers passed to children
- `useMemo` for expensive computations (collider/geometry JSX)
- `useEffect` for side effects: ref registration, prop synchronization, keyboard listeners
- Custom hooks: minimal; store selectors serve most needs

**State Management:**
- Zustand for global state with slice pattern
- `useShallow` from zustand/react/shallow for object selectors
- Local `useState` for component-only UI state (drawer open/close)
- Refs for physics-frame data that must not trigger re-renders

**Memoization:**
- `useMemo` on collider JSX and geometry JSX in `EntityRenderer`
- `useCallback` on click handlers
- No `React.memo` observed on components (rely on Zustand selector granularity)

**Context:**
- `RigidBodyRefContext` for cross-component ref registry
- Minimal context usage — Zustand preferred

## Code Organization Within Files

**File structure pattern:**
1. Imports (grouped per Import Organization)
2. Constants / types
3. Helper functions / sub-components
4. Main component / export
5. Styled sub-components (if any)

**Store slice pattern (`src/store/entitySlice.ts`):**
1. JSDoc header explaining slice purpose
2. Constants (MAX_ENTITIES)
3. Interface definition
4. StateCreator implementation
5. Immutable update pattern: `new Map(state.entities)`

**Component pattern (`src/components/EntityRenderer.tsx`):**
1. Imports
2. Props interface
3. JSDoc explaining component responsibility
4. Component function with hooks in order: refs → store selectors → effects → memo → render

## Consistency Analysis

**Uniformly followed:**
- PascalCase for components, camelCase for utilities
- Co-located tests (`*.test.ts` next to source)
- Chinese comments for domain logic
- Slice pattern for Zustand stores
- Immutable Map updates in stores
- `type` keyword for type-only imports

**Inconsistencies observed:**
- Test file naming: mostly `.test.ts`, but some `.spec.tsx` (`EnvironmentPanel.spec.tsx`)
- Export style: most components use `export default`, but some use `export function` (`ChartSampler`, `ForceFieldSystem`)
- Comment style: some files use `// ── Section ──` dividers, others don't
- Mock patterns vary: some tests mock entire modules, others mock only specific exports

## Linting / Formatting Configuration

**Detected:**
- No `.eslintrc`, `.prettierrc`, `eslint.config.*`, or `biome.json` in project root
- Formatting appears to rely on editor defaults or Vite defaults
- `vite.config.ts` configures TypeScript build (`tsc -b` in build script)

**Recommendations:**
- Consider adding ESLint + Prettier config for team consistency
- No automated formatting gate detected

## Documentation Practices

**JSDoc/TSDoc:**
- Used on public APIs: store slices, utility functions, component exports
- Includes parameter types and return descriptions
- References design docs: `D-03`, `PITFALLS #6`, `RESEARCH.md`

**Inline Comments:**
- Phase markers track evolution: `// Phase 3:`, `// Phase 2:`
- Bug fix markers: `// CR-01 fix:`, `// W-07 fix:`, `// C-05 fix:`
- Architecture references: `// D-02: 地面是隐式基础设施`
- TODOs: minimal; tracked in planning docs rather than code

**README:**
- Root `README.md` exists but not analyzed in depth
- Planning docs in `.planning/phases/` contain detailed specifications

---

*Convention analysis: 2026-05-23*
