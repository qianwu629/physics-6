---
phase: 02-实时物理量图表
review_path: .planning/phases/02-实时物理量图表/02-REVIEW.md
fix_scope: explicit
findings_in_scope: 11
fixed: 11
skipped: 5
iteration: 1
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-16
**Source review:** `.planning/phases/02-实时物理量图表/02-REVIEW.md`
**Iteration:** 1
**Branch:** `gsd-reviewfix/02-1017` (将被 fast-forward 合入 `master`)

## Summary

- **Findings in scope (explicit):** 11 (5 Critical + 6 Warning)
- **Fixed:** 11
- **Skipped (delegated / out-of-scope):** 5 + 6 Info = 11
- **Test suite:** 286 pass / 1 todo / 2 pre-existing fail (EnvironmentPanel.spec.tsx; 与本次修复无关)

按用户分流（见 `.planning/STATE.md`）只修与 ChartPanel 浮层 UI 无关的 finding；C-02/C-03/W-01/W-02/W-06 由 Phase 01.1 UI 重构承接；6 个 Info finding 默认 out-of-scope。

## Fixed Issues

### C-01: Time-base mismatch (Date.now() vs performance.now())

- **Files modified:** `frontend/src/ecs/ChartSampler.ts`, `frontend/src/store/__tests__/chartBuffer.test.ts`
- **Commit:** `3b5ce3d`
- **Applied fix:** `ChartSampler.ts:56` 将 `performance.now()/1000` 改为 `Date.now()/1000`，与 ChartCanvas 读取端及 lightweight-charts `UTCTimestamp` 语义对齐。同步修正 `chartBuffer.test.ts:155-156` 的误导性注释。
- **Notes:** W-04 引入 `nowSeconds()` helper 后此处又被替换为 `nowSeconds()` 以便测试 spy（commit `ff1f558`）。

### C-04: peReferenceY 双存储 → 唯一来源 simulationSlice

- **Files modified:** `frontend/src/store/chartDataStore.ts`, `frontend/src/ecs/ChartSampler.ts`, `frontend/src/components/EnvironmentPanel.tsx`, `frontend/src/store/__tests__/chartDataStore.test.ts`, `frontend/src/components/__tests__/ChartCanvas.test.tsx`, `frontend/src/components/__tests__/ChartPanel.test.tsx`, `frontend/src/ecs/__tests__/ChartSampler.test.ts`
- **Commit:** `a12870d`
- **Applied fix:** 删除 `chartDataStore.peReferenceY` 字段与 `setPeReferenceY` action；ChartSampler 改读 `useSimulationStore.getState().environment.peReferenceY`；EnvironmentPanel 改读写 `simulationSlice`；同步移除 `chartDataStore.test.ts` 中相关测试；清理多个 test 文件中残留的 `peReferenceY: 0` `setState`。
- **Notes:** 唯一来源 = `simulationSlice.environment.peReferenceY`，sceneSerializer round-trip 现一致。

### C-05: removeEntity 不释放 chart buffer / 不 untrack

- **Files modified:** `frontend/src/store/chartBuffer.ts`, `frontend/src/store/chartDataStore.ts`, `frontend/src/store/entitySlice.ts`
- **Commit:** `badd898`
- **Applied fix:** 
  - `chartBuffer.ts` 新增 `disposeBuffer(entityId)` 释放单个 buffer (~52 MB Float64Array)
  - `chartDataStore.ts` 新增 `untrackEntity(id)` action（从 Set 删除）
  - `entitySlice.removeEntity` 在主删 + 级联删除后调用 untrack + dispose（遍历 `[id, ...cascadeRemove]`）
  - `entitySlice.resetEntities` 清空 `trackedEntityIds` + 释放所有 chartBuffers
- **Notes:** 资源生命周期表中 `chartBuffers` / `trackedEntityIds` 现已与 entitySlice 同步。

### C-06: Snapshot/preset 加载泄漏旧 entity 的 chart 状态

