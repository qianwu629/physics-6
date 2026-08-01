# Codebase Concerns

**Analysis Date:** 2026-05-24

## Tech Debt

### Stale review-fix bookkeeping: 3 "Skipped" findings target files that still exist

**Severity:** High
**Files:** `frontend/src/store/snapshotSlice.ts`, `frontend/src/components/SnapshotManager.tsx`
**Evidence:** `.planning/phases/01-持久化与场景库/01-REVIEW-FIX.md:99-117` skips CR-04, WR-03, WR-08 with the reason *"文件已删除（snapshotSlice.ts 在代码重构中被移除），无需修复。"* However, both files are still present and wired in:
  - `frontend/src/store/snapshotSlice.ts:174` (174 lines, exports `useSnapshotStore`)
  - `frontend/src/components/SnapshotManager.tsx:560` (560 lines, default export used by `frontend/src/components/App.tsx:20`)
**Impact:** Three real defects remain unresolved while the planning system believes Phase 01 is closed:
  - CR-04: `serializeEntities` (`snapshotSlice.ts:68-82`) shallow-copies each component into `comps[ctype] = comp`; any non-JSON-safe value mutates back into `localStorage`.
  - WR-03: `SnapshotManager.handleSave` mixes quick-save vs. overwrite paths.
  - WR-08: `NAME_REGEX = /^[\w\s\-\.一-鿿]{1,30}$/` (`SnapshotManager.tsx:28`) misses CJK Extension A/B, fullwidth punctuation, and has no NFC normalization → duplicate-name check can be bypassed.
**Fix approach:**
  1. Replace `comps[ctype] = comp` with `structuredClone(comp)` (with `try/catch` fallback to `JSON.parse(JSON.stringify(comp))`).
  2. Split `handleSave` into two clearly-named flows (`handleQuickSave` / `handleOverwriteSlot`).
  3. Switch to `/^[\p{L}\p{N}\s\-_.]{1,30}$/u` and normalize input with `name.normalize('NFC')` before validation.
  4. Re-open the three findings in `01-REVIEW-FIX.md` or file new ones; do not rely on the "deleted" excuse.

### Dead code: `frontend/src/store/api.ts` references non-existent modules

**Severity:** Medium
**Files:** `frontend/src/store/api.ts` (282 lines)
**Evidence:**
  - `frontend/src/store/api.ts:7-8`:
    ```
    import { scenesApi, simulationsApi, SimulationWebSocket, MessageType } from '../api'
    import type { Scene, Simulation, SimulationParameters } from '../types'
    ```
  - `frontend/src/api.ts`, `frontend/src/types.ts`, and `frontend/src/store/api.ts` consumers do not exist (`Grep "from.*store/api"` returns 0 hits in production code).
  - `STRUCTURE.md:77` already marks this as "Backend API integration (unused)".
**Impact:** File is permanently broken (would not compile if imported), creates a misleading suggestion that a backend exists, and bloats the store directory.
**Fix approach:** Delete `store/api.ts` outright; the project is documented as client-side only (`ARCHITECTURE.md:221`).

### Deprecated legacy types kept but never enforced

**Severity:** Low
**Files:** `frontend/src/simulation/types.ts` (42 lines)
**Evidence:** File header at `simulation/types.ts:1-14` marks itself `@deprecated` and says "Phase 3+ 移除". We are currently mid Phase 02/03 (charts + force fields) per `.planning/STATE.md`. Confirmed unused outside of itself (no `simulation/types` imports in `src/`).
**Fix approach:** Delete the file as part of the next housekeeping commit; the migration guide in its header is already mirrored by `ecs/types.ts`.

### `as any` escape hatches accumulating in physics-adjacent code

**Severity:** Medium
**Files:**
  - `frontend/src/components/EntityRenderer.tsx:68-69` — `(rb as any).setAngularDamping(...)` because the typed `RigidBodyAPI` (`RigidBodyRefContext.tsx:6-15`) does not yet declare `setAngularDamping`.
  - `frontend/src/components/TrajectoryRenderer.tsx:110-112` — `(entity.components.get('material') as any).color` instead of the typed `MaterialComponent`.
  - `frontend/src/components/Scene3D.tsx:103` — `(t as any).position as [number, number, number]` inside the camera-fit bounding-box loop.
  - `frontend/src/utils/sceneSerializer.ts:161-162` — defensive `(comp as any).charge = 0` patch from CR-01/01 fix.
  - `frontend/src/components/ForceFieldSystem.tsx:36` — `Array<{ entityId: string; rb: RigidBodyComponent; ref: any }>` despite WR-04 fix introducing `RigidBodyAPI`.
  - `frontend/src/components/Scene3D.tsx:84` — `React.MutableRefObject<any>` for `controlsRef` (drei OrbitControls type is exported).
