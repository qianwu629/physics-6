# Testing Patterns

**Analysis Date:** 2026-05-23

## Test Framework

**Runner:**
- Vitest 4.1.5 — configured in `vite.config.ts`
- Config: `frontend/vite.config.ts` (lines 24-28)

```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
},
```

**Assertion Library:**
- Vitest built-in assertions (`expect`, `toBe`, `toEqual`, etc.)
- `@testing-library/jest-dom` for DOM assertions (`toBeInTheDocument`, `toHaveValue`)

**Run Commands:**
```bash
npx vitest              # Run all tests
npx vitest --watch      # Watch mode
npx vitest --coverage   # Coverage (no config detected)
```

## Setup File

**Location:** `frontend/src/test/setup.ts`

Contents:
- Imports `@testing-library/jest-dom`
- Polyfills `ResizeObserver` for Radix UI compatibility
- Mocks `react-dom` `findDOMNode` for `react-draggable` + React 19 compatibility

## Test File Organization

**Location:** Co-located with source files

**Naming:**
- `*.test.ts` — unit tests for utilities, stores, ECS
- `*.test.tsx` — component tests
- `*.spec.ts` / `*.spec.tsx` — occasional variant (e.g. `EnvironmentPanel.spec.tsx`)

**Directory pattern:**
```
src/
├── store/
│   ├── entitySlice.ts
│   └── __tests__/
│       ├── entitySlice.test.ts
│       ├── simulationSlice.environment.spec.ts
│       └── uiSlice.spring.spec.ts
├── ecs/
│   ├── Entity.ts
│   └── __tests__/
│       ├── Entity.test.ts
│       ├── types.test.ts
│       └── forceFieldCalc.test.ts
├── components/
│   ├── LoadingScreen.tsx
│   ├── LoadingScreen.test.tsx
│   └── __tests__/
│       ├── EnvironmentPanel.spec.tsx
│       └── SnapshotManager.test.tsx
├── __tests__/
│   ├── physics/
│   │   ├── gravity-hot-swap.test.ts
│   │   ├── spring-oscillator.test.ts
│   │   └── drag-decay.test.ts
│   ├── ecs/
│   │   └── ConstraintComponent.test.ts
│   └── runtime-prop-sync.test.tsx
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset store state
  });

  describe('feature area', () => {
    it('descriptive assertion', () => {
      // arrange
      // act
      // assert
    });
  });
});
```

**Patterns:**
- `beforeEach` for mock clearing and store reset
- `afterEach` for store cleanup in chart-related tests
- Nested `describe` blocks group by feature/state
- Test names in Chinese for domain tests, English for utility tests

## Mocking

**Framework:** Vitest `vi.mock()`, `vi.fn()`, `vi.spyOn()`, `vi.hoisted()`

**Common Patterns:**

Module-level mock:
```typescript
vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => <svg data-testid="icon-loader2" {...props} />,
}));
```

Store mock with mutable state:
```typescript
let storeState: StoreState;
vi.mock('../store', () => ({
  useSimulationStore: (selector: (s: StoreState) => unknown) => selector(storeState),
}));
```

Hoisted mocks (for factory variables):
```typescript
const { mockCreateChart } = vi.hoisted(() => ({
  mockCreateChart: vi.fn(),
}));
vi.mock('lightweight-charts', () => ({
  createChart: mockCreateChart,
}));
```

**What to Mock:**
- `lucide-react` icons (render as svg with data-testid)
- `@react-three/fiber` and `@react-three/rapier` (jsdom lacks WebGL)
- `three.js` classes (Vector3, Quaternion, geometries)
- `lightweight-charts` (chart library)
- Zustand stores (return controlled state object)
- `window.location` for reload behavior

**What NOT to Mock:**
- ECS entity factories (tested directly)
- Pure math/physics functions (tested directly)
- Zod schemas (tested with real validation)

## Test Types

**Unit Tests:**
- Store slices: `entitySlice.test.ts`, `simulationSlice.environment.spec.ts`, `uiSlice.spring.spec.ts`
- ECS factories: `Entity.test.ts`
- Type guards: `types.test.ts`
- Physics calculations: `forceFieldCalc.test.ts`, `physicsCalc.test.ts`
- Buffer classes: `chartBuffer.test.ts`, `TrajectoryBuffer.test.ts`

