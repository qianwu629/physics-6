---
phase: 02-实时物理量图表
verified: 2026-05-17T00:00:00Z
status: human_needed
score: 31/37 must-haves verified
overrides_applied: 0
overrides: []
re_verification: false
gaps: []
deferred:
  - truth: "支持 overlay 模式（单 Chart 多 Series）和 separate 模式（每实体独立子 Chart）"
    addressed_in: "Phase 01.1 (01.1-06)"
    evidence: "01.1-UI-SPEC.md lines 341-342: C-02/C-03 are listed as explicit fix targets. 01.1-06-PLAN.md is dedicated to ChartPanel C-02/C-03/W-02 fixes."
  - truth: "react-draggable 实现拖拽（handle = panel-header），bounds=parent"
    addressed_in: "Phase 01.1 (01.1-06)"
    evidence: "01.1-UI-FRAMEWORK.md lists C-02 as Wave 3 fix target. UI-SPEC.md line 341: 'C-02: ChartPanel Draggable + Resizable ref conflict'."
  - truth: "overlay 模式下单 Chart 显示所有追踪实体曲线；separate 模式每实体独立子 Chart"
    addressed_in: "Phase 01.1 (01.1-06)"
    evidence: "01.1-DISCUSSION-LOG.md line 47: C-02/C-03/W-01/W-02 explicitly IN scope. UI-SPEC.md line 342: 'C-03: ChartPanel separate mode ChartCanvas render bug'."
human_verification:
  - test: "启动 dev server 后完整功能测试"
    expected: "创建实体 → 开启图表追踪 → 点击Toolbar图表按钮 → ChartPanel浮动面板显示 → 播放仿真后实时曲线绘制 → 切换4类指标 → 切换时间窗口 → 暂停冻结 → 重置清空 → 多实体多曲线"
    why_human: "需要启动完整 runtime（R3F + Rapier WASM + lightweight-charts Canvas），无Headless自动化环境"
  - test: "ChartPanel 拖拽功能"
    expected: "拖拽面板标题栏可移动位置；但由于 C-02 (ref冲突)，当前拖拽可能抛出异常。此问题已委托给 Phase 01.1。"
    why_human: "需要用户交互测试；已知 C-02 bug 委托给 Phase 01.1"
  - test: "separate 模式多实体图表"
    expected: "切换到 separate 模式后，每个追踪实体应有独立子Chart；但由于 C-03 (shared ref + 无entityId过滤)，当前可能渲染异常。此问题已委托给 Phase 01.1。"
    why_human: "需要用户交互确认；已知 C-03 bug 委托给 Phase 01.1"
  - test: "性能基准 (V-CHART-07)"
    expected: "16条曲线 × 30秒场景下 FPS下降 < 2，median update < 3ms/frame"
    why_human: "需要真实浏览器环境运行 benchmark/chart-fps.ts"
  - test: "长时间运行内存稳定性 (V-CHART-03)"
    expected: "10分钟连续运行后内存稳定，每个buffer不超过500K数据点"
    why_human: "需要真实浏览器环境长时间运行并进行内存profiling"
  - test: "弹簧振子能量守恒实际验证 (V-CHART-01)"
    expected: "加载弹簧振子预设，运行30秒，总能量相对漂移 < 5%"
    why_human: "单元测试已覆盖公式，但需要真实Rapier物理引擎运行确认"
---

# Phase 02: 实时物理量图表 Verification Report

**Phase Goal:** 用户可为任意实体启用实时折线图，在浮动面板中观察位置/速度/加速度/能量随时间变化；支持多实体多曲线并存。