- **Files modified:** `frontend/src/components/SceneLoader.tsx`
- **Commit:** `4da51c7`
- **Applied fix:** `loadSceneWithConfirm` 在 `resetEntities()` 之后、`reset()` 之前显式调用 `useChartDataStore.setState({ trackedEntityIds: new Set() })` + `clearAllBuffers()`。C-05 fix 内的 `resetEntities` 已自动做这件事，此处再做一遍是防御性双保险，覆盖未来调用顺序变化的风险。
- **Notes:** 与 C-05 配套。

### C-07: series.update 时间窗 gap + 无 try/catch

- **Files modified:** `frontend/src/components/ChartCanvas.tsx`
- **Commit:** `7b3808e`
- **Applied fix:**
  - 引入 `lastUpdatedTimesRef: Map<seriesKey, number>` 水位线 (per-series)
  - `refreshAll` 通过 `buf.getSeriesData(metricIndex, max(watermark, windowStart) + 1e-9, now)` 拉取增量
  - 逐点 `series.update` 包 try/catch（lightweight-charts 在 `time <= lastDataPoint.time` 时会抛错）
  - 起点取 `max(watermark, 时间窗左界)` 避免下发窗外旧点
  - series `setData` 初始化时同步设水位线为 `data[last].time`，避免 `refreshAll` 重复 update
  - series 删除时同步清理水位线 entry
  - mount cleanup 清空 `lastUpdatedTimesRef`
- **Notes:** 修复 rAF 跳帧/暂停-恢复/切窗口边缘场景下的图表空隙与 silent throw。

### W-03: ChartSampler.test.ts 名实不符 → describe 改名 + 集成用例

- **Files modified:** `frontend/src/ecs/__tests__/ChartSampler.test.ts`
- **Commit:** `6c66203`
- **Applied fix:** 顶部 `describe` 从 typo 的 `ChartSampster (buffer + store integration)` 改为 `chartBuffer + store integration`，并在文件 header 说明范围（不挂载 React 组件，R3F 测试工具待后续补）。新增 Test 6：用 `vi.spyOn(nowSecondsModule, 'nowSeconds').mockReturnValue(1_700_000_000)` 强制 writer/reader 共用同一时钟，验证 5s 窗口 slice 应得 5 个 push 进去的点（C-01 类时间基准漂移的 regression 保护）。
- **Notes:** 任务允许的两种方案中选了"保留文件名 + 改 describe"，避免影响 git history / CI 缓存。文件位置 `frontend/src/ecs/__tests__/ChartSampler.test.ts` 未改。

### W-04: ChartCanvas Test 3 用同一 Date.now()/1000 → 引入共享 `nowSeconds()` helper

- **Files modified:** `frontend/src/utils/nowSeconds.ts` (new), `frontend/src/ecs/ChartSampler.ts`, `frontend/src/components/ChartCanvas.tsx`, `frontend/src/components/__tests__/ChartCanvas.test.tsx`
- **Commit:** `ff1f558`
- **Applied fix:**
  - 新建 `frontend/src/utils/nowSeconds.ts` 薄包装 `Date.now()/1000`
  - `ChartSampler.ts` 与 `ChartCanvas.tsx` 全部 `Date.now()/1000` 调用替换为 `nowSeconds()`
  - `ChartCanvas.test.tsx` Test 3: 用 `vi.spyOn(nowSecondsModule, 'nowSeconds').mockReturnValue(1_700_000_000)` pin 时钟；任何一侧绕过 helper 直接调 `Date.now()` 都会让 spy 失效 → 测试失败
- **Notes:** ESM 实时绑定使得 `vi.spyOn(module, 'nowSeconds')` 能影响所有 named-import 的消费方。6/6 ChartCanvas 测试 pass。

### W-05: ChartPanel.test separate vs overlay 不验证 series 数量

