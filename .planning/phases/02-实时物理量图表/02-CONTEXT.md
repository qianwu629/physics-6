---
phase: 2
phase_name: 实时物理量图表
milestone: v2.0 力场与多维模拟
date_created: "2026-05-05"
status: Locked (9 decisions confirmed)
---

# Phase 2 上下文 — 实时物理量图表

## 上游参考

- ROADMAP: `.planning/ROADMAP.md` (v2.0 路线图)
- REQUIREMENTS: `.planning/REQUIREMENTS.md` — 需求编号 CHART-01, CHART-02, CHART-03
- Phase 1 CONTEXT: `.planning/phases/01-持久化与场景库/01-CONTEXT.md` (图表不涉及持久化，但遵循 UI 形态一致性的约定)
- Milestone 状态: `.planning/STATE.md`

## 本阶段目标

为仿真实体提供实时折线图，绘制位置（x/y/z）、速度（vx/vy/vz）、加速度（ax/ay/az）、能量（KE/PE/E）随时间变化。支持 ≤4 个实体同时追踪，≤16 条曲线叠加显示。浮动图表面板可拖拽、可调大小、可切换时间窗口。

---

## 已锁定决策

### D-02-01 — 图表库：lightweight-charts (TradingView Canvas)

**Decision:** 使用 `lightweight-charts`（TradingView 开源 Canvas 图表库）作为实时物理量图表的渲染引擎。

**Why:** 专为实时流式数据设计，Canvas 渲染 16 条曲线在 60fps 下无压力。recharts SVG 方案在 16 条曲线持续更新下可能卡顿；自绘 Canvas 开发量过大。

**How to apply:** 创建 React wrapper 组件封装 lightweight-charts API。通过 ref 直接操作图表实例，绕开 React 重渲染。安装 `lightweight-charts` npm 包。

---

### D-02-02 — 图表布局：合并叠加 + 可切换分离

**Decision:** 默认所有实体的同类指标曲线叠加在同一图表中（如位置图显示所有追踪实体的 x/y/z 曲线）。用户可通过按钮切换为分离子图模式（每个实体独占一行）。

**Why:** 叠加模式便于对比多个实体的运动轨迹（物理课堂核心场景）；分离模式适合详细分析单个实体。两种模式覆盖教学和深度分析需求。

**How to apply:** 图表组件维护 `layoutMode: 'overlay' | 'separate'` 状态。overlay 模式用单个 Chart 多个 Series；separate 模式为每个实体创建独立子 Chart（纵向排列）。

---

### D-02-03 — 曲线配色：指标优先

**Decision:** 曲线颜色按物理量类别区分，不按实体区分。位置=蓝色系、速度=绿色系、加速度=橙色系、能量=紫色系。同一指标的不同实体用深浅/透明度区分，不同轴用线型（实线 x / 虚线 y / 点线 z）。

**Why:** 学术图表风格，用户一眼识别指标类型。相比实体颜色映射（需记住每个实体的 3D 颜色再在图表中对应），指标优先方案更符合物理教科书的阅读习惯。

**How to apply:** 预定义色板：位置 `#3b82f6` / `#60a5fa` / `#93c5fd`，速度 `#22c55e` / `#4ade80` / `#86efac`，加速度 `#f97316` / `#fb923c` / `#fdba74`，能量 `#a855f7` / `#c084fc` / `#d8b4fe`。

---

### D-02-04 — 采样率：渲染帧同步 60Hz

**Decision:** 每个 `requestAnimationFrame` 回调中采样一次物理量数据。不对 120Hz 物理帧全采样。

**Why:** 图表以 60fps 渲染，120Hz 采样有一半数据点不会显示。60Hz 每秒 960 数据点（16 条曲线），30 秒窗口约 28800 点——Canvas 轻松处理。与 trajectoryBuffer 的采样策略一致。