**Impact:** Erodes the type safety the WR-04 (Phase 03) fix specifically tried to restore. Each `as any` is a place a future refactor will silently mis-call Rapier (already happened: see uncommitted diff `applyForce` → `addForce`).
**Fix approach:**
  1. Add `setAngularDamping` and `numColliders`/`collider(i)` to `RigidBodyAPI`.
  2. Type the camera-fit reader against `TransformComponent`.
  3. Type `controlsRef` against `import('three-stdlib').OrbitControls` (re-exported by drei).
  4. Replace `ref: any` in `ForceFieldSystem` with `RefObject<RigidBodyAPI | null>`.

### Monolithic files past comfortable maintenance size

**Severity:** Medium
**Files:**
  - `frontend/src/components/PropertyPanel.tsx` (1106 lines) — handles regular/spring/forceField editors + Vector3Field + PhysicsField in one file.
  - `frontend/src/components/CreationDialog.tsx` (626 lines).
  - `frontend/src/components/SnapshotManager.tsx` (560 lines).
  - `frontend/src/components/ForceFieldDialog.tsx` (443 lines).
  - `frontend/src/components/VectorRenderer.tsx` (429 lines, see also "Performance Bottlenecks").
  - `frontend/src/utils/sceneValidation.ts` (400 lines, all Zod schemas in one file).
**Evidence:** `find . -name "*.ts*" | xargs wc -l | sort -rn | head -10` gives counts above. `STRUCTURE.md:208-223` already flags PropertyPanel/SceneLoader/sceneValidation as split candidates.
**Impact:** High edit-conflict probability across phases; reviewers must scroll through ~1k lines to find a 5-line change.
**Fix approach:** Apply the split plan in `STRUCTURE.md:208-223`: extract `PhysicsField.tsx`, `Vector3Field.tsx`, `ForceFieldEditor.tsx`, `SpringEditor.tsx`, `RegularEntityEditor.tsx`; split `sceneValidation.ts` into `schemas/*.ts`.

### Module-level mutable state in `SceneLoader.tsx`

**Severity:** Medium
**Files:** `frontend/src/components/SceneLoader.tsx:49-70`
**Evidence:**
  ```
  let _warnings: string[] = [];
  let _bannerListeners: Array<() => void> = [];
  let _currentRequest: ConfirmRequest | null = null;
  let _nextRequestId = 1;
  let _confirmListeners: Array<() => void> = [];
  ```
  CR-03 (Phase 01) replaced the singleton resolver but kept the module-level listener arrays. `ARCHITECTURE.md:182` already calls this out under "Global state".
**Impact:** Hard to test (any test importing `SceneLoader` shares state with others), no React StrictMode safety, listeners may accumulate if a host component fails to unsubscribe.
**Fix approach:** Promote the state to a dedicated Zustand slice (e.g. `useSceneBannerStore` / `useConfirmDialogStore`); keep the imperative API by exporting wrapper functions that delegate to the store.

### `ForceField.position` lives in both `transform` and `forceField` components

**Severity:** Medium
**Files:** `frontend/src/ecs/types.ts:87-124`, `frontend/src/components/PropertyPanel.tsx` (force-field branch)
**Evidence:** `ARCHITECTURE.md:202-206` ("ForceField Position Dual Source") documents this anti-pattern; PropertyPanel updates both on every position edit (`PropertyPanel.tsx:500-661` per `03-VERIFICATION.md:52`).
**Impact:** Any code path that updates one but not the other (e.g. future drag-to-move) silently desyncs visualization vs. physics calculation.
**Fix approach:** Remove `position` from `GravityFieldComponent` / `ElectricFieldComponent` / `UniformFieldComponent` / `MagneticFieldComponent`; have `forceFieldCalc.ts` read it from the `transform` component (single source of truth).

## Known Bugs

### Uncommitted change: `applyForce` → `addForce` API rename not propagated to tests / docs

