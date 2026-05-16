---
phase: 02-实时物理量图表
review_type: code
depth: deep
date: 2026-05-05
status: completed
diff_base: fddc92070312a0b25591e9935ab6ccab338032d5
files_reviewed: 23
findings:
  critical: 7
  warning: 9
  info: 6
---

# Phase 02 Code Review

## Summary

Phase 02 ships the four planned components (`chartBuffer`, `chartDataStore`, `physicsCalc`, `ChartSampler`, `ChartCanvas`, `ChartMetricTabs`, `ChartPanel`) and most of the unit-level logic is correct in isolation. However, the integration between writers and readers is broken in several places that the existing test suite cannot catch because tests stub timestamps with the same clock the test uses, and never actually exercise drag interactions or end-to-end "sample → chart" flow.

The most severe issues are: (1) **`ChartSampler` writes timestamps in `performance.now()/1000`, while `ChartCanvas` reads `Date.now()/1000`** — this puts data and visible range millennia apart so the chart is permanently empty in production; (2) **the Resizable+Draggable ref-share pattern is wrong** — `panelRef.current` ends up being a `Resizable` PureComponent **class instance** (not an HTMLElement), and Draggable will throw `<DraggableCore> not mounted on DragStart!` the moment the user grabs the header; (3) **separate-mode rendering is fundamentally broken** — N `<ChartCanvas>` instances all share one ref so only the last chart updates, and each chart still renders all tracked entities (no per-entity filtering); (4) **`peReferenceY` is duplicated in two stores** but only the `chartDataStore` copy is read by the sampler, so scene save/load and chart calculations diverge silently; (5) **memory and state leaks** when entities are deleted (buffer not freed, tracking flag retained); plus pre-allocated Float64Array buffers are 52 MB **each** which makes the documented 4-entity tracking cost ≈208 MB upfront.

Test coverage is adversarially weak in this phase: `ChartSampler.test.ts` does not actually mount `ChartSampler` or run `useFrame` at all — it pushes to the buffer manually and asserts on the buffer alone, giving false confidence that the sampler integrates correctly. `ChartPanel.test.tsx` checks that DOM elements exist but never simulates a drag, so the broken ref pattern slips through.

## Findings by Severity

### 🔴 Critical (7)

#### C-01: Time-base mismatch between sampler writer and chart reader → chart shows no data

- **File:** `frontend/src/ecs/ChartSampler.ts:56` ↔ `frontend/src/components/ChartCanvas.tsx:156,175,208`
- **Issue:** `ChartSampler` writes buffer timestamps as `performance.now() / 1000` (seconds since page load, e.g. ~30). `ChartCanvas` constructs its visible range and refresh window with `Date.now() / 1000` (seconds since Unix epoch, e.g. ~1.78×10⁹). The two clocks are off by ~1.78 billion seconds, so every `setVisibleRange({ from: now-5, to: now })` request points at a window where the buffer holds zero matching samples; data is also placed by lightweight-charts in 1970-01-01 + 30s while the time axis is at 2026.
- **Impact:** Production chart is permanently empty even when sampling is working. Tests don't catch this because both `chartBuffer.test.ts` and `ChartCanvas.test.tsx` push and read with the **same** `Date.now()/1000` (writer = test, not real `ChartSampler`). The historical-fix note in the prompt ("Date.now()/1000 instead of performance.now()/1000 for Unix-second timestamps") was applied only to the reader side.
- **Fix:** Pick **one** clock and use it everywhere. Recommended: `Date.now() / 1000` (UTC seconds, matches what lightweight-charts expects for `UTCTimestamp`). Change `ChartSampler.ts:56` to `const now = Date.now() / 1000;`. Also update the `chartBuffer.test.ts:156` comment from "performance.now() / 1000" to "Date.now() / 1000". Add an integration test that mounts `ChartSampler` (or simulates its push) **and** reads via `ChartCanvas`'s imperative API to catch any future drift.
- **Code:**
  ```ts
  // ChartSampler.ts:56  — currently
  const now = performance.now() / 1000;            // seconds since page load
  // ...
  buf.push(now, metrics);                          // writes ~30 to timestamps[]

  // ChartCanvas.tsx:156,175,208 — currently
  const now = Date.now() / 1000;                   // seconds since 1970-01-01
  chart.timeScale().setVisibleRange({ from: now - 5, to: now });  // ~1.78e9
  // → range and data are 1.78 billion seconds apart, nothing visible
  ```

#### C-02: Draggable receives a `Resizable` class instance as `nodeRef`, not a DOM node → throws on first drag