- **Files modified:** `frontend/src/components/__tests__/ChartPanel.test.tsx`
- **Commit:** `a94712e`
- **Applied fix:**
  - mock `lightweight-charts`（与 `ChartCanvas.test.tsx` 对齐）
  - `beforeEach` 重新装配 mock chart 对象，防 test 间状态污染
  - Test 5 新增断言：overlay 模式下 `mockAddSeries.mock.calls.length === 6` (= 2 entities × 3 axes)
  - 新增 `it.todo("Test 5b (post-C-03): separate mode adds entities × axes series, not entities × axes × entities (Phase 01.1)")` 占位，等 Phase 01.1 修 C-03 后启用为完整断言
- **Notes:** C-03 本身（separate 模式共享 ref + 不过滤 entityId）分流给 Phase 01.1，此处只 enforce overlay 行为，避免冲突。8 个 ChartPanel 测试: 7 pass + 1 todo。

### W-07: physicsCalc 用 Math.abs(gravityY) 反转 PE 符号

- **Files modified:** `frontend/src/utils/physicsCalc.ts`, `frontend/src/utils/__tests__/physicsCalc.test.ts`
- **Commit:** `56de689`
- **Applied fix:** `peGravity = -mass * gravityY * (pos.y - peReferenceY)` 保留 g 符号。`gY = -9.81` 时 PE = +9.81·m·h（与既有 Test 2 一致）；`gY = +5` 时 PE = -5·m·h（新增 Test 2b regression case）。
- **Notes:** Test 4 (sum) 用 `gY=-9.81`，新公式得 `-2*(-9.81)*5 = 98.1` J，与原断言一致，无需修改。8/8 physicsCalc 测试 pass。

### W-08: getSeriesData 总是 O(N) → early-exit

- **Files modified:** `frontend/src/store/chartBuffer.ts`
- **Commit:** `07e6521`
- **Applied fix:** 利用从 ring 起点开始 timestamps 单调非降的性质：`if t > endTime break;` `if t < startTime continue;`。不重构 ring buffer 结构。`getAllSeriesData` 因无窗口无需变。16/16 chartBuffer 单测 pass（含 wrap-around / time-window filtering / 12-metric / clear 等），行为等价。
- **Notes:** 任务允许的"最小化改动"路径，未引入 binary search。

### W-09: ChartCanvas series 删除 iterate-during-mutate → buffer-then-delete

- **Files modified:** `frontend/src/components/ChartCanvas.tsx`
- **Commit:** `de705d6`
- **Applied fix:** 先 for..of 把待删 key 收集到 `toRemove[]` 数组，再批量 `chart.removeSeries` + `map.delete` + 水位线清理（与 C-07 fix 中的水位线清理逻辑兼容）。

## Skipped Issues

### Delegated to Phase 01.1 UI refactor (5)

按 `.planning/STATE.md` 分流决策，与 ChartPanel 浮层 UI 架构相关的 finding 本次不修，由 Phase 01.1 UI 重构承接：

#### C-02: Draggable receives Resizable class instance as nodeRef

- **File:** `frontend/src/components/ChartPanel.tsx:52-78`
- **Reason:** delegated to Phase 01.1 UI refactor
- **Original issue:** `panelRef.current` 因 `Resizable` 不 forwardRef 而是 class instance，缺少 `ownerDocument`，Draggable mousedown 时抛 `<DraggableCore> not mounted on DragStart!`。修复需重构 ChartPanel 浮层 ref 体系，属于 01.1 范围。

#### C-03: Separate-mode shared chartCanvasRef → only last chart updates

- **File:** `frontend/src/components/ChartPanel.tsx:158-166`
- **Reason:** delegated to Phase 01.1 UI refactor
- **Original issue:** 多个 `<ChartCanvas ref={chartCanvasRef}>` 共享单一 ref；同时每个 chart 还读 `trackedEntityIds` 全集而非过滤到本行 entity。修复需引入 `Map<entityId, RefObject<ChartCanvasHandle>>` + `entityIds?: string[]` prop，属于 01.1 ChartPanel 重构范围。W-05 中已留 `it.todo` 占位，01.1 修完后启用断言。

#### W-01: 4-entity tracking cap 未在 store 中强制