**Severity:** High
**Files:** `frontend/src/components/ForceFieldSystem.tsx:46,67-68`, `frontend/src/components/RigidBodyRefContext.tsx:7`
**Evidence:** `git diff` (uncommitted) shows `applyForce` replaced with `addForce` in production code and the JSDoc on `ForceFieldSystem.tsx:5`. However:
  - `.planning/phases/03-通用力场系统/03-VERIFICATION.md:48` still asserts "applyForce 注入" as the verified behavior.
  - `frontend/src/components/Scene3D.test.tsx` mocks `useBeforePhysicsStep` and likely refers to old API names.
  - No new commit captures the rename; it sits dirty in working tree alongside other in-progress chart work.
**Impact:** If the wrong Rapier API is being called (Rapier 2.2 actually exports `addForce` *and* `applyForce` with different semantics — `applyForce` is per-step force; `addForce` is continuous), force-field magnitudes may now be 120× too large or too small relative to the Phase 03 verification baseline.
**Fix approach:**
  1. Confirm against `@react-three/rapier` 2.2.0 typings which method is correct for per-`useBeforePhysicsStep` force injection (PLAN-03-02 says `applyForce`).
  2. If `addForce` is intentional, update `03-VERIFICATION.md`, `03-01-PLAN.md` references, and re-run `gravity-hot-swap.test.ts` + `spring-oscillator.test.ts` to verify magnitudes.
  3. If the change was accidental, revert.

### `VectorRenderer` force-field recalc cadence cranked from 0.5 s → 0.02 s

**Severity:** High (perf regression risk)
**Files:** `frontend/src/components/VectorRenderer.tsx:107`
**Evidence:** Uncommitted diff: `const shouldRecalc = lastForceCalcRef.current >= 0.5;` changed to `>= 0.02;`. ARCHITECTURE.md still describes VectorRenderer as "0.5s cached recalc" (`ARCHITECTURE.md:52`).
**Impact:** Force recalculation now runs ~50 Hz instead of 2 Hz; combined with the new force-field-summation loop at `VectorRenderer.tsx:228-253` (which calls `computeTotalForce` per entity per recalc), the worst-case cost is `50 × MAX_ENTITIES × N_fields` calls per second.
**Fix approach:** Either revert to 0.5 s and rely on the existing per-frame position update (lines 292-426), or document the new cadence in `ARCHITECTURE.md` plus add a perf benchmark for >10 entities × >5 fields.

### `visualizationStore` persisted defaults silently flipped to `true`

**Severity:** Medium
**Files:** `frontend/src/store/visualizationStore.ts:25-26`
**Evidence:** Uncommitted diff flips `showForceVectors` and `showForceLines` from `false` to `true`. Because the store uses `persist({ name: 'physis-visualization' })`, users with an existing `localStorage` entry will *not* see the new default — only fresh sessions get it. New defaults also re-enable both expensive renderers on first load, regressing perceived performance on weaker machines.
**Impact:** Inconsistent UX across users; force-line geometry mounts on first paint even before any force field exists in the scene.
**Fix approach:** Decide intentionally; if keeping `true`, bump the persist `version` and write a migration that resets old saves, or gate the defaults behind a "first-run" check.

### `EntityRenderer` `useEffect` still relies on optional-chained primitives only

**Severity:** Low
**Files:** `frontend/src/components/EntityRenderer.tsx:78-86`
**Evidence:** WR-02 (Phase 03) added `entity.id` to the dependency array, but the effect still tracks `rigidBody?.mass`, `rigidBody?.restitution`, `rigidBody?.friction` instead of the `rigidBody` object identity. If the component object reference changes but values stay identical (e.g. a snapshot roundtrip), the effect still fires only via `entity.id`. Acceptable today, but fragile if Phase 04 starts replacing entire entity instances.
**Fix approach:** Add `rigidBody` as a dependency, and memoize the object in store updates to avoid spurious reruns.

## Security Considerations

### Scene JSON import: byte-size check is now correct, but `validateSceneJSON` still uses `z.record(z.string(), z.any())` for entities

