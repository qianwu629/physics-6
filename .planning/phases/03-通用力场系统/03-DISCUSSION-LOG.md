# Phase 3: 通用力场系统 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 03-通用力场系统
**Areas discussed:** 力场实体与组件设计, 力场创建与编辑 UI, 力场 3D 可视化策略

---

## 力场实体与组件设计

### ForceField 实体在 ECS 中如何建模？

| Option | Description | Selected |
|--------|-------------|----------|
| 新组件类型 + 轻量实体（推荐） | 新增 ComponentType 'forceField'，ForceField 实体只含 transform + forceField 组件 | ✓ |
| 独立 Entity 类型 + 外挂系统 | ForceField 不走 ECS 体系，独立 forceFieldStore | |
| 混合方案 | 用户自定义 | |

**User's choice:** 新组件类型 + 轻量实体（推荐）
**Notes:** ForceField 实体不参与碰撞/渲染，与现有 shape 实体共享全局计数器。

### 电荷属性应该放在哪里？

| Option | Description | Selected |
|--------|-------------|----------|
| RigidBody 新增 charge 字段（推荐） | 在 RigidBodyComponent 上添加 charge: number（默认 0） | ✓ |
| 新增 charge 独立组件 | 新增 ComponentType 'charge' | |
| 力场实体自带 charge 字段 | 力场实体的 strength 字段表示电荷量 | |

**User's choice:** RigidBody 新增 charge 字段（推荐）
**Notes:** 带电实体自动响应电场力和洛伦兹力。与 mass/restitution/friction 并列。

### ForceField 组件字段设计

| Option | Description | Selected |
|--------|-------------|----------|
| 单 ComponentType + 联合类型（推荐） | ComponentType 'forceField'，内部 kind discriminated union | ✓ |
| 多 ComponentType | 4 个独立 ComponentType | |

**User's choice:** 单 ComponentType + 联合类型（推荐）
**Notes:** kind: 'uniform'|'gravity'|'electric'|'magnetic'。类似 ColliderComponent 的 shape 字段模式。

---

## 力场创建与编辑 UI

### 力场创建对话框

| Option | Description | Selected |
|--------|-------------|----------|
| 独立 ForceFieldDialog（推荐） | 新建 ForceFieldDialog.tsx，复用 Zod+react-hook-form | ✓ |
| 扩展现有 CreationDialog | 在 CreationDialog 中增加 Tab | |
| 混合方案 | 用户自定义 | |

**User's choice:** 独立 ForceFieldDialog（推荐）
**Notes:** 与 CreationDialog 零耦合，schema 完全独立。

### Toolbox 力场按钮布局

| Option | Description | Selected |
|--------|-------------|----------|
| 独立分区：4 个力场按钮（推荐） | 弹簧下方分隔线 + 4 个图标按钮 | ✓ |
| 单入口 + 类型选择内置 | 一个磁铁图标 → 对话框内切换类型 | |
| 下拉菜单 | 单按钮 + 弹出下拉菜单 | |

**User's choice:** 独立分区：4 个力场按钮（推荐）
**Notes:** 图标建议：ArrowUp/Crosshair/Zap/Magnet（lucide-react）。

### 力场参数编辑

| Option | Description | Selected |
|--------|-------------|----------|
| PropertyPanel 按实体类型分支（推荐） | 检测 forceField 组件 → 力场编辑 UI | ✓ |
| 独立 ForceFieldPanel 浮层 | 选中力场时弹出独立编辑面板 | |
| Inspector Drawer ForceField Tab | 新增「力场」Tab | |

**User's choice:** PropertyPanel 按实体类型分支（推荐）
**Notes:** 含 forceField → 强度 slider/范围 input/方向 vector/衰减选择；含 rigidBody → 现有 UI + charge 字段。

---

## 力场 3D 可视化策略

### 各力场类型可视化方案

| Option | Description | Selected |
|--------|-------------|----------|
| 按场类型自适应（推荐） | 方向场/磁场=箭头矩阵，引力/电场=半透明球体 | ✓ |
| 统一：全部用箭头矩阵 | 所有力场用网格箭头 | |
| 统一：全部用半透明体积 | 所有力场用半透明几何体 | |

**User's choice:** 按场类型自适应（推荐）
**Notes:** 每种场类型用最符合物理直觉的可视化。

### 渲染技术选择

| Option | Description | Selected |
|--------|-------------|----------|
| Three.js 内置几何体 + 标准材质（推荐） | SphereGeometry + ConeGeometry + InstancedMesh | ✓ |
| 自定义 ShaderMaterial | 自定义 shader 渐变透明/颜色映射 | |
| 其他方案 | 用户自定义 | |

**User's choice:** Three.js 内置几何体 + 标准材质（推荐）
**Notes:** InstancedMesh 批量渲染箭头矩阵保证性能。

---

## Claude's Discretion

以下领域由研究和规划确定最佳方案：
- 力线渲染技术方案（流线/电场线/磁感线）
- ForceFieldComponent 各子类型的精确字段定义
- 力场计算在物理步进中的精确插入点
- SceneSerializer 对 forceField 组件的扩展

## Deferred Ideas

无 — 讨论期间无范围外想法提出。