- **File:** `frontend/src/components/ChartPanel.tsx:52-78`
- **Issue:** `panelRef` is typed `useRef<HTMLDivElement>(null)` and passed to **both** `<Draggable nodeRef={panelRef}>` and `<Resizable ref={panelRef}>`. But `Resizable` (`re-resizable@6`) is a `PureComponent` — it does not `forwardRef`, and its `render()` explicitly **filters `'ref'` out of `extendsProps`** (`node_modules/re-resizable/lib/index.es5.js:183-200, 797-815`). So `ref` on `<Resizable>` attaches to the React class instance per default React semantics; the actual DOM is at `instance.resizable`. After mount, `panelRef.current` holds a `Resizable` instance (which has no `.ownerDocument`, `.addEventListener`, `.getBoundingClientRect` …). When the user `mousedown`s on the `.panel-header`, `DraggableCore.handleDragStart` calls `this.findDOMNode()` which short-circuits to `nodeRef.current` and then evaluates:
  ```js
  if (!thisNode || !thisNode.ownerDocument || !thisNode.ownerDocument.body) {
    throw new Error('<DraggableCore> not mounted on DragStart!');
  }
  ```
  → throws immediately because `Resizable` instance has no `ownerDocument`. Touch handlers added in `DraggableCore.componentDidMount` also silently fail (`addEvent` falls back to assigning `instance['ontouchstart']`, which is never read by the browser).
- **Impact:** Dragging the panel by its header is broken in production. Tests never simulate a `mousedown`, so they pass.
- **Fix:** Introduce a separate inner DOM ref:
  ```tsx
  const dragRef = useRef<HTMLDivElement>(null);
  // …
  <Draggable nodeRef={dragRef} handle=".panel-header" bounds="parent" cancel="…">
    <div ref={dragRef}>
      <Resizable defaultSize={…} …>
        <div className="panel-container …">…</div>
      </Resizable>
    </div>
  </Draggable>
  ```
  The wrapper `<div>` receives the real DOM node; Resizable doesn't need a ref at all (resize works via its own internal handle children). Remove the now-unused `panelRef` typing. Add a real interaction test that fires `fireEvent.mouseDown(header)` + `mouseMove` and asserts no exception.

#### C-03: Separate-mode renders one `chartCanvasRef` shared by all `<ChartCanvas>` → only last chart updates, all charts show every tracked entity

- **File:** `frontend/src/components/ChartPanel.tsx:158-166`
- **Issue:** Two design defects in the `layoutMode === 'separate'` branch:
  1. The same `chartCanvasRef` is passed to every `<ChartCanvas ref={chartCanvasRef} …>` inside the `entityArray.map()`. With React's `forwardRef`, each `useImperativeHandle` call overwrites the same `.current`; only the last-mounted instance wins. The `useEffect` rAF loop calls `chartCanvasRef.current?.refreshAll()` and therefore only refreshes the **last** entity's chart. All other charts in separate mode show only the historical data captured during the initial `setData` and never receive live updates.
  2. Each `<ChartCanvas metric={activeMetric}>` reads `trackedEntityIds` from the store and renders **every** tracked entity's series, ignoring the per-row `entityId`. So separate mode produces N identical charts, not one chart per entity.
- **Impact:** "分离模式" is non-functional: only one chart updates, and it isn't filtered to one entity. The header label `entityId` for each row is misleading. `ChartPanel.test.tsx` Test 5 only asserts the entity-name labels exist; it does not check that each chart contains exactly one entity's series, so the bug is invisible.
- **Fix:** (a) use a `Map<entityId, RefObject<ChartCanvasHandle>>` (or `useRef<Map>`) keyed by entity, fan out refresh; (b) accept an `entityIds?: string[]` prop on `ChartCanvas` that overrides the global `trackedEntityIds` when provided, and pass `[entityId]` from the separate-mode loop. Update the rAF tick to iterate the map. Add tests that assert the correct number of `addSeries` calls per chart in separate mode (`mockAddSeries` called `1 entity × 3 axes` per chart, not `N × 3`).
- **Code:**
  ```tsx
  // current — broken
  {entityArray.map((entityId) => (
    <div key={entityId} …>
      <span>{entityId}</span>                       // label says one entity
      <ChartCanvas ref={chartCanvasRef}             // shared ref → last wins
                   metric={activeMetric} />          // no entityId filter → renders ALL
    </div>
  ))}

  // proposed
  const refs = useRef(new Map<string, RefObject<ChartCanvasHandle>>());
  // tick: refs.current.forEach((ref) => ref.current?.refreshAll());
  <ChartCanvas
    ref={getOrCreateRef(refs, entityId)}
    metric={activeMetric}
    entityIds={[entityId]}                          // new prop, falls back to store
  />
  ```

#### C-04: `peReferenceY` is duplicated in two stores; only `chartDataStore`'s copy is read by `ChartSampler`, while sceneSerializer round-trips the `simulationSlice` copy