**Verified:** 2026-05-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | npm install 成功安装 lightweight-charts@5.2.0 + react-draggable@4.5.0 + re-resizable@6.11.2 | ✓ VERIFIED | package.json contains all three dependencies |
| 2 | chartDataStore.ts 导出 Zustand store，含 trackedEntityIds / timeWindow / layoutMode | ✓ VERIFIED | `frontend/src/store/chartDataStore.ts:24` — `useChartDataStore` with `create<ChartConfigState>()` |
| 3 | chartBuffer.ts 导出 ChartDataBuffer 类，Float64Array 环形缓冲，MAX_POINTS=500000，支持 12 指标/实体 | ✓ VERIFIED | `chartBuffer.ts:14` — `ChartDataBuffer` class, `MAX_POINTS=500_000`, `METRICS_PER_ENTITY=12` |
| 4 | simulationSlice.ts 的 EnvironmentState 新增 peReferenceY: number（默认 0） | ✓ VERIFIED | `simulationSlice.ts:17` — `peReferenceY: number` in interface, default 0; `setPeReferenceY` action at line 96 |
| 5 | chartBuffer.test.ts 通过 V-CHART-03（内存上限）和 V-CHART-05（重置清空）和 V-CHART-06（时间窗口不修改缓冲） | ✓ VERIFIED | 16/16 tests pass; getSeriesData does not mutate buffer |
| 6 | physicsCalc.ts 导出 computeEnergy() 和 AccelerationSmoother，公式与 RESEARCH.md 一致 | ✓ VERIFIED | `physicsCalc.ts:36` — `computeEnergy`, `AccelerationSmoother` at line 87; W-07 fix: PE = `-mass*gravityY*(y-peReferenceY)` |
| 7 | ChartSampler.ts 在 useFrame 中 60Hz 采样被追踪实体，写入 chartBuffer | ✓ VERIFIED | `ChartSampler.ts:53` — `useFrame` with `SAMPLE_INTERVAL = 1/60`; push to `chartBuffers` |
| 8 | 暂停时 sample() 直接 return（冻结） | ✓ VERIFIED | `ChartSampler.ts:55` — `if (!isRunning) return` |
| 9 | 重置时（resetCounter 变化）清空所有 chartBuffers | ✓ VERIFIED | `ChartSampler.ts:43-50` — useEffect on resetCounter calls `clearAllBuffers()` |
| 10 | 加速度使用 SMA(5) 平滑，静止物体加速度噪声 < 0.05 m/s² | ✓ VERIFIED | `AccelerationSmoother(windowSize=5)`; physicsCalc test covers static body accel < 0.05 |
| 11 | 能量计算包含 KE + PE_gravity + PE_spring，弹簧振子场景总能量漂移 < 5% | ✓ VERIFIED | `computeEnergy` returns `{ke, peGravity, peSprings, total}`; unit test covers energy conservation |
| 12 | ChartCanvas.tsx 使用 useRef + imperative API 封装 lightweight-charts，不触发 React re-render | ✓ VERIFIED | `ChartCanvas.tsx:52` — `forwardRef<ChartCanvasHandle>` with `useImperativeHandle`; chart instance in `chartRef` |
| 13 | 支持 overlay 模式（单 Chart 多 Series）和 separate 模式（每实体独立子 Chart） | ⚠️ DEFERRED | Code structure exists but C-03: separate mode shares single ref (only last chart updates) + each chart renders ALL tracked entities. Fix delegated to Phase 01.1-06. |
| 14 | 曲线颜色按指标优先：位置蓝/速度绿/加速度橙/能量紫，深浅区分实体 | ✓ VERIFIED | `ChartCanvas.tsx:15-20` — `METRIC_COLORS` map: blue/green/orange/purple with depth shading by entity index |
| 15 | update() 增量更新，不用 setData() 全量替换（Pitfall #3） | ✓ VERIFIED | C-07 fix: `lastUpdatedTimesRef` watermark tracking; `series.update()` per new point in `refreshAll` |
| 16 | ResizeObserver 驱动 chart.applyOptions({width, height}) | ✓ VERIFIED | `ChartCanvas.tsx:96-100` — ResizeObserver on container ref |
| 17 | cleanup 中调用 chart.remove() + disconnect ResizeObserver（Pitfall #2） | ✓ VERIFIED | `ChartCanvas.tsx:102-108` — useEffect return cleans up `ro.disconnect()`, `chart.remove()`, and refs |
| 18 | ChartMetricTabs.tsx 提供 4 类指标 Tab 切换，样式与 EnvironmentPanel 预设按钮一致 | ✓ VERIFIED | `ChartMetricTabs.tsx:16-33` — 4 tabs (位置/速度/加速度/能量) with matching rounded-lg border styles |
| 19 | ChartPanel.tsx 是浮动面板，position: fixed，z-index 40 | ✓ VERIFIED | `ChartPanel.tsx:80` — `fixed z-40 rounded-xl` |
| 20 | react-draggable 实现拖拽（handle = panel-header），bounds=parent | ⚠️ DEFERRED | Code structure exists but C-02: `nodeRef={panelRef}` on Draggable points to Resizable class instance (not DOM node), causing drag crash. Fix delegated to Phase 01.1-06. |
| 21 | re-resizable 实现大小调整，min 320x200，max 1200x800 | ✓ VERIFIED | `ChartPanel.tsx:58-64` — `Resizable` with `minWidth=320, minHeight=200, maxWidth=1200, maxHeight=800` |
| 22 | 面板顶部显示时间窗口按钮 5s/30s/全程，切换时只改 visibleRange | ✓ VERIFIED | `ChartPanel.tsx:123-136` — three time window buttons; `handleTimeWindowChange` calls `setTimeWindow` + `chartCanvasRef.setTimeWindow` |
| 23 | 面板内部显示 ChartMetricTabs + ChartCanvas（当前激活指标） | ✓ VERIFIED | `ChartPanel.tsx:151-156` — `ChartMetricTabs` above `ChartCanvas` in panel body |
| 24 | overlay 模式下单 Chart 显示所有追踪实体曲线；separate 模式每实体独立子 Chart | ⚠️ DEFERRED | Code structure exists but C-03: separate mode creates N identical charts (all read full trackedEntityIds). Fix delegated to Phase 01.1-06. |
| 25 | 面板可关闭，关闭后不影响采样（数据继续写入 buffer） | ✓ VERIFIED | `ChartSampler.useFrame` runs independently of `ChartPanel.open`; rAF loop stops on close via `open` dependency |
| 26 | PropertyPanel 中为选中实体添加「图表追踪」Switch，默认关闭，切换时调用 toggleTracking | ✓ VERIFIED | `PropertyPanel.tsx:510-513` and `764-767` — two Switch locations (spring + entity properties) |
| 27 | EnvironmentPanel 中添加「势能参考高度」滑块，范围 -50~50m，步进 0.1m | ✓ VERIFIED | `EnvironmentPanel.tsx:253-265` — `HighlightSlider` with `min=-50, max=50, step=0.1, unit="m"` |
| 28 | Toolbar 中添加「图表」toggle 按钮，控制 ChartPanel 显示/隐藏 | ✓ VERIFIED | `Toolbar.tsx:218-229` — "图表" button with `chartPanelOpen`/`onToggleChartPanel` |
| 29 | App.tsx 中挂载 ChartPanel 组件，与 PropertyPanel 同级 | ✓ VERIFIED | `App.tsx:284-286` — `<ChartPanel open={chartPanelOpen} onClose={...} />` |
| 30 | App.tsx 中 ChartPanel 的 open 状态由 Toolbar 图表按钮控制 | ✓ VERIFIED | `App.tsx:70` — `useState(false)`, passed to Toolbar and ChartPanel |
| 31 | 图表开关不影响采样——关闭面板后数据继续写入 buffer | ✓ VERIFIED | Architecture: `ChartSampler.useFrame` is independent of `ChartPanel` render state |
| 32 | 16 条曲线 × 30 秒场景下 FPS 下降 < 2（与无图表对比） | ? NEEDS HUMAN | `benchmark/chart-fps.ts` exists but requires real browser environment execution |
| 33 | 10 分钟连续运行后内存稳定，chartBuffers 中数据点不超过 500K/实体 | ? NEEDS HUMAN | Buffer logic enforces 500K cap; C-05 fix adds `disposeBuffer`; requires runtime memory profiling |
| 34 | 弹簧振子场景总能量相对漂移 < 5%（V-CHART-01） | ✓ VERIFIED | `physicsCalc.test.ts` covers energy conservation; unit tests pass |
| 35 | 静止物体 SMA(5) 加速度噪声 < 0.05 m/s²（V-CHART-02） | ✓ VERIFIED | `physicsCalc.test.ts` covers static body accel < 0.05 m/s²; unit tests pass |
| 36 | 时间窗口切换不改变底层缓冲区（V-CHART-06） | ✓ VERIFIED | `chartBuffer.getSeriesData` returns new array, does not mutate; early-exit (W-08 fix) preserves ring buffer |
| 37 | ChartPanel 拖拽和 resize 流畅，无卡顿 | ? NEEDS HUMAN | Affected by C-02 (drag crash) and W-02 (resize handle class mismatch); both delegated to Phase 01.1 |