**Severity:** Medium
**Files:** `frontend/src/utils/sceneValidation.ts:251-279,303,312`
**Evidence:** WR-09 fix added per-entity `transform` presence check, and WR-01 fixed the control-char regex (`sceneValidation.ts:299-304`). But the top-level `_SceneEntitySchema` still accepts `components: z.record(z.string(), z.any())`; the stricter `EntitySchema` (declared earlier in the file) is exported but unused by `validateSceneJSON`.
**Impact:** Maliciously crafted JSON can ship oversized component bags that pass schema validation, then get filtered by `KNOWN_COMPONENT_TYPES` in `sceneSerializer.ts:38-40`. Risk is contained (unknown components are dropped) but means any "info" we report about the entity (size, IDs) operates on un-sanitized objects.
**Fix approach:** Switch `validateSceneJSON` to use the strict `EntitySchema`; treat unknown component keys as warnings rather than `any` passthroughs.

### `EntityRenderer` `as any` on `rb.collider(0)`

**Severity:** Low
**Files:** `frontend/src/components/EntityRenderer.tsx:73-77`
**Evidence:** Calls `rb.collider(0).setRestitution(...)` / `setFriction(...)` without checking that the index is in bounds or that the collider exists post-unmount.
**Impact:** Theoretical NPE during fast unmount/remount; in practice masked by the `numColliders() > 0` check, but the typed API would make this explicit.
**Fix approach:** Extend `RigidBodyAPI` with `collider(index: number): ColliderAPI | null` and check for null.

### `localStorage` quota handling exists but is silent on `snapshotSlice` corruption

**Severity:** Low
**Files:** `frontend/src/store/snapshotSlice.ts:114-126`
**Evidence:** `QuotaExceededError` is caught and surfaced, but if `localStorage` returns parseable-but-invalid JSON (e.g. user edited it manually), `zustand/persist` rehydrates a `slots` array of arbitrary shape with no validation.
**Impact:** Renaming/loading a corrupted snapshot may throw deep in component code.
**Fix approach:** Add a `migrate`/`onRehydrateStorage` hook that re-validates `slots` against a Zod schema; reset to `[null, null, null, null, null]` on failure.

## Performance Bottlenecks

### `VectorRenderer` recalculates force fields O(entities × fields) every 20 ms

**Severity:** High
**Files:** `frontend/src/components/VectorRenderer.tsx:122-127,228-253`
**Evidence:** New loop collects all `forceField` components every recalc, then `computeTotalForce` is called for every dynamic entity (lines 228-253). With the cadence change to 0.02 s, that's 50 × 50 × N_fields function calls per second worst-case.
**Impact:** Sustained CPU cost on top of `ForceFieldSystem`'s 120 Hz physics-step loop doing the same calculation. Effectively duplicate work for the visualization path.
**Fix approach:** Share the per-step force result from `ForceFieldSystem` via a module-level `Map<entityId, Vec3>` (similar to `contactForceStore.ts`), and let `VectorRenderer` read the cached value.

### `SpringRenderer` still allocates `TubeGeometry` every frame

**Severity:** Medium
**Files:** `frontend/src/components/SpringRenderer.tsx:114-149`
**Evidence:** WR-05 (Phase 03) cached the geometry in `geometryRef`, but the body still does `geometryRef.current.dispose(); geometryRef.current = new THREE.TubeGeometry(...)` every `useFrame` tick (`SpringRenderer.tsx:145-148`). The fix only collapsed two prior allocations into one.
**Impact:** 60 × N_springs `TubeGeometry` allocations per second. GPU memory thrashing on scenes with many springs (e.g. `double-spring.json` × N).
**Fix approach:** Replace `TubeGeometry` with a single allocated `BufferGeometry` whose `position` attribute is updated in place using `setNeedsUpdate`. Alternatively, use `Line2` from drei with a fixed vertex count and animate via `setPositions`.

### `ChartSampler` runs full per-tracked-entity work every frame even after 60 Hz throttle

**Severity:** Medium
**Files:** `frontend/src/ecs/ChartSampler.ts:62-152`
**Evidence:** Throttle at `ChartSampler.ts:62` returns early if under 1/60 s, but on every accepted tick it (a) collects all springs (`ChartSampler.ts:79-89`), (b) reads `trackedEntityIds` from store, (c) iterates all tracked entities calling `computeEnergy` (which internally walks springs again). Energy buffer is 12 floats × Float64Array allocated *per push*.
**Impact:** Allocates a 96-byte `Float64Array` 60× per second per tracked entity. With max 50 entities and several minutes of recording, this becomes thousands of short-lived allocations per second.
**Fix approach:** Pre-allocate a single reusable `Float64Array(METRICS_PER_ENTITY)` per `ChartSampler` instance; write into the buffer then call `push` which already does a `set` copy.

