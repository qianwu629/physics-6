# Phase 3: 约束系统与环境配置 - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

在 Phase 2 已建成的 ECS 实体系统上扩展两类能力：
1. **弹簧约束** —— 用户可在任意两个实体之间添加弹簧（distance joint），可配置弹性系数 k 和原长 L0；弹簧振子系统表现出正确简谐运动行为，3D 视图中可视化可观察
2. **全局环境参数** —— 用户可通过控制面板配置全局重力强度和方向、摩擦系数、空气阻力（拖拽）系数

**不在本 Phase**：
- 弹簧之外的约束类型（铰链 revolute / 滑轨 prismatic / 固定 fixed） —— 待用户明确需求后单独 Phase
- 力场可视化（速度/受力矢量箭头） —— Phase 4
- 轨迹残影 —— Phase 4
- 撤销/重做（continued from Phase 2 deferred）
- 多场景对比（v2 ANL-04）
- 场景保存/加载（v2 SCN-03）

</domain>

<decisions>
## Implementation Decisions

### 环境参数面板（UI 与交互）
- **D-01:** 顶部 Toolbar 增加"环境"按钮 → 点击弹出独立浮动面板（与 Phase 1 D-07 顶部浮动 Toolbar 设计一致）。不占据常驻屏幕空间，与左侧 Toolbox + 右侧 PropertyPanel 布局共存。
- **D-02:** 输入控件统一采用「预设胶囊 + 滑块 + 输入框」三合一形态。预设胶囊作为快选锚点（如重力：地球9.81 / 月球1.62 / 火星3.71 / 无重力0），滑块与输入框可联动用于精细调节。
- **D-03:** 重力方向用 X/Y/Z 分量输入框（三个独立数字输入），默认值 `(0, -9.81, 0)`。允许用户表达任意角度（如斜面坐标系下的重力分量）。重力大小不再作为独立维度——由三个分量隐式表达。
- **D-04:** 重置语义局部化——重置仅清空所有实体（沿用 Phase 2 D-12），环境参数保留用户当前设置。适配教学场景"同一环境下试不同物体"。

### 编辑权限与时机
- **D-05:** 环境参数严格遵循 Phase 2 D-09，**仅暂停时可编辑**。设计一致性优先于实时调参的教学便利。弹簧本身的 k/L0 参数也遵此规则。
- **D-06:** 运行中点开环境面板呈只读态——所有控件 disabled、视觉变灰，面板顶部置反转提示横幅"运行中，请暂停后编辑"。视觉规范与 Phase 2 PropertyPanel 只读态保持一致（参考 02-CONTEXT.md D-09 的 UI 表现）。
- **D-07:** 暂停时修改环境参数立即生效（与 Phase 2 D-10 行为一致），下次物理步长直接应用。同时添加视觉预览动画：被修改的参数控件在 DOM 中高亮闪烁约 300ms，提示「改动已生效」。

### 全局参数与实体参数关系
- **D-08:** 全局摩擦/弹性作为「倍率法修正」叠加在实体参数之上。实际值 = 实体参数 × 全局倍率（默认 1.0）。
  - **实现：** 全局倍率变化时需触发 Rapier 碰撞对的 `combineRule` 重建（因 Rapier 摩擦定义在碰撞对而非实体本身）。
  - **保留 Phase 2 D-10：** 实体属性面板中的 friction/restitution 字段仍可单独编辑，倍率独立叠加。
  - **空气阻力例外：** 空气阻力（drag）是全局唯一参数，无实体级对应（Rapier `linearDamping` 已是全局通过实体属性传递；Phase 3 通过 store 中央化管理）。

### 弹簧子系统（Claude's Discretion）
以下细节交给 Claude 在 plan 阶段判断，但需遵守约束：

**约束清单（必须遵守）：**
- 弹簧作为 ECS 中的 `ConstraintComponent`（kind: 'spring'），延续 ARCHITECTURE.md Pattern 1 的实体节点 + 组件容器模型
- 实体删除时级联删除其上的所有弹簧（避免悬空引用）
- 弹簧创建/删除/编辑遵循 D-05 仅暂停时可改
- 物理底层用 Rapier 的 distance joint 或自实现 `SpringForce`（基于胡克定律 F = -k·(L - L0)），需在调研阶段确定
- 弹簧的属性面板编辑（k、L0、阻尼）复用 Phase 2 PropertyPanel 的输入控件风格