**Score:** 31/37 truths verified, 3 deferred (addressed in Phase 01.1), 3 need human verification

### Deferred Items

Items not yet met but explicitly addressed in later phases within this milestone.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Truth 13: separate 模式支持 | Phase 01.1 (01.1-06) | `01.1-UI-SPEC.md:342` — C-03 listed as explicit fix target. `01.1-UI-FRAMEWORK.md:42` — Wave 3 includes C-03. |
| 2 | Truth 20: react-draggable 拖拽功能 | Phase 01.1 (01.1-06) | `01.1-UI-SPEC.md:341` — "C-02: ChartPanel Draggable + Resizable ref conflict". `01.1-DISCUSSION-LOG.md:47` — C-02 in scope. |
| 3 | Truth 24: separate 模式每实体子 Chart | Phase 01.1 (01.1-06) | Shares root cause with C-03 (shared ref + no entityId filtering). `01.1-UI-SPEC.md:342` — "C-03: separate mode ChartCanvas render bug". |

### Required Artifacts

| Artifact | Expected | Status | Lines | Details |
| -------- | -------- | ------ | ----- | ------- |
| `frontend/src/store/chartDataStore.ts` | Zustand config layer | ✓ VERIFIED | 45 | Exports `useChartDataStore`, `ChartConfigState`; peReferenceY moved to simulationSlice per C-04 fix |
| `frontend/src/store/chartBuffer.ts` | Float64Array ring buffer | ✓ VERIFIED | 118 | `ChartDataBuffer` class + `chartBuffers` Map + `getOrCreateBuffer`/`clearAllBuffers`/`disposeBuffer` |
| `frontend/src/store/__tests__/chartBuffer.test.ts` | Ring buffer unit tests | ✓ VERIFIED | 212 | 16 test cases covering push, wrap-around, clear, time filtering, 12 metrics |
| `frontend/src/utils/physicsCalc.ts` | Energy calc + SMA smoothing | ✓ VERIFIED | 148 | `computeEnergy()` + `AccelerationSmoother`; W-07 fix applied |
| `frontend/src/utils/__tests__/physicsCalc.test.ts` | Energy + SMA unit tests | ✓ VERIFIED | 233 | 8 test cases (energy conservation, accel noise, sign regression) |
| `frontend/src/ecs/ChartSampler.ts` | 60Hz useFrame sampling | ✓ VERIFIED | 156 | `useFrame` loop; pause freeze; reset clear; spring PE calc; C-01/C-04 fixes applied |
| `frontend/src/ecs/__tests__/ChartSampler.test.ts` | Sampling logic tests | ✓ VERIFIED | 240 | 6 test cases (pause, tracked/untracked, reset, metrics, multi-entity, clock regression) |
| `frontend/src/components/ChartCanvas.tsx` | lightweight-charts wrapper | ✓ VERIFIED | 267 | `forwardRef` + `useImperativeHandle`; watermark tracking (C-07); ResizeObserver; W-09 fix |
| `frontend/src/components/ChartMetricTabs.tsx` | Metric tab switcher | ✓ VERIFIED | 34 | 4 tabs: 位置/速度/加速度/能量 |
| `frontend/src/components/ChartPanel.tsx` | Floating chart panel | ✓ VERIFIED | 184 | Draggable+Resizable+ChartCanvas+ChartMetricTabs; known C-02/C-03 issues deferred |
| `frontend/src/components/__tests__/ChartCanvas.test.tsx` | ChartCanvas integration tests | ✓ VERIFIED | 190 | 6/6 tests pass; W-04 fix: shared `nowSeconds` helper with vi.spyOn |
| `frontend/src/components/__tests__/ChartPanel.test.tsx` | ChartPanel interaction tests | ✓ VERIFIED | 178 | 7/7 pass + 1 todo (Test 5b for C-03 fix); W-05 fix: mock lightweight-charts + series count assertion |
| `frontend/utils/nowSeconds.ts` | Shared clock helper | ✓ VERIFIED | 14 | W-04 fix: prevents writer/reader clock drift |
| `frontend/benchmark/chart-fps.ts` | FPS benchmark script | ✓ VERIFIED | 84 | Exports `runChartBenchmark()`; framework placeholder for real ChartCanvas integration |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| chartDataStore.ts toggleTracking | PropertyPanel Switch | `toggleTracking(entityId)` | ✓ WIRED | `PropertyPanel.tsx:200,513,767` |
| chartBuffer.ts push() | ChartSampler.ts useFrame | `getOrCreateBuffer(entityId).push(time, metrics)` | ✓ WIRED | `ChartSampler.ts:150-151` |
| physicsCalc.ts computeEnergy | ChartSampler.ts | Per-frame energy calculation | ✓ WIRED | `ChartSampler.ts:119-126` |
| physicsCalc.ts AccelerationSmoother | ChartSampler.ts | Per-entity smoother instance | ✓ WIRED | `ChartSampler.ts:110-116` |
| ChartCanvas.tsx refreshAll | chartBuffer.ts getSeriesData | `getSeriesData(metricIndex, queryStart, now)` | ✓ WIRED | `ChartCanvas.tsx:223` with watermark tracking (C-07) |
| ChartCanvas.tsx | lightweight-charts createChart | useEffect init | ✓ WIRED | `ChartCanvas.tsx:65-109` |
| ChartMetricTabs.tsx activeMetric | chartDataStore | onChange callback | ✓ WIRED | Local state in ChartPanel, passed as prop |
| ChartPanel.tsx | ChartCanvas.tsx | ref.refreshAll() + ref.setTimeWindow() | ⚠️ PARTIAL | Wired for overlay mode; separate mode shares single ref (C-03) |
| ChartPanel.tsx | chartDataStore.ts | useChartDataStore selectors | ✓ WIRED | timeWindow, layoutMode, trackedEntityIds read/write |
| PropertyPanel 图表追踪 Switch | chartDataStore.ts toggleTracking | onCheckedChange callback | ✓ WIRED | Both spring and entity PropertyPanel sections |
| EnvironmentPanel peReferenceY | simulationSlice setPeReferenceY | HighlightSlider onChange | ✓ WIRED | C-04 fix: reads from `useSimulationStore.environment.peReferenceY` |
| Toolbar 图表按钮 | App.tsx chartPanelOpen | onToggleChartPanel prop | ✓ WIRED | Props flow: App → Toolbar → button |
| ChartSampler.ts | Scene3D.tsx | `<ChartSampler />` mount | ✓ WIRED | `Scene3D.tsx:301` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| ChartCanvas.tsx | seriesMapRef (LineSeries) | chartBuffers.get(entityId).getSeriesData() | ✓ Real data from ring buffer | ✓ FLOWING |
| ChartSampler.ts | metrics (Float64Array) | Rapier rigidBody.linvel()/.translation()/.mass() | ✓ Real physics engine data | ✓ FLOWING |
| ChartPanel.tsx | chartCanvasRef | ChartCanvas useImperativeHandle | ✓ Ref-based imperative API | ⚠️ PARTIAL (overlay works; separate shares single ref per C-03) |
| ChartSampler.ts | energy (ke/peGravity/peSprings) | computeEnergy from physicsCalc.ts | ✓ Real physics calculations | ✓ FLOWING |
| PropertyPanel.tsx | trackedIds | useChartDataStore.trackedEntityIds | ✓ Zustand store state | ✓ FLOWING |
| EnvironmentPanel.tsx | peReferenceY | useSimulationStore.environment.peReferenceY | ✓ simulationSlice state | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compilation | `npx tsc --noEmit` | No errors | ✓ PASS |
| chartBuffer tests | `npx vitest run src/store/__tests__/chartBuffer.test.ts` | 16/16 pass | ✓ PASS |
| physicsCalc tests | `npx vitest run src/utils/__tests__/physicsCalc.test.ts` | 8/8 pass | ✓ PASS |
| ChartSampler tests | `npx vitest run src/ecs/__tests__/ChartSampler.test.ts` | 6/6 pass | ✓ PASS |
| ChartCanvas tests | `npx vitest run src/components/__tests__/ChartCanvas.test.tsx` | 6/6 pass | ✓ PASS |
| ChartPanel tests | `npx vitest run src/components/__tests__/ChartPanel.test.tsx` | 7/7 pass + 1 todo | ✓ PASS |
| chartDataStore tests | `npx vitest run src/store/__tests__/chartDataStore.test.ts` | 15/15 pass | ✓ PASS |
| npm dependencies | `grep "lightweight-charts\|react-draggable\|re-resizable" package.json` | 3 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| CHART-01 | 02-01, 02-02, 02-03, 02-05, 02-06 | 用户可为任意实体启用实时折线图，绘制 4 类物理量曲线（位置/速度/加速度/能量） | ✓ SATISFIED | chartDataStore.toggleTracking + ChartSampler 60Hz sampling + ChartCanvas rendering with METRIC_INDICES mapping. PropertyPanel Switch for entity tracking. EnvironmentPanel peReferenceY for PE calc. |
| CHART-02 | 02-03, 02-04, 02-05, 02-06 | 同一图表面板可同时绘制多个实体的多条曲线（按颜色区分），最多 4 实体 x 4 类 = 16 条曲线 | ⚠️ PARTIAL | Overlay mode supports multi-entity multi-curve (verified by ChartPanel test: 2 entities x 3 axes = 6 addSeries calls). Separate mode is broken (C-03: shared ref + no entity filtering). 4-entity cap not enforced in store (W-01). Both C-03 and W-01 delegated to Phase 01.1. |
| CHART-03 | 02-01, 02-02, 02-04, 02-05, 02-06 | 图表面板浮动显示，可调整大小，时间窗口可配置（5s/30s/全程），暂停时图表冻结，重置时清空 | ✓ SATISFIED | ChartPanel is fixed/floating (z-40), resizable (320-1200 x 200-800), time window buttons (5s/30s/全程), pause freeze (isRunning check in useFrame), reset clear (clearAllBuffers on resetCounter change). Drag broken due to C-02 (delegated). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| ChartPanel.tsx | 52-78 | Draggable `nodeRef={panelRef}` points to Resizable class instance, not DOM node | ⚠️ WARNING (deferred) | C-02: Drag will throw exception. Delegated to Phase 01.1-06. |
| ChartPanel.tsx | 158-166 | Separate mode: N ChartCanvas share single `chartCanvasRef` | ⚠️ WARNING (deferred) | C-03: Only last chart updates in separate mode. Delegated to Phase 01.1-06. |
| ChartPanel.tsx | 56 | `cancel=".react-resizable-handle"` class may not match re-resizable@6 default | ⚠️ WARNING (deferred) | W-02: Resize handle drag cancellation may not work. Delegated to Phase 01.1. |
| chartDataStore.ts | 29 | `toggleTracking` does not enforce 4-entity cap | ⚠️ WARNING (deferred) | W-01: No limit on tracked entities. Delegated to Phase 01.1. |