### `ForceFieldSystem` snapshot iterates entire entity Map every physics step

**Severity:** Medium
**Files:** `frontend/src/components/ForceFieldSystem.tsx:38-50`
**Evidence:** At 120 Hz, the whole `entities` Map is iterated, with two `entity.components.get` calls per entity. Allocates two arrays (`fields`, `dynamicBodies`) per tick.
**Impact:** Garbage-collection pressure: 240 short-lived arrays/sec plus inner object allocations.
**Fix approach:** Subscribe to entity-add / entity-remove events and maintain `fields` / `dynamicBodies` outside the hot loop; only re-snapshot when the entity Map mutates.

### Chart buffer memory ceiling: 52 MB per entity, no top-level cap

**Severity:** Medium
**Files:** `frontend/src/store/chartBuffer.ts:11-22`
**Evidence:** `MAX_POINTS = 500_000`, `METRICS_PER_ENTITY = 12`, both `Float64Array`s → 52 MB per entity. `ARCHITECTURE.md:186` notes this. There is no aggregate cap.
**Impact:** With `MAX_ENTITIES = 50`, the worst case is 2.6 GB resident memory — well past browser tab limits. Mitigated only by user choosing to track a few entities.
**Fix approach:** Add a global memory budget (e.g. 256 MB) and round-robin evict the oldest entity buffer when crossed; surface a UI warning before allocation.

## Fragile Areas

### `RigidBodyRefContext` registry is the de-facto entity-id ↔ Rapier-body bridge for 5 systems

**Severity:** High
**Files:**
  - `frontend/src/components/RigidBodyRefContext.tsx`
  - Consumers: `ForceFieldSystem.tsx:27`, `VectorRenderer.tsx:87`, `TrajectoryRenderer.tsx:21`, `SpringRenderer.tsx:5`, `ChartSampler.ts:36`, `Scene3D.tsx:223`
**Evidence:** Every per-frame system goes through `getRef(entityId)`. The registry has no lifecycle ownership: `EntityRenderer` `useEffect` registers/unregisters (`EntityRenderer.tsx:34-37`), but during fast tear-down, ref `current` may be `null` while `getRef` returns the still-present registry entry. Hence the defensive `typeof body.translation === 'function'` checks scattered across all consumers (`ForceFieldSystem.tsx:46,58,60`).
**Why fragile:** Any new system added that forgets these typeof checks will crash on rapid entity removal. Tests can't easily simulate the race because R3F/Rapier are heavily mocked.
**Safe modification:** When touching any frame-loop system, mirror the defensive null/typeof checks exactly as `ForceFieldSystem.tsx:55-69` does.
**Test coverage:** None — there is no test exercising registry race conditions.

### `EntityRenderer` re-runs the imperative-sync `useEffect` on every environment change

**Severity:** Medium
**Files:** `frontend/src/components/EntityRenderer.tsx:57-86`
**Evidence:** Dependencies include `restitutionScale`, `frictionScale`, `drag`. Every environment slider drag (e.g. friction multiplier) triggers `setAdditionalMass` + `setLinearDamping` + collider rewrites on *every* entity simultaneously.
**Impact:** Visible UI lag when dragging environment sliders in scenes with 20+ entities.
**Safe modification:** Move environment sync to a separate `EnvironmentSync` component that holds a single `useFrame`-throttled loop and writes to all bodies once, instead of fanning out through React reconciliation. (Also flagged in `ARCHITECTURE.md:190-194`.)

### `loadSceneWithConfirm` is the only validated entry to scene loading

**Severity:** Medium
**Files:** `frontend/src/components/SceneLoader.tsx`, `frontend/src/components/App.tsx:253-268`, `frontend/src/components/MenuBar.tsx`
**Evidence:** `CameraFitter` (`Scene3D.tsx:84-150`) is gated on `resetCounter > 0`, which is only incremented by `store.reset()` inside `loadSceneWithConfirm`. IN-06 (`01-REVIEW.md:408-419`) called this out and it was left unfixed (no IN-06 entry in `01-REVIEW-FIX.md`).
**Why fragile:** Any new load path (URL param, drag-drop) that bypasses `loadSceneWithConfirm` skips camera fit, banner reset, and `clearAllBuffers`.
**Safe modification:** Document the contract in a JSDoc on `loadSceneWithConfirm`; consider extracting `applyScene(scene)` as the canonical pure-function entry point.

