# Requirements: Physis v2.0 — 力场与多维模拟

**Defined:** 2026-05-04
**Core Value:** 在组件化物理沙盒之上，让用户通过持久化场景、自定义力场与表达式力、实时物理量分析、自由摄像机与 2D 模式扩展实验维度——把物理沙盒变成"可保存、可分析、可定制规则、可降维"的交互物理实验室。

## v2 Requirements

Requirements for v2.0 release. 7 categories, 18 requirements total.

### Persistence (PERSIST)

- [x] **PERSIST-01**: 用户可以将当前场景导出为 JSON 文件下载到本地（仅保存初始配置：实体清单、组件参数、约束、环境参数、可视化设置）
- [x] **PERSIST-02**: 用户可以从本地选择 JSON 文件加载到场景中，原场景被替换；加载后处于暂停状态
- [x] **PERSIST-03**: 用户可以将场景保存到浏览器 localStorage（命名快照，至少 5 个槽位），并从快照列表恢复
- [x] **PERSIST-04**: 系统提供 5 个内置预设场景（抛体、斜面、自由落体堆叠、弹簧振子、双弹簧链），可一键加载；第 6 个点电荷力场示例推迟到 Phase 3（需 ForceField 系统）

### Real-Time Charts (CHART)

- [ ] **CHART-01**: 用户可以为任意实体启用实时折线图，绘制 4 类物理量随时间变化曲线：位置（x/y/z 三轴）、速度（vx/vy/vz）、加速度（ax/ay/az）、能量（KE 动能 / PE 重力势能 / E 总能）
- [ ] **CHART-02**: 同一图表面板可同时绘制多个实体的多条曲线（按颜色区分），最多 4 个实体 × 4 类物理量 = 16 条曲线并显示
- [ ] **CHART-03**: 图表面板浮动显示，可调整大小，时间窗口可配置（5s / 30s / 全程），暂停时图表冻结，重置时清空

### Force Fields (FIELD)

- [ ] **FIELD-01**: 系统提供通用 ForceField 组件框架，每个力场为独立 ECS 实体，定义力场类型、空间分布范围、强度参数
- [ ] **FIELD-02**: 内置至少 4 种预设力场：均匀方向场（重力风场）、点引力源（带 1/r² 衰减）、点电荷电场（库仑定律 1/r²）、均匀磁场（洛伦兹力 F=qv×B，需带电荷的实体响应）
- [ ] **FIELD-03**: 用户可以通过 UI 创建/编辑/删除力场实体，配置位置、类型、强度、作用范围；力场可视化为半透明体积或方向箭头矩阵
- [ ] **FIELD-04**: 力线可视化：流线/电场线/磁感线渲染，密度反映场强（toggle 开关控制）

### Expression-Driven Forces (EXPR)

- [ ] **EXPR-01**: 用户可以为任意实体绑定一个数学表达式，每帧对该实体计算外加力矢量（输入：实体位置 px,py,pz / 速度 vx,vy,vz / 时间 t / 质量 m；输出：F=(fx,fy,fz)）
- [ ] **EXPR-02**: 表达式语法支持四则运算、三角函数（sin/cos/tan）、指数对数、常量（pi/e/g）和上述输入变量；语法错误在 UI 中即时反馈

### Free-Flight Camera (CAM)

- [ ] **CAM-01**: 系统提供类 FPS 自由飞行摄像机模式：WSAD 平移、QE 升降、鼠标拖拽旋转视角、滚轮调整移动速度；可在 OrbitControls 与 FPS 模式间切换
- [ ] **CAM-02**: 移动设备/触控屏提供屏幕摇杆 fallback：左侧虚拟摇杆控制平移，右侧拖拽控制视角

### 2D Simulation Mode (DIM2)

- [ ] **DIM2-01**: 用户可以通过 UI 切换 2D / 3D 模拟模式；2D 模式下所有动态实体的 z 坐标和 z 方向速度被锁定为 0（rapier3d 引擎层约束），摄像机切换为正交投影 + 俯视/侧视视角
- [ ] **DIM2-02**: 2D 模式下 UI 隐藏 z 轴相关参数输入（创建对话框、PropertyPanel），力场/约束/可视化叠加层正确降维显示

### v1.0 Tech Debt (DEBT)

