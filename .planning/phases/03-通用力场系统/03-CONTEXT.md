---
phase: 3
phase_name: 通用力场系统
milestone: v2.0 力场与多维模拟
date_created: "2026-05-17"
status: Locked (8 decisions confirmed)
---

# Phase 3 上下文 — 通用力场系统

## 上游参考

- ROADMAP: `.planning/ROADMAP.md` (v2.0 路线图)
- REQUIREMENTS: `.planning/REQUIREMENTS.md` — 需求编号 FIELD-01, FIELD-02, FIELD-03, FIELD-04
- Phase 1 CONTEXT: `.planning/phases/01-持久化与场景库/01-CONTEXT.md` (Entity factory pattern / MenuBar / Drawer)
- Phase 01.1 CONTEXT: `.planning/phases/01.1-ui/01.1-CONTEXT.md` (栅格化 + Phase 3 UI 预留入口)
- Phase 2 CONTEXT: `.planning/phases/02-实时物理量图表/02-CONTEXT.md` (独立 store 模式 + rAF 采样)

## 本阶段目标

引入 ForceField ECS 组件框架与至少 4 种预设力场（均匀方向场、点引力源、点电荷电场、均匀磁场），用户通过 UI 创建/编辑/删除力场实体；力场可视化为半透明体积或方向箭头矩阵；力线可视化叠加层可选。

---

<domain>
## Phase Boundary

**在范围内：**
- ForceField ECS 实体类型与组件（新 ComponentType 'forceField'，4 种 kind）
- 4 种预设力场的力计算：均匀方向场、点引力源（1/r²）、点电荷电场（库仑定律）、均匀磁场（洛伦兹力）
- RigidBody 新增 charge 字段，带电实体响应电磁力
- ForceFieldDialog（独立对话框，Zod+react-hook-form）
- Toolbox 力场按钮组（4 个图标按钮，弹簧下方）
- PropertyPanel 力场编辑分支（检测 forceField 组件 → 力场参数 UI）
- 力场 3D 可视化：箭头矩阵（方向场/磁场）+ 半透明球体（引力/电场）
- 力线可视化叠加层（流线/电场线/磁感线，Toolbar toggle 控制）
- ForceField 组件的 sceneSerializer 序列化/反序列化支持
- 预设场景：点电荷力场示例（Phase 1 D-01-07 推迟的第 6 个预设）

**不在范围内：**
- 表达式驱动外加力（Phase 4 EXPR-01/02）
- 摄像机控制变更（Phase 5）
- 时间操控（慢动作/逐帧/回放）— ANL-03, v3
- CSV 导出 — ANL-02, v3
- 多场景对比 — ANL-04, v3
</domain>

<decisions>
## Implementation Decisions

### 力场实体与组件设计
- **D-03-01:** 新增 `ComponentType 'forceField'`。ForceField 实体为轻量实体——仅含 `transform` + `forceField` 组件，不参与碰撞（无 collider/rigidBody），不直接渲染（可视化由独立渲染器处理）。与现有 ECS 实体共享同一全局计数器。
- **D-03-02:** 在 `RigidBodyComponent` 上新增 `charge: number` 字段（默认 `0` = 不带电）。带电实体（charge ≠ 0）自动响应电场力（F=qE）和洛伦兹力（F=qv×B）。与 mass/restitution/friction 并列——电荷是物理属性。
- **D-03-03:** ForceFieldComponent 使用单一 ComponentType + discriminated union：`kind: 'uniform' | 'gravity' | 'electric' | 'magnetic'`，各子类型有独立字段。类似 ColliderComponent 的 shape 字段模式。统一序列化和 UI 处理，计算层 switch(kind) 分发。

### 力场创建与编辑 UI
- **D-03-04:** 创建独立 `ForceFieldDialog.tsx`，复用 Zod + react-hook-form 验证模式（与 CreationDialog 一致的架构但独立的 schema）。对话框包含：力场类型选择器 + 各类型专用参数区（强度/范围/方向/衰减）+ 位置设置。
- **D-03-05:** Toolbox 在弹簧按钮下方新增分隔线 + 4 个力场图标按钮：均匀方向场（ArrowUp 图标）、点引力源（Crosshair 图标）、点电荷电场（Zap 图标）、均匀磁场（Magnet 图标）。点击 → `openForceFieldDialog(kind)` 预选类型。
- **D-03-06:** PropertyPanel 按实体组件类型分支渲染：检测到 `forceField` 组件 → 渲染力场参数编辑 UI（强度 slider、范围 input、方向 vector 输入、衰减模式选择）；检测到 `rigidBody` → 渲染现有物理属性 UI（含 charge 字段）。

### 力场 3D 可视化策略
- **D-03-07:** 按场类型自适应可视化方案：均匀方向场 = 箭头矩阵（InstancedMesh Cone + Cylinder，间距均匀，箭头方向 = 力方向，长度/颜色 = 强度）；点引力源 = 半透明球体（半径 = range，透明度从中心向外衰减）；点电荷电场 = 半透明球体 + 色调（正电荷 = 暖色/红，负电荷 = 冷色/蓝）；均匀磁场 = 箭头矩阵（均匀间距，方向 = B 场向量方向）。
- **D-03-08:** 渲染技术：Three.js 内置几何体（SphereGeometry, ConeGeometry, CylinderGeometry）+ MeshStandardMaterial（opacity + transparent），InstancedMesh 批量渲染箭头矩阵以保持性能。