## Scaling Limits

### Hard cap of 50 entities is enforced at store level only

**Severity:** Low
**Files:** `frontend/src/store/entitySlice.ts:14` (`MAX_ENTITIES = 50`)
**Evidence:** `addEntity` returns `false` past the cap; preset loading (`SceneLoader.tsx:268-361`) honors the return value after WR-04 fix.
**Limit / scaling path:** Rapier WASM can handle hundreds of bodies on desktop; the bottleneck is more likely chart buffer memory (52 MB/entity) than Rapier itself. To scale, lower `MAX_POINTS` first, then raise `MAX_ENTITIES`.

### `MAX_FILE_SIZE = 5 MB` measured in bytes (post-fix) but applied only at import

**Severity:** Low
**Files:** `frontend/src/utils/sceneSerializer.ts:37`
**Limit:** 5 MB UTF-8. Reasonable for human-authored scenes but trivial to exceed if exports start including per-entity history.
**Scaling path:** Move to a streaming JSON parser (e.g. `@streamparser/json`) if scenes ever embed time-series data.

### `chartBuffers` Map has no maximum size

**Severity:** Medium
**Files:** `frontend/src/store/chartBuffer.ts:92`
**Limit:** Bounded only by `MAX_ENTITIES × MAX_POINTS × 12 × 8 = 2.6 GB`. See "Performance Bottlenecks" entry.

## Dependencies at Risk

### React 19 + react-draggable compatibility patched with a runtime mock

**Severity:** Medium
**Files:** `frontend/src/test/setup.ts`, `frontend/package.json` (`react@^19.1.0`, `react-draggable@^4.5.0`)
**Evidence:** `TESTING.md:36` notes `setup.ts` mocks `react-dom`'s `findDOMNode` for `react-draggable` + React 19 compatibility. Production code still imports `react-draggable`; the test mock only covers `findDOMNode`.
**Risk:** `react-draggable` v4 uses `findDOMNode`, which is removed in React 19. Production builds rely on the dependency tolerating this absence; any patch release of React 19 that tightens the removal will break drag interactions.
**Migration plan:** Replace `react-draggable` with `@dnd-kit/core` or `interact.js`; both have React 19 support. Track the migration as a dedicated cleanup phase.

### Three.js 0.174 + @react-three/fiber 9 + @react-three/rapier 2.2 are pinned to narrow caret ranges

**Severity:** Medium
**Files:** `frontend/package.json:30-32`
**Evidence:** `three@^0.174.0`, `@react-three/fiber@^9.1.0`, `@react-three/rapier@^2.2.0`. R3F 9 + Rapier 2.x have shipped minor releases with subtle physics-API renames (see `applyForce` vs `addForce` ambiguity above).
**Risk:** A `npm install` regen at the wrong moment may pull a Rapier minor with renamed force APIs.
**Migration plan:** Pin exact versions for the physics stack in `package.json` until the codebase has integration tests that exercise actual WASM (not jsdom mocks).

### Tailwind v4 + shadcn ^4.6.0 require Vite plugin in alpha

**Severity:** Low
**Files:** `frontend/package.json` (`tailwindcss@^4.1.0`, `@tailwindcss/vite@^4.1.0`)
**Risk:** Tailwind v4 is a major rewrite; v4.x patches occasionally break custom config conventions. Project has no `tailwind.config.js`/`tailwind.config.ts` — relies on Vite plugin defaults.
**Migration plan:** Lock to a tested patch version; review release notes before bumping.

## Build / Tooling Concerns

### No ESLint / Prettier / Biome configuration committed

**Severity:** Medium
**Files:** repo root (no `.eslintrc*`, `.prettierrc*`, `biome.json`, `eslint.config.*`)
**Evidence:** `CONVENTIONS.md:36-37,151-158` already documents this. Formatting drifts file by file; inconsistencies noted: test file naming `.test.ts` vs `.spec.ts`, comment-divider style, default vs named exports for renderer components.
**Impact:** Reviewers spend time on style; CI cannot enforce conventions; new contributors guess.
**Fix approach:** Adopt Biome (single tool for lint+format), check in `biome.json` configured for the conventions in `CONVENTIONS.md`, add `biome check --apply` to `package.json` scripts, and gate `vite build` on it.

### `package.json` has no `test` script; coverage not configured