**给 Claude 的弹性空间：**
- 弹簧创建交互的具体流程（工具箱按钮 → 选实体A → 选实体B → 参数对话框；或其他自然方案）
- 弹簧 3D 可视化样式（螺旋线 / zigzag / 粗线 + 张力着色）
- 弹簧是否可在 3D 中点击选中（推荐：可，与实体选中体验一致）
- 弹簧的删除交互（侧边列表删除按钮、Delete 键、右键菜单 等等）
- 多弹簧串联场景的性能边界

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目定义
- `.planning/PROJECT.md` — 项目愿景、组件组合自由搭建核心价值、废案教训（严禁模板化）
- `.planning/REQUIREMENTS.md` — SIM-02（重力配置）、SIM-04（弹簧约束）、SIM-05（全局环境参数）映射本 Phase
- `.planning/ROADMAP.md` § Phase 3 — 目标定义、5 项成功标准

### 架构与设计
- `.planning/research/ARCHITECTURE.md` — Pattern 1（EntityNode + Component Map），`ConstraintComponent` 类型已定义（kind: 'revolute' | 'prismatic' | 'spring' | 'fixed'）。**必须完整阅读 Pattern 1-4 与 Anti-Patterns 章节。**
- `.planning/research/STACK.md` — Rapier WASM + R3F + Zustand 技术栈
- `.planning/research/PITFALLS.md` — Pitfall #6（物理帧数据不经过 Zustand）、Pitfall #4（渲染层不持有物理副本）。弹簧的实时端点位置同样适用此规则。
- `.planning/research/SUMMARY.md` § Phase 3 (research roadmap) — 状态管理与 UI 完善阶段研究摘要

### Phase 1 / Phase 2 交付物（依赖）
- `.planning/phases/01-simulation-core-3d-render/01-CONTEXT.md` — D-12（严禁模板模式）、D-07（顶部浮动 Toolbar 设计）持续约束
- `.planning/phases/02-entity-component-system-property-editing/02-CONTEXT.md` — D-09（仅暂停可编辑）、D-10（修改后立即反映到下次物理步长）、D-12（重置 = 空场景 + 暂停）持续约束；D-07/D-08 选中高亮模式可复用到弹簧
- `.planning/phases/02-entity-component-system-property-editing/02-VERIFICATION.md` — Phase 2 验证报告，技术债参考

### UI 设计规范
- `.planning/01-UI-SPEC.md` — 深色主题、毛玻璃风格、间距/排版/颜色合同。环境面板和弹簧创建对话框需遵守。

### 现有代码（Phase 2 交付）
- `frontend/src/ecs/types.ts` — 既有组件类型（Transform/RigidBody/Collider/Velocity/Material），**需新增 `ConstraintComponent` (kind: 'spring')**
- `frontend/src/ecs/Entity.ts` — Entity 工厂函数，弹簧实体可作为特殊实体类型注册
- `frontend/src/store/entitySlice.ts` — Map<string, Entity> CRUD（`addEntity`/`removeEntity`/`updateComponent`/`resetEntities`），需扩展级联删除逻辑（删除实体时移除其相关弹簧）
- `frontend/src/store/simulationSlice.ts` — `isRunning`/`showDebug`/`fps`/`resetCounter` 控制；**需新增 `environment: { gravity: Vector3, frictionScale: number, restitutionScale: number, drag: number }`**
- `frontend/src/store/uiSlice.ts` — UI 面板状态，**需新增 `isEnvironmentPanelOpen` 等 Phase 3 面板状态**
- `frontend/src/components/Scene3D.tsx` — Rapier `<Physics>` 集成，**需修改 gravity prop 接入 store；需添加弹簧 visual 子树**
- `frontend/src/components/Toolbar.tsx` — 顶部工具栏，**需添加"环境"按钮**
- `frontend/src/components/PropertyPanel.tsx` — 实体属性面板，**需扩展支持选中弹簧时的属性编辑**
- `frontend/src/components/EntityList.tsx` — 实体列表，**可能需要扩展显示场景中的弹簧条目**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **EntityRenderer.tsx 模式** —— Phase 2 已建立 ECS 组件 → R3F JSX 的渲染管线。弹簧渲染可参照同模式新增 `SpringRenderer` 组件（参考 `.planning/research/ARCHITECTURE.md` 4 层分离）
- **PropertyPanel 输入控件** —— 数字输入、滑块、Vector3 输入等组件可直接复用到环境面板和弹簧属性
- **shadcn/ui Dialog/Popover/Tabs** —— 已在 Phase 2 集成，环境面板可基于 Popover 构建
- **CreationDialog 模式** —— 弹簧创建对话框可参照 Phase 2 的实体创建对话框（zod 校验 + react-hook-form）
- **Outlines 选中高亮** —— Phase 2 D-07 已实现 3D 实体选中视觉，弹簧若可点击选中可复用