- **File:** `frontend/src/store/simulationSlice.ts:17,22,66,96` ↔ `frontend/src/store/chartDataStore.ts:11,16,34` ↔ `frontend/src/ecs/ChartSampler.ts:63` ↔ `frontend/src/utils/sceneSerializer.ts:91,140`
- **Issue:** Both `EnvironmentState.peReferenceY` (in `simulationSlice`) and `chartDataStore.peReferenceY` exist. `setPeReferenceY` is implemented in both, but `EnvironmentPanel.tsx:81-82` only writes to `chartDataStore`, and `ChartSampler.ts:63` only reads from `chartDataStore`. The `simulationSlice.setPeReferenceY` is therefore dead code — but `sceneSerializer.serializeScene` reads `state.environment.peReferenceY` (always 0 unless someone calls the dead action) and `deserializeScene` writes the loaded value back to `simulationSlice.environment.peReferenceY` (which `ChartSampler` ignores).
- **Impact:** (a) Saving a scene after the user adjusts PE reference height in EnvironmentPanel discards the user's choice → snapshot stores 0. (b) Loading a scene with `peReferenceY ≠ 0` does not change chart energy calculations. Both directions of persistence are broken silently. No test covers the cross-store path.
- **Fix:** Pick **one** source of truth. Recommendation: keep `peReferenceY` only in `simulationSlice.environment` (it is part of the physics/environment domain), have `EnvironmentPanel` write/read it from `simulationSlice`, and have `ChartSampler` read `useSimulationStore.getState().environment.peReferenceY` (or a top-level selector). Delete the duplicate field/action from `chartDataStore`. Update tests in `chartDataStore.test.ts` accordingly. Add an integration test: `setPeReferenceY(5) → saveSnapshot → loadSnapshot → expect peReferenceY === 5 && energy uses 5`.

#### C-05: `removeEntity` does not untrack or free the chart buffer → tracked-Set leak + 52 MB Float64Array leak per deleted entity

- **File:** `frontend/src/store/entitySlice.ts:57-80` and `frontend/src/store/chartBuffer.ts:14-23, 87-98`
- **Issue:** `entitySlice.removeEntity(id)` only mutates `entities` and `selectedEntityId`. It does not (a) call `useChartDataStore.getState().toggleTracking(id)` to drop the dead id from `trackedEntityIds`, nor (b) call something like `chartBuffers.get(id)?.clear(); chartBuffers.delete(id)`. Each `ChartDataBuffer` constructor allocates `Float64Array(MAX_POINTS * METRICS_PER_ENTITY) = 500_000 * 12 = 6_000_000` doubles (~48 MB) plus `Float64Array(MAX_POINTS) = 500_000` (~4 MB) — **~52 MB per entity** retained until `clearAllBuffers()` (only called on `resetCounter` change).
- **Impact:** (1) `ChartCanvas` keeps creating series for a dead entity and shows stale frozen data. (2) Every Delete-key cycle on a previously-tracked entity leaks ~52 MB until the user hits Reset; with 4 entities tracked + delete/recreate workflows, hundreds of MB can accumulate in a session. (3) Toggling tracking off via PropertyPanel only removes the id from the Set — `chartBuffers.get(id)` keeps its 52 MB. Re-enabling tracking surfaces stale historical data.
- **Fix:** In `entitySlice.removeEntity`, after deleting from `entities`, also invoke a cleanup helper:
  ```ts
  // chartBuffer.ts
  export function disposeBuffer(entityId: string): void {
    chartBuffers.delete(entityId);                  // GC the Float64Arrays
  }
  // chartDataStore.ts
  untrackEntity: (id: string) =>
    set((s) => {
      if (!s.trackedEntityIds.has(id)) return s;
      const next = new Set(s.trackedEntityIds);
      next.delete(id);
      return { trackedEntityIds: next };
    }),
  // entitySlice.removeEntity (after computing `next` / cascade):
  import { disposeBuffer } from './chartBuffer';
  // …
  for (const removedId of [id, ...cascadeRemove]) {
    useChartDataStore.getState().untrackEntity(removedId);
    disposeBuffer(removedId);
  }
  ```
  Same on `resetEntities`. Same on snapshot load (any old entity ids replaced by new ones leak today).

#### C-06: Snapshot/preset load leaks every previous chart buffer (different entity ids, no untrack/clear)

- **File:** `frontend/src/store/chartBuffer.ts:87-98` ↔ `frontend/src/components/SceneLoader.tsx` (load path) ↔ `ChartSampler.ts:43-49`
- **Issue:** Loading a snapshot or preset replaces the `entities` Map with new entities (new ids). The previous session's `chartBuffers` (keyed by old entity ids) and `trackedEntityIds` (still containing old ids) are **not** cleared because `resetCounter` is not necessarily incremented on load (and even if it were, `clearAllBuffers()` only zeroes `count` and removes Map entries — but `trackedEntityIds` is owned by `chartDataStore` and untouched). Dead buffers stay in memory; dead ids in `trackedEntityIds` cause `ChartCanvas` to addSeries for nonexistent entities.
- **Impact:** Every scene load leaks ~52 MB per previously-tracked entity. Tracked-entity count UI (`(N/4 实体)`) over-counts. ChartCanvas may try to call `chartBuffers.get(oldId)?.getAllSeriesData(metricIndex)` and successfully retrieve **stale** data from the previous scene, plotting it under the new entity's color slot.
- **Fix:** On scene-load entry, explicitly reset chart state:
  ```ts
  // SceneLoader before applying new entities
  useChartDataStore.setState({ trackedEntityIds: new Set() });
  clearAllBuffers();
  ```
  Or, more durably, key the cleanup off `resetCounter` AND scene-load events; have `chartDataStore` subscribe to `entitySlice` changes and prune ids that no longer exist.