**Severity:** Low
**Files:** `frontend/package.json:6-9`
**Evidence:** Only `dev`, `build`, `preview` scripts. `TESTING.md:202-208` shows tests are run via `npx vitest`. Coverage reporter not configured in `vite.config.ts`.
**Impact:** Onboarding friction; CI must memorize `npx vitest run`; no automated coverage report.
**Fix approach:** Add `"test": "vitest run"`, `"test:watch": "vitest"`, `"coverage": "vitest run --coverage"`; install `@vitest/coverage-v8` and configure thresholds.

### `tsc -b` runs as part of build but `strict: true` doesn't catch project-wide `as any`

**Severity:** Low
**Files:** `frontend/tsconfig.app.json:11-13`
**Evidence:** `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` are all on, but `noImplicitAny`/`as any` casts are unaffected.
**Fix approach:** Enable `@typescript-eslint/no-explicit-any` (via Biome rule equivalent) to surface the existing escape hatches.

## Naming Inconsistencies, Dead Code, TODO/FIXME

### TODO/FIXME inventory: none found in source code

**Severity:** Low
**Files:** N/A
**Evidence:** `grep -rn 'TODO|FIXME|HACK|XXX' frontend/src --include='*.ts' --include='*.tsx'` returns 0 matches. `CONVENTIONS.md:171` notes "TODOs: minimal; tracked in planning docs rather than code."
**Impact:** Positive signal — but note that planning docs do hold pending work (e.g. unresolved review findings). Re-check this list against `01-REVIEW-FIX.md` skipped items quarterly.

### Inconsistent test file naming

**Severity:** Low
**Files:**
  - `.spec.tsx`: `frontend/src/components/__tests__/EnvironmentPanel.spec.tsx`
  - `.spec.ts`: `frontend/src/store/__tests__/simulationSlice.environment.spec.ts`, `frontend/src/store/__tests__/uiSlice.spring.spec.ts`
  - `.test.ts(x)`: ~30 other files
**Fix approach:** Pick one (recommend `.test.ts(x)`), rename existing `.spec` files in one commit, document in Biome / lint rules.

### Inconsistent default vs named exports for renderer components

**Severity:** Low
**Files:**
  - `export default function EntityRenderer` (`EntityRenderer.tsx:29`)
  - `export function VectorRenderer` (`VectorRenderer.tsx:81`)
  - `export function TrajectoryRenderer` (`TrajectoryRenderer.tsx:18`)
  - `export function ForceFieldSystem` (`ForceFieldSystem.tsx:26`)
**Fix approach:** Settle on named exports for non-page components (matches `CONVENTIONS.md:164` guidance); update `Scene3D.tsx` imports accordingly.

## Migration / Upgrade Risks

### React 19 StrictMode double-invocation untested for module-level singletons

**Severity:** Medium
**Files:** `frontend/src/store/chartBuffer.ts:92` (`chartBuffers` Map), `frontend/src/components/contactForceStore.ts:8` (`contactForceMap`), `frontend/src/ecs/Entity.ts:42` (entity counter)
**Risk:** `main.tsx` mounts `<StrictMode>` (per `ARCHITECTURE.md:167`). In dev, every component mounts twice. Module-level singletons survive both mounts and accumulate state if cleanup is not idempotent.
**Migration plan:** Run a manual StrictMode pass on each module-level mutable file; confirm `disposeBuffer` / `unregister` are idempotent. Add a unit test that mounts/unmounts `EntityRenderer` twice rapidly and asserts no leftover refs in the registry.

### TypeScript strict mode is on, but Zod schemas in `sceneValidation.ts` still allow `z.any()`

**Severity:** Low
**Files:** `frontend/src/utils/sceneValidation.ts:251-254`
**Risk:** Future TS upgrades that tighten inference from `z.any()` are unlikely, but the safety hole is real (see "Security Considerations").
**Migration plan:** Adopt strict per-component schemas (`EntitySchema`) before TS 5.8 or whichever release reduces `any` ergonomics.

### Rapier WASM major upgrade path is undocumented

**Severity:** Medium
**Files:** `frontend/package.json:14` (`@react-three/rapier@^2.2.0`)
**Risk:** Rapier 0.18 (the WASM core) has API changes between minor versions; `@react-three/rapier` wraps but doesn't shield consumers from `RigidBody.userData` semantics, force application APIs (see the in-flight `applyForce → addForce` rename), or solver iteration tunables.
**Migration plan:** Add a physics smoke test that runs against the real `@dimforge/rapier3d-compat` WASM in Playwright before bumping Rapier; current tests heavily mock `@react-three/rapier`.