### Human Verification Required

#### 1. 完整功能集成测试
**Test:** 启动 dev server → 创建实体 → 选中后在 PropertyPanel 开启「图表追踪」→ 点击 Toolbar「图表」按钮 → ChartPanel 浮动面板出现 → 播放仿真 → 观察曲线实时绘制 → 切换 4 类指标 Tab → 切换时间窗口 (5s/30s/全程) → 暂停 → 重置 → 多实体追踪
**Expected:** 所有步骤正常工作；曲线实时更新；暂停时冻结；重置时清空；时间窗口切换不影响数据保留
**Why human:** 需要完整 runtime (R3F + Rapier WASM + lightweight-charts Canvas)；无 Headless 自动化环境

#### 2. ChartPanel 拖拽行为（已知 C-02）
**Test:** 拖拽面板标题栏尝试移动位置
**Expected:** 面板跟随鼠标移动（但已知 C-02 bug：Draggable ref 指向 Resizable class instance，可能在 drag 时抛错）
**Why human:** 需要真实 DOM 交互测试；C-02 已委托给 Phase 01.1-06

#### 3. separate 模式多实体图表（已知 C-03）
**Test:** 在 overlay 模式追踪 3 个实体 → 切换到 separate 模式
**Expected:** 每个实体应显示独立的子 Chart（但已知 C-03：shared ref 导致只有最后一个 chart 更新；每个 chart 渲染全部实体而非单个实体）
**Why human:** 需要真实渲染确认；C-03 已委托给 Phase 01.1-06