**How to apply:** 在 Scene3D 的 `useFrame` 或独立 `requestAnimationFrame` 循环中调用 `chartDataStore.sample()`。采样函数读取 `useSimulationStore.getState().entities` 中启用了图表追踪的实体的物理量（通过 ref 直接获取 Rapier rigidBody 数据）。

---

### D-02-05 — 数据缓冲：全量环形缓冲区 + 视口裁剪

**Decision:** 始终使用环形缓冲区存储全部采样数据（上限 10 分钟或 500K 数据点），切换时间窗口（5s/30s/全程）时仅改变 lightweight-charts 的可见时间范围（`setVisibleRange`），不修改缓冲区内容。超过上限后丢弃最旧数据。

**Why:** 全量存储让时间窗口切换瞬间完成（只是视口变化）。视口裁剪由 lightweight-charts 原生支持，零额外实现成本。10 分钟/500K 上限防止长时间运行内存泄漏。

**How to apply:** `ChartDataBuffer` 类封装 `Float64Array[]` 环形缓冲（每实体每指标一个），记录时间戳。lightweight-charts 的 `ISeriesApi.setData()` 从缓冲区切片获取当前视口数据。

---

### D-02-06 — 数据采集机制：独立 chartDataStore + 原生订阅

**Decision:** 创建独立的 `chartDataStore`（Zustand），存储每个实体的图表追踪状态和采样缓冲区。图表组件通过 `subscribe` 或 `getState()` 读取，不通过 React hook 触发渲染。图表更新在 `requestAnimationFrame` 中直接调用 lightweight-charts API。

**Why:** 与 trajectoryBuffer（Float32Array 环形缓冲）模式一致，绕过 Zustand re-render storm 问题（PITFALLS #6）。16 条曲线每帧更新时如果触发 React 重渲染会导致严重性能问题。

**How to apply:** `chartDataStore` 的 `sample()` 由 rAF 调用，内部直接操作 `Float64Array` 缓冲区，不修改 Zustand 状态（Zustand 只管理配置：哪些实体被追踪、时间窗口大小）。图表组件通过 `useRef` + imperative API 更新 lightweight-charts。

---

### D-02-07 — 暂停/重置行为：冻结/清空

**Decision:** 暂停时缓冲区停止采样（已有数据保留，图表曲线水平静止）。重置（R 键）或加载新场景时清空全部缓冲区。与 `trajectoryBuffer.reset()` 行为完全一致。

**Why:** 用户已习惯这种模式（Phase 1 的 D-01-03 同样要求加载后清空轨迹）。教学场景中"重置"意味着一切重新开始，保留旧数据会造成混淆。

**How to apply:** `chartDataStore` 监听 `resetCounter` 变化（与 trajectoryBuffer 同样的触发源），`reset()` 时清空所有缓冲区。`isRunning` 为 false 时 `sample()` 函数直接 return。

---

### D-02-08 — 势能参考零点：用户可配置

**Decision:** 用户可在 EnvironmentPanel 中设置势能参考高度 `h=0`。默认值为 `y=0`（世界坐标平面）。

**Why:** 不同场景的势能参考点不同——自由落体可能以地面为参考，弹簧振子可能以平衡位置为参考。y=0 作为默认值覆盖最简单场景，可配置性覆盖复杂需求。

**How to apply:** 在 `EnvironmentState` 中添加 `peReferenceY: number`（默认 0）。PE = m × g × (y - peReferenceY)。EnvironmentPanel 中添加一个数值输入或滑块。

---

### D-02-09 — 实体图表开关：PropertyPanel + 默认关闭

**Decision:** 在 PropertyPanel 中为选中实体添加「图表追踪」开关。默认关闭——只有用户主动开启的实体才采样。图表面板不自动弹出。

**Why:** 避免不需要的性能开销（大部分场景只需追踪 1-2 个实体）。默认关闭也避免图表面板在不需要时干扰 3D 视图。