## Test Coverage Gaps

### `ForceFieldSystem.tsx` has no dedicated test

**Severity:** High
**Files:** `frontend/src/components/ForceFieldSystem.tsx`
**Evidence:** `TESTING.md:260` lists it as untested. `useBeforePhysicsStep` is mocked away in `Scene3D.test.tsx` (line 26).
**Risk:** All 4 force-field formulas (gravity, electric, magnetic, uniform) interact only through this hook in production; any bug here is invisible until integration.
**Priority:** High — Phase 04 (expression-driven external forces) will extend this file directly.

### `VectorRenderer.tsx` and `TrajectoryRenderer.tsx` have no tests

**Severity:** Medium
**Files:** `frontend/src/components/VectorRenderer.tsx`, `frontend/src/components/TrajectoryRenderer.tsx`
**Evidence:** `TESTING.md:266`. `VectorRenderer.tsx` just gained a force-field branch (uncommitted) with zero test coverage.
**Priority:** Medium — visual regressions slip through; consider `@react-three/test-renderer` or Playwright visual snapshots.

### `App.tsx` has no dedicated test

**Severity:** Medium
**Files:** `frontend/src/components/App.tsx` (325 lines)
**Evidence:** `TESTING.md:265`. Coordinates WASM init, keyboard shortcuts, page visibility, snapshot drawer, and preset selector — all critical integration logic.
**Priority:** Medium — at minimum test the keyboard-shortcut handler.

### `SpringRenderer.tsx` has no dedicated test

**Severity:** Medium
**Files:** `frontend/src/components/SpringRenderer.tsx`
**Evidence:** `TESTING.md:263`. Spring math (helix point generation, `TubeGeometry` allocation in `useFrame`) is unverified.
**Priority:** Medium — Phase 06 (spring selection + stability) will refactor this file.

### `ForceFieldRenderer.tsx` and `ForceFieldLines.tsx` have no tests

**Severity:** Medium
**Files:** `frontend/src/components/ForceFieldRenderer.tsx`, `frontend/src/components/ForceFieldLines.tsx`
**Evidence:** `TESTING.md:264`. `BufferGeometry.dispose` lifecycle (added in IN-02 fix) is unverified; only thing protecting against the original leak is the new `useEffect` cleanup.
**Priority:** Medium.

### `SnapshotManager` interactions still untested after IN-01 was filed

**Severity:** High
**Files:** `frontend/src/components/__tests__/SnapshotManager.test.tsx`
**Evidence:** `01-REVIEW.md:324-345` (IN-01) catalogued 6 missing interaction tests (save validation, overwrite confirm, load, rename, delete, slot-click). `01-REVIEW-FIX.md` did not address IN-01 (it's listed in Info, not in the in-scope Fixed list).
**Priority:** High — manual QA is the only safety net for snapshot data corruption.

### No tests for `loadSceneWithConfirm` failure paths (deserialization + MAX_ENTITIES overflow)

**Severity:** High
**Files:** `frontend/src/components/SceneLoader.tsx`, `frontend/src/components/__tests__/` (no `SceneLoader.test.tsx` exists)
**Evidence:** WR-04 fix changed return semantics on partial failure, WR-05 fix added deserialize-failure handling, CR-03 fix introduced request-ID tracking. None of these new branches have unit tests.
**Priority:** High — multiple recent fixes converge here, regression risk is concentrated.

### Physics WASM integration is untestable in current setup

**Severity:** Medium
**Files:** All tests using `@react-three/rapier` mocks
**Evidence:** `TESTING.md:268`. Behavioral tests (`gravity-hot-swap.test.ts`, `spring-oscillator.test.ts`, `drag-decay.test.ts`) exist but use Nyquist-style numerical assertions rather than running real Rapier WASM.
**Priority:** Medium — add a Playwright suite that loads the actual app and verifies a single physics scenario end-to-end.

### Coverage is not measured

**Severity:** Medium
**Files:** N/A (missing `@vitest/coverage-v8` dep)
**Evidence:** `TESTING.md:202` "Not enforced (no coverage config detected)". `vite.config.ts:24-28` lacks `test.coverage` config.
**Priority:** Medium — even a 50% baseline would highlight the gaps above automatically.

---

*Concerns audit: 2026-05-24*