- [ ] **DEBT-01**: 修复弹簧 3D tube 射线点击选中精度——点击 tube 任意可见部分均能正确选中弹簧实体
- [ ] **DEBT-02**: 多弹簧链（≥3 个连接的质量块）数值稳定性测试与调参，确保不同刚度参数下 30 秒内无穿插/爆炸/数值发散
- [ ] **DEBT-03**: 性能基准与优化：50+ 实体 + 20+ 弹簧场景下，全可视化开启时平均 FPS ≥ 55（已验证目标硬件）
- [ ] **DEBT-04**: 修复 Scene3D.test.tsx 9 个 baseline 失败用例（three.js Vector3 mock 缺失），并补回 Phase 4 缺失的 VERIFICATION.md（移到 milestones/v1.0-phases/04-轨迹与矢量可视化/）

## v3+ Requirements (deferred — not in v2.0)

### Drag-and-Drop Scene Building

- **SCN-01**: 可视化拖拽场景搭建——拖拽放置物体，吸附对齐，放置预览
- **SCN-02**: 模板/快照右键菜单，快速复制实体

### Advanced Analysis

- **ANL-02**: 数据导出为 CSV 格式（时间、位置、速度、加速度）
- **ANL-03**: 时间操控——慢动作、逐帧步进、时间轴回放
- **ANL-04**: 多场景并行对比运行
- **ANL-05**: 虚拟测量工具（直尺、量角器、秒表）

### Engine Extension

- **MULTI-01**: 多物理场耦合（光学、电磁、热力学）— 长期愿景，超出 v2.0 范围
- **COLLAB-01**: 场景 URL 分享（v1 已确认 Out of Scope，v2 暂不重启）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 预制题目模板 | 违背核心设计理念——废案失败的根本原因 |
| 移动端 App | Web 优先；CAM-02 提供触控 fallback 已足够 |
| 多人实时协作 | 与物理确定性要求冲突 |
| 照片级真实渲染（PBR/光追） | 与物理精度焦点冲突 |
| 自动解题功能 | 与探索式学习理念冲突 |
| rapier2d-compat 引入 | DIM2-01 决策——通过 z 轴约束在 rapier3d 上模拟 2D，避免双引擎维护 |

## Traceability

需求到阶段的映射根据 ROADMAP.md v2.0 阶段划分。

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERSIST-01 | Phase 1: 持久化与场景库 | Complete |
| PERSIST-02 | Phase 1: 持久化与场景库 | Complete |
| PERSIST-03 | Phase 1: 持久化与场景库 | Complete |
| PERSIST-04 | Phase 1: 持久化与场景库 | Complete |
| CHART-01 | Phase 2: 实时物理量图表 | Pending |
| CHART-02 | Phase 2: 实时物理量图表 | Pending |
| CHART-03 | Phase 2: 实时物理量图表 | Pending |
| FIELD-01 | Phase 3: 通用力场系统 | Pending |
| FIELD-02 | Phase 3: 通用力场系统 | Pending |
| FIELD-03 | Phase 3: 通用力场系统 | Pending |
| FIELD-04 | Phase 3: 通用力场系统 | Pending |
| EXPR-01 | Phase 4: 表达式驱动外加力 | Pending |
| EXPR-02 | Phase 4: 表达式驱动外加力 | Pending |
| CAM-01 | Phase 5: 摄像机 + 2D 模式 | Pending |
| CAM-02 | Phase 5: 摄像机 + 2D 模式 | Pending |
| DIM2-01 | Phase 5: 摄像机 + 2D 模式 | Pending |
| DIM2-02 | Phase 5: 摄像机 + 2D 模式 | Pending |
| DEBT-01 | Phase 6: 弹簧选中 + 稳定性 + 性能 | Pending |
| DEBT-02 | Phase 6: 弹簧选中 + 稳定性 + 性能 | Pending |
| DEBT-03 | Phase 6: 弹簧选中 + 稳定性 + 性能 | Pending |
| DEBT-04 | Phase 1: 持久化与场景库（捎带修复） | Pending |

**Coverage:**
- v2 requirements: 21 total
- Mapped to phases: 21 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-04*
*Last updated: 2026-05-04 — v2.0 initial requirements draft*