### Established Patterns
- **Map-based store** —— `entities: Map<string, Entity>` 模式适合扩展为 `springs: Map<string, Spring>`（或将 Spring 也作为 Entity 通过 ConstraintComponent 区分）
- **Zustand slicing** —— simulationSlice / entitySlice / uiSlice 三切片，环境参数自然落入 simulationSlice 扩展
- **PITFALLS #6 物理帧数据不经过 Zustand** —— 弹簧实时端点位置（拉伸长度、当前张力）必须直接从 Rapier 同步到 Three.js Object3D，不写 store
- **暂停时编辑 / 运行时只读** —— Phase 2 已建立 UI 模式，Phase 3 直接复用
- **Vitest + React Testing Library** —— 测试基础设施完整，弹簧物理行为可用单元测试覆盖

### Integration Points
- **Rapier `<Physics>` 的 gravity prop** —— Phase 1 当前硬编码 `[0, -9.81, 0]`，需改为从 simulationSlice 读取
- **Rapier ImpulseJoint API** —— @react-three/rapier 提供 `useSpringJoint` / `useDistanceJoint` hooks，需调研选择哪个最契合 distance + spring 物理
- **Friction `combineRule`** —— Rapier 在碰撞对级别计算摩擦组合，全局倍率变化触发碰撞对重建
- **`linearDamping` / `angularDamping`** —— 空气阻力可通过实体的 damping 实现，全局参数作为应用倍率
- **Toolbar 的"环境"按钮位置** —— 现有 Toolbar 包含 Play/Pause/Reset/Debug，环境按钮应放置在右侧一组（与功能性按钮分组）

</code_context>

<specifics>
## Specific Ideas

- **「严格 D-09」是用户的一致性优先取向** —— 用户多次表态优先保持设计一致性而非引入"环境参数运行时可调"这种特例。后续 Phase 也应延续此原则。
- **预设胶囊设计反映了用户的高中物理教学定位** —— 重力的地球/月球/火星/无重力四档预设、摩擦的几档预设是最常见的高中物理实验场景。废案教训持续生效：预设是「快选锚点」而非「场景模板」。
- **重力 X/Y/Z 分量输入** —— 用户偏向数学化精确表达而非可视化拖拽 gizmo。这与高中物理"自己拆分量、自己算"的解题思维契合。
- **倍率法修正而非覆盖** —— 用户清楚 Phase 2 已交付的实体级摩擦/弹性是核心能力，不愿因引入全局参数而破坏。倍率叠加是数学上最优雅的"二者并存"方案。
- **重置语义保留环境** —— 适配"重力调到月球档，反复添加不同物体测试自由落体"等教学场景。

</specifics>

<deferred>
## Deferred Ideas

- **弹簧之外的约束类型**（铰链/滑轨/固定）—— ConstraintComponent 的 kind 字段已设计为 'revolute' | 'prismatic' | 'spring' | 'fixed'，Phase 3 仅实现 'spring'。其他类型待 Phase 4+ 视用户需求决定
- **拖拽 gizmo 调重力方向** —— 视觉化交互方案，用户当前偏好 XYZ 输入框；待 v1 后用户反馈再考虑
- **环境参数预设保存/共享** —— 用户能否保存自定义"我的火星环境"作为预设；v2 SCN-03（场景保存）的扩展需求
- **Apply 按钮模式** —— 暂停时多参数批量提交，当前选择立即生效，未来如发现批量调试需求可补
- **弹簧串联系统的性能优化** —— 多弹簧 + 多体的 stiffness 矩阵求解性能上限，留给 Phase 6 性能优化阶段
- **真实世界物理常量数据库**（PROJECT.md 已明确 Out of Scope，但用户可能反复触及）—— 严守边界，每次提及都引导回简化系数

</deferred>

---

*Phase: 03-constraint-system-environment-config*
*Context gathered: 2026-05-02*
