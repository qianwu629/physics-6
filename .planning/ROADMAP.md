# Roadmap: Physis

## Overview

Physis 已交付 v1.0 物理沙盒 MVP（5 阶段，12/12 需求闭环）。v2.0 在此基础上扩展为"可保存、可分析、可定制规则、可降维"的交互物理实验室：场景持久化、实时物理量图表、通用力场体系、表达式驱动外加力、自由飞行摄像机、2D 模拟模式，并清理 v1.0 遗留的次要技术债务。

## Milestones

- ✅ **v1.0 MVP 物理沙盒** — Phases 1-5 (shipped 2026-05-04) — see [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 力场与多维模拟** — Phases 1-6 (in progress)

## Phases

**Phase Numbering:** v2.0 重置为从 Phase 1 开始（v1.0 阶段已归档至 `milestones/v1.0-phases/`）

- [x] **Phase 1: 持久化与场景库** - JSON 文件 IO + localStorage 快照 + 预设场景库 + 测试基线修复 (completed 2026-05-04)
- [ ] **Phase 01.1: ui重构 (INSERTED)** - UI 全面重构：bug修复 + shadcn设计系统 + 栅格化 + 响应式 + a11y + Phase 3/5预留 (planned 2026-05-10)
- [ ] **Phase 2: 实时物理量图表** - 位置/速度/加速度/能量曲线 + 多实体多曲线 + 浮动图表面板
- [x] **Phase 3: 通用力场系统** - ForceField 框架 + 4 种预设（方向/引力/电场/磁场）+ 力线可视化 (completed 2026-05-23)
- [ ] **Phase 3.5: 力场系统修复 (INSERTED)** - 修复 Phase 3 设计缺陷：API 语义统一、计算/渲染分层、决策一致性审计
- [ ] **Phase 4: 表达式驱动外加力** - 解析器集成 + 实体级公式力计算
- [ ] **Phase 5: 自由飞行摄像机 + 2D 模式** - FPS WSAD/鼠标控制 + 触控 fallback + z 轴约束 + 正交相机
- [ ] **Phase 6: 弹簧选中精度 + 多体稳定性 + 性能优化** - DEBT-01..03 闭环

## Phase Details

### Phase 1: 持久化与场景库
**Goal**: 用户可以导出/加载场景 JSON、保存命名快照到 localStorage、一键加载内置预设场景；Phase 4 缺失的 VERIFICATION.md 补回；Scene3D.test.tsx baseline 修复。
**Depends on**: v1.0 已落地的 ECS 实体系统
**Requirements**: PERSIST-01, PERSIST-02, PERSIST-03, PERSIST-04, DEBT-04
**Success Criteria** (what must be TRUE):
  1. 用户点击"导出"按钮下载完整场景 JSON（实体 + 组件 + 约束 + 环境 + 可视化设置），可在另一会话加载还原
  2. 加载 JSON 时原场景被替换，加载完成后处于暂停状态（用户决定何时启动）
  3. 至少 5 个 localStorage 命名快照槽位可用，快照列表显示创建时间
  4. 5 个内置预设场景（抛体/斜面/堆叠/弹簧振子/双弹簧链）一键加载；第 6 个点电荷力场示例推迟到 Phase 3
  5. Scene3D.test.tsx 的 9 个 baseline 失败用例修复，Phase 4 补回 VERIFICATION.md
**Plans**: 6 plans in 3 waves
**Plans**:
- [x] 01-01-PLAN.md — 场景序列化/反序列化引擎 (sceneSerializer + sceneValidation + Zod Schema)
- [x] 01-02-PLAN.md — 快照系统 (snapshotSlice Zustand persist + SnapshotManager Drawer UI)
- [x] 01-03-PLAN.md — MenuBar 菜单栏 + SceneLoader 加载流程 (导出/导入/确认/暂停/重置/摄像机)
- [x] 01-04-PLAN.md — 内置预设场景库 (5 个 JSON 预设 + PresetSelector 卡片选择器)
- [x] 01-05-PLAN.md — App 集成布线 (MenuBar + SnapshotManager + PresetSelector + SceneBanner + 摄像机自适应)
- [x] 01-06-PLAN.md — DEBT-04 修复 (Scene3D.test.tsx mock 补全 + Phase 4 VERIFICATION.md)
**UI hint**: yes

### Phase 01.1: ui重构 (INSERTED)

**Goal:** 全面重构 Physis UI——修复 Phase 2 浮层缺陷、建立 shadcn/ui 设计系统与深/浅双主题、将散乱浮层升级为 Blender 风格三栏栅格化工作台、引入响应式 3 断点骨架与 a11y 基线、为 Phase 3(力场)和 Phase 5(摄像机/2D)预留 UI 进入点。
**Requirements**: UI-01(浮层缺陷修复), UI-02(shadcn/ui token体系), UI-03(深/浅双主题), UI-04(Blender风格栅格化), UI-05(3断点响应式), UI-06(a11y基线), UI-07(z-index标度), UI-08(Phase3/5UI前置), UI-09(ChartPanel浮动保留)
**Depends on:** Phase 1 (Phase 2 数据层 bug 不阻塞)
**Plans:** 9 plans in 4 waves
**UI hint:** yes

Plans:
- [ ] 01.1-01-PLAN.md — CSS token体系 + z-index堆栈 + 布局变量 + shadcn 5组件安装 (Wave 1, UI-02/UI-03/UI-07)
- [ ] 01.1-02-PLAN.md — ThemeProvider + ThemeToggle 集成 (Wave 1, UI-02/UI-03)
- [ ] 01.1-03-PLAN.md — WorkspaceLayout 网格骨架 + App.tsx 重布线 + CSS hack 拆除 (Wave 2, UI-04)
- [ ] 01.1-04-PLAN.md — Inspector Drawer + Tabs + Panel 整合 + ForceFieldPanelStub (Wave 2, UI-04/UI-08)
- [ ] 01.1-05-PLAN.md — Toolbox 左列迁移 + Toolbar 底部迁移 + Phase 3/5 预留入口 (Wave 2, UI-04/UI-08)
- [ ] 01.1-06-PLAN.md — ChartPanel C-02/C-03/W-02 修复 + 浮动模式保留 (Wave 3, UI-01/UI-09)
- [ ] 01.1-07-PLAN.md — W-01 上限强制 + HACK-02 浮按钮拆除 (Wave 3, UI-01)
- [ ] 01.1-08-PLAN.md — 全量 Token 迁移 codemod (Wave 4, UI-02)
- [ ] 01.1-09-PLAN.md — 响应式 3 断点 + a11y 扫尾 + human-verify 验收 (Wave 4, UI-05/UI-06)

### Phase 2: 实时物理量图表
**Goal**: 用户可为任意实体启用实时折线图，在浮动面板中观察位置/速度/加速度/能量随时间变化；支持多实体多曲线并存。
**Depends on**: Phase 1（持久化基础不影响图表，但希望先稳定基础设施）
**Requirements**: CHART-01, CHART-02, CHART-03
**Success Criteria** (what must be TRUE):
  1. 任意实体可启用实时图表，显示位置（xyz 三轴）、速度、加速度、能量（KE/PE/E）4 类指标
  2. 同一图表面板可同时绘制 ≤4 个实体 × 4 类指标 = 16 条曲线，按颜色区分
  3. 图表面板浮动显示（可调整大小），时间窗口可在 5s/30s/全程切换
  4. 暂停时图表冻结，重置时清空，无内存泄漏（300+ 帧持续记录）
**Plans**: 6 plans in 4 waves
**Plans**:
- [ ] 02-01-PLAN.md — 依赖安装 + 数据层骨架 (chartDataStore + chartBuffer + simulationSlice 扩展)
- [ ] 02-02-PLAN.md — 采样 + 计算核心 (physicsCalc + ChartSampler)
- [ ] 02-03-PLAN.md — 图表渲染 (ChartCanvas + ChartMetricTabs)
- [ ] 02-04-PLAN.md — 浮动面板 (ChartPanel: draggable + resizable)
- [ ] 02-05-PLAN.md — UI 集成 (PropertyPanel/EnvironmentPanel/Toolbar/App.tsx)
- [ ] 02-06-PLAN.md — 验证与优化 (benchmark + 修复)
**UI hint**: yes

### Phase 3: 通用力场系统
**Goal**: 引入 ForceField ECS 组件框架与至少 4 种预设力场（均匀方向场、点引力源、点电荷电场、均匀磁场），用户通过 UI 创建/编辑/删除力场实体；力场可视化为半透明体积或方向箭头矩阵；力线可视化叠加层可选。
**Depends on**: Phase 2（图表可用于验证力场作用结果）
**Requirements**: FIELD-01, FIELD-02, FIELD-03, FIELD-04
**Success Criteria** (what must be TRUE):
  1. ForceField 是独立 ECS 实体类型，可通过 ECS 工厂创建，包含类型/位置/范围/强度参数
  2. 4 种预设力场全部实现：均匀方向场、点引力源（1/r²）、点电荷电场（库仑定律）、均匀磁场（洛伦兹力）
  3. 用户可通过 Toolbox + CreationDialog 添加力场实体，PropertyPanel 编辑参数；力场体积/箭头矩阵 3D 可视化
  4. 力线可视化（流线/电场线/磁感线）可通过 Toolbar toggle 开启，密度反映场强
  5. 带电荷的实体响应电磁场作用力（与重力叠加），物理行为正确（如圆周运动 / 抛物线偏转）
**Plans**: 5 plans in 3 waves
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — ECS 类型扩展 + Entity 工厂 + RigidBody charge (Wave 1)
- [x] 03-02-PLAN.md — 力场计算引擎 + Rapier useBeforeStep 注入 (Wave 1)
- [x] 03-03-PLAN.md — UI: ForceFieldDialog + Toolbox + PropertyPanel (Wave 2)
- [x] 03-04-PLAN.md — 3D 可视化: 箭头矩阵 + 半透明球体 (Wave 2)
- [x] 03-05-PLAN.md — 力线 + 序列化 + 点电荷预设场景 (Wave 3)

**Wave dependency notes:**
- **Wave 2** *(blocked on Wave 1 completion)*
- **Wave 3** *(blocked on Wave 1+2 completion)*

### Phase 3.5: 力场系统修复 (INSERTED)

**Goal:** 系统性修复 Phase 3 力场系统的设计缺陷和实现偏差，包括 API 语义统一、力场计算与可视化渲染分层、设计决策一致性审计，确保 Phase 4 可安全建立在稳定的力场架构上。
**Depends on:** Phase 3（必须基于 Phase 3 已完成代码进行修复）
**Requirements:** FIELD-01, FIELD-02, FIELD-03, FIELD-04（重新验证）
**Success Criteria** (what must be TRUE):
  1. `ForceFieldSystem` 中力注入 API 与 Rapier 官方 API 完全一致（`addForce`）
  2. `VectorRenderer` 中不再包含力场计算逻辑，仅负责渲染；力场力计算回归力场层
  3. Phase 3 CONTEXT 中所有锁定决策在代码中有明确对应
  4. 所有力场相关测试通过（含新增回归测试）
  5. Phase 4 可安全接入力场系统（表达式力与力场力正确叠加）
**Plans:** TBD (run /gsd-plan-phase 3.5)
**UI hint:** no（纯修复阶段，无新 UI）

### Phase 4: 表达式驱动外加力
**Goal**: 用户可为任意实体绑定数学表达式，每帧根据实体状态（pos/vel/time/mass）计算外加力矢量；表达式语法错误即时反馈；性能合理（50+ 实体每帧 <2ms 解析开销）。
**Depends on**: Phase 3.5（必须等待力场架构修复完成）
**Requirements**: EXPR-01, EXPR-02
**Success Criteria** (what must be TRUE):
  1. 用户在 PropertyPanel 中为实体输入数学表达式（fx/fy/fz 三个分量）
  2. 表达式支持：四则运算、三角函数、指数对数、常量（pi/e/g）、变量（px/py/pz/vx/vy/vz/t/m）
  3. 每帧表达式被求值，结果作为外加力施加到实体；50+ 实体场景下解析开销不影响 FPS
  4. 语法错误在 UI 中即时反馈（红色提示），错误的表达式不被启用
**Plans**: TBD (run /gsd-plan-phase 4)
**UI hint**: yes

### Phase 5: 自由飞行摄像机 + 2D 模式
**Goal**: 引入类 FPS 自由飞行摄像机（WSAD + 鼠标 + 滚轮 + 触控 fallback）；用户可一键切换 2D / 3D 模拟模式（z 轴约束 + 正交摄像机）。
**Depends on**: Phase 4（力学系统已稳定）
**Requirements**: CAM-01, CAM-02, DIM2-01, DIM2-02
**Success Criteria** (what must be TRUE):
  1. FPS 模式：WSAD 平移、QE 升降、鼠标拖拽旋转、滚轮调速；与 OrbitControls 模式互切
  2. 触控屏：左侧虚拟摇杆控制平移，右侧拖拽控制视角
  3. 2D 模式切换：所有动态实体 z 坐标和 z 速度被锁定为 0（rapier3d 引擎层约束），摄像机切正交投影
  4. 2D 模式下 UI 隐藏 z 轴相关参数（创建对话框、PropertyPanel、力场参数）
  5. 力场/约束/可视化叠加层在 2D 模式下正确降维显示
**Plans**: TBD (run /gsd-plan-phase 5)
**UI hint**: yes

### Phase 6: 弹簧选中精度 + 多体稳定性 + 性能优化
**Goal**: 关闭 v1.0 遗留的 3 个次要 UAT 项；性能基准达标。
**Depends on**: Phase 5（所有功能落地后再做整体性能调优）
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. 点击 3D 视图中弹簧 tube 任意可见部分均能正确选中弹簧实体
  2. 多弹簧链（≥3 个连接的质量块）在不同刚度参数下 30 秒内无穿插/爆炸/数值发散
  3. 50 实体 + 20 弹簧 + 全可视化开启场景，目标硬件平均 FPS ≥ 55
  4. 性能 profile 报告记录瓶颈（提交至 milestones/v2.0-PERF-PROFILE.md）
**Plans**: TBD (run /gsd-plan-phase 6)
**UI hint**: no（无新 UI，仅修复与优化）

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 01.1 → 2 → 3 → 3.5 → 4 → 5 → 6

| Phase | Plans Complete | Status      | Completed |
|-------|----------------|-------------|-----------|
| 1. 持久化与场景库              | 6/6 | Complete    | 2026-05-04 |
| 01.1. ui重构 (INSERTED)         | 0/9 | Planned     | -          |
| 2. 实时物理量图表              | 6/6 | Planned     | 2026-05-05 |
| 3. 通用力场系统                | 5/5 | Complete    | 2026-05-23 |
| 3.5. 力场系统修复 (INSERTED)   | 0/0 | Urgent      | -          |
| 4. 表达式驱动外加力            | 0/0 | Blocked     | -          |
| 5. 自由飞行摄像机 + 2D 模式    | 0/0 | Not started | -          |
| 6. 弹簧选中 + 稳定性 + 性能    | 0/0 | Not started | -          |
| 8. 物理引擎重写                | 0/0 | Not started | -          |

## See Also

- `.planning/MILESTONES.md` — 里程碑日志（最新在最上方）
- `.planning/PROJECT.md` — 项目愿景与当前状态（含 v2.0 milestone goals）
- `.planning/REQUIREMENTS.md` — v2.0 需求清单（21 项 / 7 类别）
- `.planning/milestones/v1.0-ROADMAP.md` — v1.0 完整阶段历史
- `.planning/milestones/v1.0-phases/` — v1.0 阶段执行档案归档

### Phase 7: 底层引擎重构

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 7 to break down)

### Phase 8: 物理引擎重写

**Goal:** 评估并实施从 Rapier 迁移到更适合电磁学/复杂物理场景的引擎（Cannon.js/Ammo.js/PhysX.js/自定义方案），或基于 Rapier 扩展更多物理模型支持。
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 8 to break down)