**How to apply:** `chartDataStore` 维护 `trackedEntityIds: Set<string>`。PropertyPanel 中渲染一个 Switch 组件，切换时调用 `chartDataStore.toggleTracking(entityId)`。仅 tracked entity 在采样循环中被处理。

---

## 衍生决策

- **lightweight-charts React 封装**：创建 `ChartPanel` 组件，内部用 `useRef<HTMLDivElement>` 挂载 lightweight-charts 实例。所有数据更新通过 imperative API，不触发 React 渲染。
- **图表面板浮动实现**：使用 CSS `position: fixed` + 拖拽（从 Toolbox 拖拽模式可复用经验） + `resize` CSS 属性。不用 shadcn Dialog（会遮挡 3D 视图，Phase 1 中已决定快照用 Drawer 而非 Dialog）。
- **时间窗口切换 UI**：图表面板顶部三个按钮 `5s | 30s | 全程`，切换时只改 `visibleRange`，不清空缓冲区。
- **4 类物理量选项卡**：图表面板内用 Tab 切换 位置/速度/加速度/能量 四个子图表（或纵向堆叠）。每个 Tab 内显示所有追踪实体的对应曲线。

## 假设

1. lightweight-charts 的 React 封装复杂度可控（API 文档完善，有社区 React wrapper 参考）
2. 60fps 下 Canvas 绘制 16 条曲线 + 坐标轴不会成为瓶颈（lightweight-charts 专为此场景设计）
3. 从 Rapier rigidBody 读取速度/加速度数据在 rAF 中可行（非物理步进回调，但 Rapier 的 `rigidBody.linvel()` 随时可调用）
4. 加速度需要自行计算（Rapier 不直接暴露加速度 API）—— `a = (v_current - v_prev) / dt`

## 已知风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| lightweight-charts npm 包体积 | JS bundle 增大 | 按需引入，不加载 TradingView 完整库 |
| Canvas 渲染与 3D WebGL 竞争 GPU | 帧率下降 | 图表更新频率与 3D 渲染相同共享 rAF，不额外增加 GPU 负担 |
| 加速度计算引入噪声 | 加速度曲线抖动 | 对加速度应用简单移动平均平滑（3-5 帧窗口） |
| 势能参考高度与弹簧弹性势能的重叠 | PE 和弹性势能争用参考点 | 弹性势能用弹簧自然长度作为参考，势能参考高度仅影响重力势能 |

## 成功标准

1. [ ] 任意实体可通过 PropertyPanel 开关启用实时图表追踪
2. [ ] 图表面板浮动显示，可拖拽位置、可调整大小
3. [ ] 支持 位置/速度/加速度/能量 4 类物理量，每类显示 x/y/z 三轴分量
4. [ ] 叠加模式下 ≤4 个实体 × 4 类 = 16 条曲线同时显示，颜色区分清晰
5. [ ] 时间窗口 5s / 30s / 全程可切换
6. [ ] 暂停时图表冻结，重置时清空
7. [ ] 60fps 下无可见卡顿，内存无泄漏（10 分钟后缓冲区稳定在 500K 点以内）

## 范围边界

**在范围内：**
- lightweight-charts 集成 + React 封装
- 4 类物理量 (位置/速度/加速度/能量) 实时折线图
- 多实体追踪（≤4）+ 叠加/分离双模式
- 浮动图表面板（拖拽 + 调整大小 + Tab/堆叠布局）
- 时间窗口切换（5s/30s/全程）
- chartDataStore + 环形缓冲区
- PropertyPanel 图表开关
- 暂停冻结 / 重置清空

**不在范围内：**
- 图表数据导出 CSV（ANL-02，v3 需求）
- 时间操控（慢动作/逐帧/回放）— ANL-03，v3
- 自动解题/异常检测 — 与探索式学习理念冲突
- 3D 图表（如表面图、矢量场图）— 这属于力场可视化（Phase 3）