### Claude's Discretion
以下领域由研究（researcher）和规划（planner）确定最佳方案：
- **ForceFieldComponent 精确字段定义：** 各 kind 的具体字段（如 uniform 的 direction+strength，gravity 的 strength+decay，electric 的 charge+decay，magnetic 的 direction+strength）由 researcher 根据物理公式确定。
- **力线渲染技术方案：** FIELD-04 的流线/电场线/磁感线——Three.js Line vs LineSegments vs Tube，力线密度计算，性能策略。researcher 研究最佳实践。
- **力场计算插入点：** 力场外力在物理步进中的精确调用位置（Rapier `beforeStep`？独立系统？），多力场叠加（矢量和）的实现方式。
- **SceneSerializer 扩展：** forceField 组件和 charge 字段的序列化/反序列化 schema 更新。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 3 — 力场系统目标与成功标准
- `.planning/REQUIREMENTS.md` — FIELD-01, FIELD-02, FIELD-03, FIELD-04

### 上游阶段上下文（已锁定决策）
- `.planning/phases/01-持久化与场景库/01-CONTEXT.md` — Entity 工厂模式、MenuBar/Drawer 模式、序列化架构
- `.planning/phases/01.1-ui/01.1-CONTEXT.md` — 栅格化三栏布局、Toolbox 结构、Inspector Drawer Tab 设计、Phase 3 预留 UI 入口（D-01.1-10）
- `.planning/phases/02-实时物理量图表/02-CONTEXT.md` — 独立 store 模式、PITFALLS #6 防护、rAF 采样策略

### 架构与代码
- `.planning/PROJECT.md` — ECS 架构、技术栈、废案教训
- `frontend/src/ecs/types.ts` — ComponentType 联合、组件接口定义
- `frontend/src/ecs/Entity.ts` — 实体工厂函数模式
- `frontend/src/store/entitySlice.ts` — 实体 CRUD 操作 + MAX_ENTITIES
- `frontend/src/store/simulationSlice.ts` — 环境参数 + 重力设置
- `frontend/src/components/CreationDialog.tsx` — Zod+react-hook-form 对话框模式
- `frontend/src/components/Toolbox.tsx` — 工具按钮布局模式
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Entity factory pattern** (`Entity.ts`): `createEntity(id, name, components[])` + 全局计数器 — ForceField 实体复用此模式
- **CreationDialog** (`CreationDialog.tsx`): Zod schema + react-hook-form + Slider/Input 控件 — ForceFieldDialog 参照此架构
- **entitySlice** (`entitySlice.ts`): addEntity/removeEntity/updateComponent — ForceField 实体直接使用现有 CRUD（MAX_ENTITIES=50 统一限制）
- **ColliderComponent shape discriminated union** (`types.ts`): `shape: 'sphere'|'cuboid'|'cylinder'` — ForceFieldComponent 的 kind 联合参照此模式

### Established Patterns
- **PITFALLS #6:** Per-frame 物理数据绕过 Zustand。力场计算在物理步进中直接调用 Rapier API，结果不触发 React 重渲染
- **120Hz 固定时间步长:** 力场外力在 Rapier 物理步进前或步进中注入（via RigidBody.applyForce 或 beforeStep hook）
- **组件检测分支 UI:** PropertyPanel 已对 shape 实体做参数编辑 — 扩展为检测 forceField 组件并渲染力场专用 UI
- **独立 store 模式 (Phase 2):** chartDataStore — 力场可能需要 forceFieldStore 管理可视化状态（toggle/透明度/力线开关）

### Integration Points
- **Toolbox** (`Toolbox.tsx`): 弹簧按钮下方添加力场按钮组（新分隔线 + 4 个图标）
- **PropertyPanel**: 检测 `entity.components.has('forceField')` → 渲染力场 UI 分支
- **Scene3D** (`Scene3D.tsx`): 新增 ForceFieldRenderer 组件（箭头矩阵 + 半透明球体）、ForceFieldLines 组件（力线叠加层）
- **EntityRenderer** (`EntityRenderer.tsx`): ForceField 实体不需要常规 Shape 渲染（无 collider）— 在 switch 中添加 forceField case 或跳过
- **sceneSerializer** (`sceneSerializer.ts`): 新增 forceField 组件和 charge 字段的序列化
- **Toolbar**: 新增「力线」toggle 按钮（FIELD-04）
- **预设场景**: Phase 1 推迟的点电荷力场示例（第 6 个预设）
</code_context>

<specifics>
## Specific Ideas

- **Toolbox 力场按钮图标建议:** 均匀方向场=ArrowUp, 点引力源=Crosshair, 点电荷电场=Zap, 均匀磁场=Magnet（均来自 lucide-react，已安装）
- **点电荷力场预设场景:** 应在 Phase 3 实现后立即添加（Phase 1 D-01-07 推迟项），作为 2 个带电球体 + 点电荷电场的教学示例
- **力线密度映射:** 力线密度应反映场强——强场区域力线更密集。参考物理教科书中的电场线/磁感线图示风格
- **可视化透明度:** 力场体积默认半透明（opacity ≈ 0.15-0.25），避免遮挡 3D 场景中的实体
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### 已知后续依赖
- 点电荷力场预设场景（Phase 1 D-01-07 推迟）→ Phase 3 实现力场后立即补上
- Phase 4 表达式驱动外加力 → 依赖本阶段的力场架构
</deferred>

---

*Phase: 03-通用力场系统*
*Context gathered: 2026-05-17*