- **File:** `frontend/src/store/chartDataStore.ts:25-31`, `frontend/src/components/ChartPanel.tsx:103`
- **Reason:** delegated to Phase 01.1 UI refactor
- **Original issue:** Header 显示 `(${size}/4 实体)` 但 `toggleTracking` 不校验上限；50 entities 全 track ≈ 2.6 GB。修复需在 `toggleTracking` 加 cap + 调用端 toast，属于 01.1 PropertyPanel/ChartPanel UI 交互范围。

#### W-02: cancel=".react-resizable-handle" 类名不匹配 re-resizable

- **File:** `frontend/src/components/ChartPanel.tsx:56`
- **Reason:** delegated to Phase 01.1 UI refactor
- **Original issue:** `re-resizable@6` 不默认给 handle 加 `react-resizable-handle` 类名，需用 `handleClasses` prop 显式指定。修复属于 01.1 浮层 Resizable 集成范围。

#### W-06: ChartCanvas init useEffect deps=[] 与未来 theme/color prop 解耦

- **File:** `frontend/src/components/ChartCanvas.tsx:61-104`
- **Reason:** delegated to Phase 01.1 UI refactor
- **Original issue:** 提示型 finding（"document the assumption" / "centralize options in a memo so theme changes can dispatch via applyOptions"），属于 01.1 设计 token 与暗/亮主题相关的 UI 工作范围。

### Info findings, out of scope (6)

I-01..I-06 默认不在 `--fix` 范围内，按 fix_scope=explicit 跳过：

- **I-01:** Unused `Suspense` import in `App.tsx` — out of scope (Info finding)
- **I-02:** Dead-code branch in `deserializeScene` for unknown component types — out of scope (Info finding)
- **I-03:** `ChartCanvas` `useImperativeHandle` `setTimeWindow` duplicates `useEffect` — out of scope (Info finding)
- **I-04:** `chartBuffer.test.ts:156` 注释 (C-01 已附带修正此处, 但 I-04 本身仍属 Info) — out of scope (Info finding)
- **I-05:** `simulationSlice.setPeReferenceY` dead code follow-up of C-04 — out of scope (Info finding; C-04 已统一来源，simulationSlice action 现是唯一有效写入路径)
- **I-06:** `Date.now()` floating-point precision warning — out of scope (Info finding; 文档/语义性)

## Notes / Deviations

- **测试 pre-existing failures:** `frontend/src/components/__tests__/EnvironmentPanel.spec.tsx` 中 2 个 test (`disables all sliders when running`, `disables all number inputs when running`) 在 master HEAD 上同样失败（peReferenceY HighlightSlider 硬编码 `disabled={false}`，与 isRunning 状态解耦）。这不在本次 review scope 内，未修复也未引入。
- **W-03 文件名:** 任务建议重命名为 `chartBuffer-store.integration.test.ts`，但选择了"保留原名 + 更新 describe"路径（任务允许的替代方案），避免影响 git history 与 CI 缓存。
- **W-04 helper 命名空间:** 新建文件 `frontend/src/utils/nowSeconds.ts`（导出 named function `nowSeconds`），通过 `import * as nowSecondsModule from '../utils/nowSeconds'` + `vi.spyOn` 在测试中拦截。ChartSampler/ChartCanvas 都用 named import。
- **C-05/C-06 协同:** C-06 的 SceneLoader 清理在 C-05 修了 `resetEntities` 之后变得部分冗余（`resetEntities` 内已 dispose 所有 buffer），但保留作为防御性双保险，避免未来调用顺序重构后再次泄漏。
- **行号差异:** REVIEW.md 行号大多与当前代码一致；少数 fix 段中的 "ChartCanvas.tsx:142-148" 等行号在我加入 lastUpdatedTimesRef 后偏移，已按当前代码事实定位修复。
- **W-08 中 `getAllSeriesData` 不动:** 任务说"最小化改动；仅加 early-exit"，`getAllSeriesData` 无 startTime/endTime 参数，没有可 early-exit 的边界条件，保持原 O(N) 全扫。

---

_Fixed: 2026-05-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