**Component Tests:**
- UI behavior: `LoadingScreen.test.tsx`, `Toolbar.test.tsx`, `EnvironmentPanel.spec.tsx`
- Dialog interactions: `creation-dialog-react19.test.tsx`, `creation-position.test.tsx`
- Chart panel: `ChartPanel.test.tsx`, `ChartCanvas.test.tsx`
- Snapshot manager: `SnapshotManager.test.tsx`

**Integration Tests:**
- Store + buffer: `ChartSampler.test.ts` (buffer + store integration)
- Serialization roundtrip: `sceneSerializer.test.ts`
- Scene validation: `sceneValidation.test.ts`

**Physics Simulation Tests (Nyquist Validation):**
- `gravity-hot-swap.test.ts` — gravity change mid-simulation
- `spring-oscillator.test.ts` — harmonic motion period verification
- `drag-decay.test.ts` — exponential velocity decay

**Regression / Smoke Tests:**
- `runtime-prop-sync.test.tsx` — EntityRenderer imperative API calls
- `runtime-prop-sync-smoke.test.ts` — file content regex verification
- `radix-react19.test.tsx` — React 19 compatibility with Radix UI

**E2E / Visual:** Not detected

## Fixtures and Factories

**Test Data:**
- `makeEntity()` helper in `runtime-prop-sync.test.tsx`
- `makeValidScene()` / `makeValidEntity()` in `sceneValidation.test.ts`
- `makeStoreState()` in `sceneSerializer.test.ts`
- `createMockEntity()` / `createMockStore()` in `snapshotSlice.test.ts`

**Factory Pattern:**
```typescript
function makeEntity(overrides?: Partial<{ mass: number; restitution: number; friction: number }>): Entity {
  const components = new Map<any, any>();
  // ... default components
  return { id: 'e1', name: 'test', components };
}
```

## Coverage

**Requirements:** Not enforced (no coverage config detected)

**View Coverage:**
```bash
npx vitest --coverage
```

## Test Count by Module

| Module | Test Files | Approx Tests |
|--------|-----------|--------------|
| Store (slices) | 6 | ~60 |
| ECS (entities/types) | 4 | ~40 |
| Components | 8 | ~80 |
| Physics (calc/validation) | 5 | ~45 |
| Serialization | 2 | ~25 |
| Chart/Buffers | 4 | ~35 |
| React 19 / Regression | 5 | ~20 |
| **Total** | **34** | **~305** |

## Common Patterns

**Async Testing:**
```typescript
await waitFor(() => {
  expect(screen.getByText('确认添加')).toBeInTheDocument();
});
```

**Error Testing:**
```typescript
expect(() => {
  buf.push(1.0, badMetrics);
}).toThrow('metrics length must be 12');
```

**Store State Reset:**
```typescript
beforeEach(() => {
  useSimulationStore.setState({
    isRunning: false,
    showDebug: false,
    fps: 0,
    objectCount: 0,
  });
});
```

**Spy on module helper:**
```typescript
const nowSpy = vi.spyOn(nowSecondsModule, 'nowSeconds').mockReturnValue(FIXED_NOW);
// ... test
nowSpy.mockRestore();
```

## Test Gaps

**Notable untested areas:**
- `ForceFieldSystem.tsx` — uses `useBeforePhysicsStep`, difficult in jsdom
- `Scene3D.tsx` — heavily mocked in `Scene3D.test.tsx` but mostly structural assertions
- `EntityRenderer.tsx` — runtime prop sync tested, but visual rendering not tested
- `SpringRenderer.tsx` — no dedicated test file
- `ForceFieldRenderer.tsx` / `ForceFieldLines.tsx` — no tests
- `App.tsx` — no dedicated test file
- `TrajectoryRenderer.tsx` / `VectorRenderer.tsx` — no tests
- Physics WASM integration — not testable in jsdom
- File I/O (import/export) — mocked but not fully exercised

**Recommended additions:**
- Visual regression tests for 3D components (Playwright or `@react-three/test-renderer`)
- Integration tests for full simulation loops
- Performance benchmarks for chart buffer operations

---

*Testing analysis: 2026-05-23*