#### C-07: `chart.update()` only emits the latest data point per refresh, but lightweight-charts rejects `update()` with a `time` older than the last visible point — silent gap or thrown error after pause/resume edge cases

- **File:** `frontend/src/components/ChartCanvas.tsx:171-204`
- **Issue:** `refreshAll` finds the buffer slice for the current window and calls `series.update(data[data.length - 1])`. lightweight-charts `update()` requires `time >= lastDataPoint.time`. After resume from a long pause, the next sample's timestamp is greater than the last drawn point — fine. **But** when the ring buffer wraps around (after MAX_POINTS hit), the "last point in the window" is `now`, while the chart's last drawn point is also `now` — passes. However when the time window is `'5s'` and the chart has data older than 5s, the slice returned is empty, no update happens, and then on the next slice the chart has a gap that update can't fill (only the new tail is appended, not interior points). Combined with C-01, the chart receives nothing; even after C-01 is fixed, this approach loses interior samples whenever rAF skips frames (e.g., heavy R3F frame).
- **Impact:** Visible gaps and possible "Cannot update oldest data, last time=…" warnings/throws on edge cases. The `try/catch` only wraps `setVisibleRange`, not `series.update`, so a throw escapes.
- **Fix:** Track `lastUpdatedTimes: Map<seriesKey, number>` per series. In `refreshAll`, after `getSeriesData(metricIndex, lastUpdatedTimes.get(key) ?? 0, now)`, iterate every NEW point and `series.update(p)`; update the watermark. Wrap in `try/catch` mirroring the timeScale catches. Better still, batch into a single `setData` (or use `series.setData` for window changes only and `series.update` per individual sample).

### 🟡 Warning (9)

#### W-01: 4-entity tracking cap is in the UI string but not enforced in the store

- **File:** `frontend/src/store/chartDataStore.ts:25-31`, `frontend/src/components/ChartPanel.tsx:103`
- **Issue:** Header reads `(${trackedEntityIds.size}/4 实体)` and architecture decisions cap at 4, but `toggleTracking` adds without bound. With 50 entities (MAX_ENTITIES) all tracked, `chartBuffers` allocates 50 × 52 MB ≈ **2.6 GB** of Float64Arrays.
- **Fix:** Enforce cap in `toggleTracking`:
  ```ts
  toggleTracking: (id) =>
    set((s) => {
      const next = new Set(s.trackedEntityIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 4) return s;             // hard cap, surface toast in caller
        next.add(id);
      }
      return { trackedEntityIds: next };
    }),
  ```
  Have `PropertyPanel` show a toast when toggleTracking is rejected.

#### W-02: `cancel=".react-resizable-handle, button, .panel-body"` does not actually exclude re-resizable's drag handles

- **File:** `frontend/src/components/ChartPanel.tsx:56`
- **Issue:** `re-resizable@6` does not assign the class `react-resizable-handle` to its handles by default — that's the convention from `react-resizable`, a different library. Inspecting the rendered DOM shows handles are unstyled `<div>` children of a wrapper `<div>` with no class. So when the user drags a resize edge/corner, Draggable simultaneously interprets it as a panel drag and Resizable interprets it as a resize, leading to fighting transforms.
- **Fix:** Pass `handleClasses={{ right: 'panel-resize-handle', bottom: 'panel-resize-handle', bottomRight: 'panel-resize-handle' }}` to `<Resizable>` and update `cancel=".panel-resize-handle, button, .panel-body"` accordingly. Add a test that simulates a `mousedown` on the resize corner and asserts the panel's transform doesn't change.

#### W-03: `ChartSampler.test.ts` is misleadingly named — it does not mount `ChartSampler` or run `useFrame`

- **File:** `frontend/src/ecs/__tests__/ChartSampler.test.ts:17-196`
- **Issue:** Despite the file name and `describe('ChartSampster (buffer + store integration)'`, every test manually calls `getOrCreateBuffer(id).push(…)` and asserts on the buffer; the actual `ChartSampler` React component is never rendered, no `useFrame` callback is exercised, and the energy/spring/accel pipeline is not invoked. Test 1 ("should not write … when not running") asserts `getCount() === 0` after explicitly pushing nothing, which is tautological. The C-01 time-base bug, the wrong-clock issue, and the integration with `RigidBodyRefContext` are all uncovered.
- **Fix:** Rename to `chartBuffer-store.integration.test.ts`. Write an actual `ChartSampler` test: render `<Canvas><ChartSampler /></Canvas>` with a mocked `useFrame` (or with R3F testing utilities), inject mock RigidBody refs via `RigidBodyRefContext`, advance frames manually, and assert that buffer timestamps, accel smoothing, and spring PE are correct. At minimum, add an end-to-end test that verifies the time scale agrees between the sampler-pushed timestamps and the visible-range queries.

#### W-04: `ChartCanvas` Test 3 silently relies on the same `Date.now()/1000` clock the writer uses → cannot detect C-01