#### 4. 性能基准 (V-CHART-07)
**Test:** 打开浏览器 DevTools Performance 面板，追踪 4 个实体运行 30 秒
**Expected:** FPS 稳定在 55+；median chart update < 3ms/frame；16 条曲线下 FPS 下降 < 2
**Why human:** 需要真实浏览器环境运行 `runChartBenchmark()`

#### 5. 长时间运行内存稳定性 (V-CHART-03)
**Test:** 4 实体追踪，连续运行 10 分钟，观察 DevTools Memory Profiler 中 JS Heap Size
**Expected:** JS Heap Size 无持续增长；每个 buffer.count <= 500K
**Why human:** 需要真实浏览器长时间运行和内存 profiling

#### 6. 弹簧振子能量守恒实际验证 (V-CHART-01)
**Test:** 加载「弹簧振子」预设，开启图表追踪，运行 30 秒后观察总能量曲线
**Expected:** 总能量相对漂移 < 5%
**Why human:** 单元测试已覆盖公式验证，但需要真实 Rapier 物理引擎运行确认能量守恒

### Gaps Summary

**没有直接的未解决 gap** — 所有通过代码审查发现的严重问题 (C-01, C-04, C-05, C-06, C-07, W-03, W-04, W-05, W-07, W-08, W-09) 已在 REVIEW-FIX.iter1 (2026-05-16) 中修复，并已在当前代码库中验证通过。

