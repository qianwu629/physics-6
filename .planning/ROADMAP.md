# Roadmap: Physis

## Overview

Physis 已交付 v1.0 物理沙盒 MVP（5 阶段，12/12 需求闭环）。v2.0 在此基础上扩展为"可保存、可分析、可定制规则、可降维"的交互物理实验室：场景持久化、实时物理量图表、通用力场体系、表达式驱动外加力、自由飞行摄像机、2D 模拟模式，并清理 v1.0 遗留的次要技术债务。

## Milestones

- ✅ **v1.0 MVP 物理沙盒** — Phases 1-5 (shipped 2026-05-04) — see [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 力场与多维模拟** — Phases 1-6 (in progress)

## Phases

**Phase Numbering:** v2.0 重置为从 Phase 1 开始（v1.0 阶段已归档至 `milestones/v1.0-phases/`）

- [ ] **Phase 1: 持久化与场景库** - JSON 文件 IO + localStorage 快照 + 预设场景库 + 测试基线修复
- [ ] **Phase 2: 实时物理量图表** - 位置/速度/加速度/能量曲线 + 多实体多曲线 + 浮动图表面板
- [ ] **Phase 3: 通用力场系统** - ForceField 框架 + 4 种预设（方向/引力/电场/磁场）+ 力线可视化
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
  4. 至少 6 个内置预设场景（抛体/斜面/堆叠/弹簧振子/双弹簧链/电荷场示例），一键加载
  5. Scene3D.test.tsx 的 9 个 baseline 失败用例修复，Phase 4 补回 VERIFICATION.md
**Plans**: 6 plans in 3 waves
**Plans**:
- [ ] 01-01-PLAN.md — 场景序列化/反序列化引擎 (sceneSerializer + sceneValidation + Zod Schema)
- [ ] 01-02-PLAN.md — 快照系统 (snapshotSlice Zustand persist + SnapshotManager Drawer UI)
- [ ] 01-03-PLAN.md — MenuBar 菜单栏 + SceneLoader 加载流程 (导出/导入/确认/暂停/重置/摄像机)
- [ ] 01-04-PLAN.md — 内置预设场景库 (5 个 JSON 预设 + PresetSelector 卡片选择器)
- [ ] 01-05-PLAN.md — App 集成布线 (MenuBar + SnapshotManager + PresetSelector + SceneBanner + 摄像机自适应)
- [ ] 01-06-PLAN.md — DEBT-04 修复 (Scene3D.test.tsx mock 补全 + Phase 4 VERIFICATION.md)
**UI hint**: yes

### Phase 2: 实时物理量图表
**Goal**: 用户可为任意实体启用实时折线图，在浮动面板中观察位置/速度/加速度/能量随时间变化；支持多实体多曲线并存。
**Depends on**: Phase 1（持久化基础不影响图表，但希望先稳定基础设施）
**Requirements**: CHART-01, CHART-02, CHART-03
**Success Criteria** (what must be TRUE):
  1. 任意实体可启用实时图表，显示位置（xyz 三轴）、速度、加速度、能量（KE/PE/E）4 类指标
  2. 同一图表面板可同时绘制 ≤4 个实体 × 4 类指标 = 16 条曲线，按颜色区分
  3. 图表面板浮动显示（可调整大小），时间窗口可在 5s/30s/全程切换
  4. 暂停时图表冻结，重置时清空，无内存泄漏（300+ 帧持续记录）
**Plans**: TBD (run /gsd-plan-phase 2)
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
**Plans**: TBD (run /gsd-plan-phase 3)
**UI hint**: yes

### Phase 4: 表达式驱动外加力
**Goal**: 用户可为任意实体绑定数学表达式，每帧根据实体状态（pos/vel/time/mass）计算外加力矢量；表达式语法错误即时反馈；性能合理（50+ 实体每帧 <2ms 解析开销）。
**Depends on**: Phase 3（force machinery 已建立；外加力是力场的特例化输入）
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status      | Completed |
|-------|----------------|-------------|-----------|
| 1. 持久化与场景库              | 0/6 | Planned    | -          |
| 2. 实时物理量图表              | 0/0 | Not started | -          |
| 3. 通用力场系统                | 0/0 | Not started | -          |
| 4. 表达式驱动外加力            | 0/0 | Not started | -          |
| 5. 自由飞行摄像机 + 2D 模式    | 0/0 | Not started | -          |
| 6. 弹簧选中 + 稳定性 + 性能    | 0/0 | Not started | -          |

## See Also

- `.planning/MILESTONES.md` — 里程碑日志（最新在最上方）
- `.planning/PROJECT.md` — 项目愿景与当前状态（含 v2.0 milestone goals）
- `.planning/REQUIREMENTS.md` — v2.0 需求清单（21 项 / 7 类别）
- `.planning/milestones/v1.0-ROADMAP.md` — v1.0 完整阶段历史
- `.planning/milestones/v1.0-phases/` — v1.0 阶段执行档案归档