- **File:** `frontend/src/components/__tests__/ChartCanvas.test.tsx:117-146`
- **Issue:** The test pushes `buf.push(Date.now() / 1000 - 5, metrics)` and then expects `refreshAll` to call `series.update`. Since the test uses `Date.now()/1000` for both writer and reader, the chart's `getSeriesData(metricIndex, now-30, now)` slice is non-empty and the assertion passes. But the production writer (`ChartSampler.ts:56`) uses `performance.now()/1000` — the test is unable to reveal that mismatch.
- **Fix:** Use the **production** writer in this test: import `ChartDataBuffer` and **also** use the same time function as `ChartSampler`. Or, inject a clock abstraction: have `ChartSampler` and `ChartCanvas` both call a shared `nowSeconds()` helper that the test can spy on. Then verify a single source of truth.

#### W-05: `ChartPanel.test.tsx` "separate vs overlay" test does not assert series count per chart

- **File:** `frontend/src/components/__tests__/ChartPanel.test.tsx:88-108`
- **Issue:** The test only asserts `screen.getByText('e1')` and `screen.getByText('e2')` exist when `layoutMode='separate'`. It does not verify that each ChartCanvas filters to a single entity, nor that all charts receive refresh ticks. C-03 hides behind this gap.
- **Fix:** Mock `lightweight-charts` in this test (as the ChartCanvas test already does) and assert `mockAddSeries.mock.calls.length === entityArray.length × axes.length × N_charts` — should be `N × 3` total, not `N × 3 × N`.

#### W-06: `ChartCanvas` init `useEffect` deps are `[]` — `metric` change is handled, but a deferred prop change to e.g. theme/color mapping would silently keep the stale chart

- **File:** `frontend/src/components/ChartCanvas.tsx:61-104`
- **Issue:** Hardcoding `[]` is fine today because `createChart` doesn't depend on `metric`. But the colors/names/indices `Record` lookups are coupled to `metric`, and the chart's `layout`/`grid` is hardcoded. If a future change parameterizes the chart background with `metric` or adds a `theme` prop, the stale chart instance won't reflect it. Document the assumption with a comment, or move to `useMemo` over chart options + `chart.applyOptions(opts)` on prop changes.
- **Fix:** Add `// eslint-disable-next-line react-hooks/exhaustive-deps -- chart instance is mount-scoped; updates flow through applyOptions in a separate effect` and centralize options in a memo so theme changes can dispatch via `applyOptions`.

#### W-07: `physicsCalc.computeEnergy` uses `Math.abs(gravityY)` — flips PE sign for upward gravity environments

- **File:** `frontend/src/utils/physicsCalc.ts:56`
- **Issue:** `peGravity = mass * Math.abs(gravityY) * (pos.y - peReferenceY)` always treats height-above-reference as positive PE. With non-default gravity like `[0, +5, 0]` (upward), going UP should *decrease* PE; the formula gives the wrong sign and would violate energy conservation in those configurations. The energy-conservation test in `physicsCalc.test.ts:155` only tests with `gravityY = 0` and gravity-only with `gravityY = -9.81`, so the sign bug is not exercised.
- **Fix:** Use the signed gravity component:
  ```ts
  // PE = -m * g · h, where g is a vector and h is height vector.
  // For 1-D vertical gravity:
  const peGravity = -mass * gravityY * (pos.y - peReferenceY);
  // gravityY = -9.81 → peGravity = +9.81 * m * h  (positive when h > 0) ✓
  // gravityY = +5    → peGravity = -5    * m * h  (negative when h > 0) ✓
  ```
  Add a test case with `gravityY = +5, y = 5, peRef = 0 → expected peGravity = -25 J`.

#### W-08: `getSeriesData` and `getAllSeriesData` always iterate all `count` entries — `O(N)` per call × 60 fps × 4 entities × 3 axes = ~360 M ops/sec at full buffer