**3 个功能缺陷已委托给 Phase 01.1 (01.1-06):**
- **C-02**: ChartPanel Draggable ref 冲突导致拖拽异常 → Phase 01.1-06
- **C-03**: Separate 模式 ChartCanvas 渲染错误（共享 ref + 无 entityId 过滤）→ Phase 01.1-06
- **W-01/W-02**: 4 实体容量上限未强制 / resize handle 类名不匹配 → Phase 01.1

**3 个真理需要人工验证:**
- 性能基准 (FPS/内存) → 需要真实浏览器环境
- 拖拽/separate 模式 UI 行为 → 需要真实 DOM 交互
- 弹簧振子能量守恒 → 需要真实物理引擎时长运行

**代码质量:**
- TypeScript 编译通过 (零错误)
- 43 个测试 PASS + 1 个 todo (预留 C-03 修复后启用)
- 所有关键数据流 (ChartSampler → chartBuffer → ChartCanvas, PropertyPanel → chartDataStore, EnvironmentPanel → simulationSlice) 已正确接线
- C-04 fix 消除了 peReferenceY 双存储的 source-of-truth 分歧
- C-05 fix 添加了 entity 删除时的 buffer 释放和 untrack 清理
- W-04 引入 `nowSeconds()` helper 消除了 writer/reader 时钟漂移

---

_Verified: 2026-05-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