- **File:** `frontend/src/store/chartBuffer.ts:42-74`
- **Issue:** Linear scan of up to 500 K entries per series per frame. Marked Warning rather than Critical because v1 explicitly excludes performance findings, but this becomes correctness-adjacent: when the main thread saturates, rAF gets throttled below sampling rate, gaps appear (see C-07), and the user perceives lag.
- **Fix:** Maintain a sorted-time index or remember `firstFresh`/`lastFresh` heads per series. For window queries, binary-search the timestamps array (it's monotonic non-decreasing in chronological order — wrap-around can be handled with two sub-arrays). Even a simple "skip until t ≥ startTime" early-exit (since timestamps are monotonic) cuts most iterations.

#### W-09: `seriesMapRef` cleanup on `chart.remove()` uses `.clear()` only — but the **unused-keys removal loop** mutates the Map while iterating

- **File:** `frontend/src/components/ChartCanvas.tsx:142-148`
- **Issue:** `for (const [key, series] of seriesMapRef.current) { … seriesMapRef.current.delete(key); … }` mutates a `Map` during iteration. JavaScript spec allows this for `Map`, but it is fragile and easily breaks on refactor (e.g. switch to `Array.from(seriesMap.entries()).forEach(…)`). Also, removing the entry mid-loop is correct now but breaks if someone adds a new entry inside the same loop (it would visit the new entry and could try to remove it as "untracked").
- **Fix:** Buffer the keys to remove first, then mutate:
  ```ts
  const toRemove: string[] = [];
  for (const [key, series] of seriesMapRef.current) {
    if (!currentKeys.has(key)) toRemove.push(key);
  }
  toRemove.forEach((key) => {
    const s = seriesMapRef.current.get(key);
    if (s) chart.removeSeries(s);
    seriesMapRef.current.delete(key);
  });
  ```

### 🔵 Info (6)

#### I-01: Unused `Suspense` import in `App.tsx`

- **File:** `frontend/src/components/App.tsx:1, 233`
- **Issue:** `Suspense` is imported and there's a comment "CR-01 fix: Suspense 边界捕获 @react-three/rapier 的 WASM 加载挂起状态", but the JSX returned for `appState === 'ready'` never wraps anything in `<Suspense>`. The comment is therefore stale, and the WASM loading suspense it claims to handle is not actually handled here.
- **Fix:** Either wrap `<Scene3D />` in `<Suspense fallback={<LoadingScreen />}>` (probably the intent) or remove the import + comment.

#### I-02: Dead-code branch in `deserializeScene` for unknown component types

- **File:** `frontend/src/utils/sceneSerializer.ts:155-160`
- **Issue:** `validateSceneJSON` already filters unknown component types with `delete entity.components[ut]` (`sceneValidation.ts:261-265`). By the time `deserializeScene` iterates `Object.entries(serializedEntity.components)`, no unknown keys remain — the `if (!KNOWN_COMPONENT_TYPES.has(key)) { warnings.push(…); continue; }` block is unreachable in normal flow.
- **Fix:** Delete the unreachable branch or move the unknown-type filtering out of `validateSceneJSON` (single source of truth in `deserialize`). Either is fine; not having two filtering points makes Test 8 deterministic.

#### I-03: `ChartCanvas` `useImperativeHandle` `setTimeWindow` duplicates the body of the `timeWindow` `useEffect`

- **File:** `frontend/src/components/ChartCanvas.tsx:152-220`
- **Issue:** The `useEffect` at 152-168 and the imperative `setTimeWindow` at 205-220 both compute `now = Date.now()/1000` and call the same three `setVisibleRange`/`fitContent` branches. Since the imperative API is invoked by `ChartPanel.handleTimeWindowChange` *after* the store updates `timeWindow`, the `useEffect` will fire for the same change one tick later — the imperative call is redundant.
- **Fix:** Remove the imperative `setTimeWindow` API (or remove the `useEffect`) — keep one source of truth. If a synchronous response is required (avoid one-frame lag on window switch), keep the imperative path and remove the `useEffect`.

#### I-04: `chartBuffer.test.ts:156` comment claims `performance.now()` semantics but the buffer is just a number

- **File:** `frontend/src/store/__tests__/chartBuffer.test.ts:155-164`
- **Issue:** The describe block "time unit" / "uses seconds as time unit (performance.now() / 1000)" is misleading. The buffer is clock-agnostic — it just stores whatever `number` the writer pushes. The comment gives a false impression that the buffer enforces `performance.now()` semantics, which makes C-01's mismatch harder to notice during code review.
- **Fix:** Update the comment to "expects writer to consistently use seconds since some monotonic origin (currently `Date.now()/1000`); buffer makes no assumption about the origin."

#### I-05: `simulationSlice.setPeReferenceY` is dead code (see C-04)

- **File:** `frontend/src/store/simulationSlice.ts:96`
- **Issue:** Standalone Info to track once C-04 is resolved. If the architectural decision is to centralize on `chartDataStore`, remove the `simulationSlice` action and `EnvironmentState.peReferenceY`. If the decision is the other way, remove `chartDataStore.peReferenceY`/`setPeReferenceY`.

#### I-06: `Date.now()` floating-point precision warning for `update()` time keys

- **File:** `frontend/src/components/ChartCanvas.tsx:156, 175, 208` (after C-01 fix)
- **Issue:** `Date.now()` is millisecond precision; dividing by 1000 yields seconds with up to 3 fractional digits but JavaScript Number has ~15-17 significant digits. With `Date.now()` ~ `1.78e12 ms`, that leaves 4-5 fractional digits of precision before catastrophic loss. lightweight-charts treats `UTCTimestamp` as integer seconds and uses fractional parts for sub-second precision (introduced in v4+). Be aware that two samples within the same millisecond will produce identical `time` values, which `series.update()` will treat as "update last point", silently dropping the older one. With 60 Hz sampling, this is fine (16.7 ms apart). Document the assumption.
- **Fix:** Add a JSDoc on the `time:` field of pushed metrics describing precision expectations, or use `performance.timeOrigin + performance.now()` for higher-precision Unix-millisecond floats — but only after picking one clock per C-01.

## Cross-file Analysis

### Data flow verification

**Write path:** `Scene3D.tsx → <ChartSampler />` (inside `<Physics>` Provider so `RigidBodyRefContext` is available) → `useFrame` callback at 60 Hz → reads `getRef(entityId)` (`RigidBodyRefContext` registered by `EntityRenderer`) → calls `rb.linvel()`, `rb.translation()`, `rb.mass()` → `AccelerationSmoother.push` + `getSmoothedAcceleration(SAMPLE_INTERVAL)` → `computeEnergy(rb, mass, gravity[1], peReferenceY, springs, getEntityPosition)` → assembles 12-element `Float64Array` → `getOrCreateBuffer(entityId).push(now, metrics)`.

**Read path:** `ChartPanel`'s rAF tick → `chartCanvasRef.current.refreshAll()` → for each tracked entity × current-metric axis: `chartBuffers.get(entityId).getSeriesData(metricIndex, startTime, endTime)` → `series.update(lastPoint)`.

**Verified consistent:**
- `METRIC_INDICES` agrees between `physicsCalc` (writes 0-11), `ChartSampler` (assembles 0-11), `ChartCanvas` (reads via `[0,1,2]/[3,4,5]/[6,7,8]/[9,10,11]`).
- `METRICS_PER_ENTITY = 12` enforced by `ChartDataBuffer.push` length check.
- Ring-buffer wrap-around order is correct in `getAllSeriesData` (test at `chartBuffer.test.ts:193-211` covers chronological order after wrap).

**Verified inconsistent (BLOCKERS):**
- **Time base:** writer uses `performance.now()/1000`, reader uses `Date.now()/1000` — see C-01.
- **`peReferenceY` source of truth:** writer reads `chartDataStore.peReferenceY`, persistence reads `simulationSlice.environment.peReferenceY` — see C-04.

### Resource lifecycle

| Resource | Created at | Cleaned at | Status |
|---|---|---|---|
| `IChartApi` | `ChartCanvas` mount `useEffect[]` | `chart.remove()` in cleanup | ✅ |
| `ResizeObserver` | `ChartCanvas` mount | `ro.disconnect()` in cleanup | ✅ |
| `ISeriesApi` | `ChartCanvas` series-add effect | implicit via `chart.remove()` (or explicit `chart.removeSeries` on tracked-set diff) | ✅ |
| `ChartSampler` rAF | shared with R3F `useFrame` (no manual rAF) | unregistered when `<ChartSampler>` unmounts | ✅ |
| `ChartPanel` rAF | `useEffect[open, activeMetric]` `requestAnimationFrame` | `cancelAnimationFrame(rafId)` | ✅ |
| `chartBuffers` Map entries | `getOrCreateBuffer(entityId)` on first push | only `clearAllBuffers()` on `resetCounter` change | 🔴 leaks on entity removal (C-05) and snapshot/preset load (C-06) |
| `smootherMap` Map entries | first sample of entity | only on `resetCounter` change | 🔴 leaks on entity removal (same as buffers) |
| `trackedEntityIds` Set entries | toggleTracking | only on explicit untoggle | 🔴 retains dead ids after `removeEntity` (C-05) |
| Window/document keydown listeners (`App.tsx`) | mount | unmount | ✅ |
| Document visibilitychange (`App.tsx`) | mount | unmount | ✅ |

### Decision compliance matrix

| Decision | Compliant | Notes |
|---|---|---|
| D-02-01 (lightweight-charts as engine) | ✅ | `lightweight-charts@^5.2.0`, `addSeries(LineSeries, …)` v5 API used. |
| D-02-04 (60 Hz rAF sampling, share R3F `useFrame`) | ✅ | `ChartSampler` uses `useFrame`; throttles to 60 Hz via `lastSampleTime`. |
| D-02-05 (MAX_POINTS=500_000, ~10 min @ 60 Hz) | ✅ structurally | But upfront `Float64Array(6_000_000)` ≈ 48 MB **per entity** allocated immediately on first push, regardless of accumulated data. With 4-entity cap that's ~208 MB always-on. Confirmed buffer wraps correctly (chartBuffer.test.ts test "wrap-around ordering"). |
| D-02-06 (chartDataStore is config-only; data via ref + imperative API) | ✅ partially | `chartBuffer` is module-level (correct). However, `peReferenceY` was placed in `chartDataStore` — duplicates `simulationSlice.environment.peReferenceY` and breaks scene-load consistency (C-04). |
| D-02-07 (Pause freezes sampling, reset clears buffers) | ✅ | `useFrame` early-returns on `!isRunning`; `useEffect[resetCounter]` calls `clearAllBuffers()` and `smootherMap.clear()`. |
| D-02-09 (Tracking opt-in via PropertyPanel) | ✅ | `PropertyPanel.tsx:512-515` toggle. But the 4-entity cap is implied in UI text only (W-01). |
| (implicit) Time base consistent across writer/reader | 🔴 | C-01: writer `performance.now()/1000`, reader `Date.now()/1000`. |
| (implicit) Resizable+Draggable React-19 ref pattern | 🔴 | C-02: `panelRef.current` is the Resizable React class instance, not the DOM node. The historical fix did not actually fix the issue. |

### Race / timing concerns

- **Pause/Reset coordination:** `ChartSampler` reads `useChartDataStore.getState().trackedEntityIds` inside `useFrame` so a tracking toggle takes effect on the next frame. `entities` is read via the hook (causes re-render and `useFrame` callback rebind). `gravity` from `useSimulationStore` similarly. The `lastSampleTime` is not reset on `play()` (only on remount); a long pause means the first post-pause frame writes a sample with the new `now` — that is correct (gap shows in chart). No deadlock, no race detected on pause/resume. The reset path increments `resetCounter` synchronously but the `Physics` key change is deferred 500 ms (`Scene3D.tsx:181-186`); `ChartSampler.useEffect[resetCounter]` runs **before** the deferred remount, so buffers are cleared in time. ✅

- **physicsKey delayed remount and `ChartSampler` remount:** When `physicsKey` ticks, `ChartSampler` unmounts/remounts as a child of `<Physics key=…>`. On remount, `prevResetCounter.current = useRef(resetCounter)` initializes to current value — no re-clear. Buffers were already cleared by the original (pre-remount) effect, so this is correct. ✅

### Memory

- Each `ChartDataBuffer` pre-allocates `8 * (500_000 * 12 + 500_000) = 52 MB` upfront. Documented design (D-02-05).
- 4 tracked entities = ~208 MB Float64Array footprint regardless of how full the rings are.
- Without C-05/C-06 fixes, every `Delete` key on a tracked entity and every snapshot load adds ~52 MB indefinitely until manual Reset.
- `smootherMap` retains a small Float64Array(15) per entity — negligible compared to the ring buffer leak.

### React 19 specific

- The `nodeRef` workaround for `findDOMNode` removal **is the right approach** but the implementation is wrong: `Resizable` is a class component without `forwardRef`, so `ref` on it returns the class instance, not the DOM. See C-02 for the proper pattern (separate inner `<div ref={dragRef}>`).
- The `vi.mock('react-dom', …)` polyfill in test setup is not engaged in the production rendering path (only `findDOMNode` calls go through it). Even with `nodeRef`, react-draggable short-circuits to `nodeRef.current` and never asks the polyfill — so the polyfill cannot rescue C-02.
- `useImperativeHandle` deps `[trackedEntityIds, metric, timeWindow]` are correct for React 19's stricter scheduling — every closure-captured value is in the deps.

### Test quality

- **`ChartSampler.test.ts`** does not mount the component and does not test sampling logic (W-03).
- **`ChartCanvas.test.ts`** uses `Date.now()/1000` for both writer and reader, masking the production writer's wrong clock (W-04).
- **`ChartPanel.test.tsx`** verifies DOM structure but not interaction (no drag/resize fireEvents) and not series count per chart in separate mode (W-05). Test 6 only asserts `cursor-move` class exists; it does not assert that a `mousedown` doesn't throw.
- `chartBuffer.test.ts` is solid — `MAX_POINTS` overflow, wrap-around, 12-metric layout, and clear are all covered. Most reliable test in the phase.
- `chartDataStore.test.ts` is solid for the store actions in isolation, but no test covers the cross-store `peReferenceY` aliasing (C-04).
- `physicsCalc.test.ts` covers KE, gravity PE (with `gravityY = -9.81`), spring PE, and a 30 s spring-oscillator energy-conservation check at 120 Hz with < 5 % drift. Does not cover gravityY > 0 (W-07) or PE reference change.

## Recommendations

1. **Top priority: fix C-01 (time base) and C-02 (Draggable ref).** Both are runtime-broken in production despite all 23 files compiling and 100 % of tests green. Add at minimum (a) one integration test that mounts `<Canvas><ChartSampler /></Canvas>`, advances frames, and renders `<ChartCanvas>` to assert that the slice returned by `getSeriesData(now-5, now)` is non-empty; (b) one user-event test in `ChartPanel.test.tsx` that fires `mouseDown` + `mouseMove` on `.panel-header` and expects no thrown error (use `await user.pointer(...)` from `@testing-library/user-event`).

2. **Deduplicate `peReferenceY` (C-04) and add a buffer-disposal contract (C-05/C-06).** Pick one store (recommend `simulationSlice.environment` for ECS/persistence consistency); have `EnvironmentPanel` and `ChartSampler` both read it from there; remove the `chartDataStore` copy. Add `chartBuffer.disposeBuffer(id)` and call it from `entitySlice.removeEntity`/`resetEntities`/`SceneLoader` together with `chartDataStore.untrackEntity(id)`. Add a regression test: track entity, push samples, removeEntity, expect `chartBuffers.has(id) === false` and `trackedEntityIds.has(id) === false`.

3. **Fix the separate-mode rendering (C-03) and harden ChartPanel interaction tests (W-05).** Adopt a per-entity ref map and add an `entityIds?: string[]` filter prop to `ChartCanvas`. Update `ChartPanel.test.tsx` to mock `lightweight-charts` (mirroring `ChartCanvas.test.tsx`) and assert that overlay mode produces `addSeries` calls = `entityCount × axes` and separate mode produces `entityCount × axes` distributed across `entityCount` charts (each chart adds exactly `axes` series).

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
