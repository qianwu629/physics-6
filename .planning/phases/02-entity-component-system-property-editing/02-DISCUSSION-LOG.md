# Phase 2: 组件化实体系统与属性编辑 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-05-01
**Phase:** 02-entity-component-system-property-editing
**Areas discussed:** ECS架构, 实体添加方式, 属性面板与选择, 创建对话框字段, 实体列表, 重置行为, 删除功能, 撤销, 形状尺寸设置

---

## ECS 架构深度

| Option | Description | Selected |
|--------|-------------|----------|
| 简约组合 | 形状组件 + 物理属性组件，约150行 | |
| 完整ECS（推荐） | ARCHITECTURE.md EntityNode + Component Map，约300行 | ✓ |
| 渐进式 | 实体+属性字典，保留清晰边界但不构建System调度 | |

**User's choice:** 完整ECS（推荐）
**Notes:** 为 Phase 3 约束系统和 Phase 4+ 多物理领域做准备。完整的 EntityNode + Component Map 模型。

---

## ECS 组件集

| Option | Description | Selected |
|--------|-------------|----------|
| 最小三件套 | Transform + RigidBody + Collider | |
| 五件套 | +Velocity +Material | ✓ |
| 完整框架 | +EntityManager +ComponentRegistry | |

**User's choice:** 五件套（Transform + RigidBody + Collider + Velocity + Material）
**Notes:** Velocity 让用户设置初始速度，Material 分离视觉属性为独立组件——体现ECS组合理念。

---

## 实体添加方式

| Option | Description | Selected |
|--------|-------------|----------|
| 左侧独立工具箱（推荐） | 垂直形状按钮，与Toolbar分离，可折叠 | ✓ |
| 顶部扩展 | 合并到现有Toolbar | |
| 浮动扇形菜单 | 圆形扇形快捷菜单 | |

**User's choice:** 左侧独立工具箱（推荐）
**Notes:** Toolbar保持顶部（播放/暂停/重置/调试），工具箱在左侧垂直排列。

---

## 实体创建配置面板（初始放置方式）

| Option | Description | Selected |
|--------|-------------|----------|
| 场景中心生成 | 点击后在(0,5,0)生成 | |
| 放置模式 | 预览+点击放置 | |
| 视线前方生成 | 摄像机前方5单位 | |
| 控制面板 | 弹出配置对话框，含数值输入设置基本物理量 | ✓ (User custom) |

**User's choice:** 自定义方案——创建控制面板（弹出对话框），用户可在其中通过数值输入设定实体参数后确认生成。
**Notes:** 用户希望在创建前就能精确控制实体的物理参数，而非事后编辑。

---

## 属性面板与选择

| Option | Description | Selected |
|--------|-------------|----------|
| 3D点击选择+右侧面板 | Raycasting选择+高亮+右侧属性面板 | ✓ |
| 底部抽屉面板 | 底部滑出 | |
| 浮动属性卡片 | 鼠标位置弹出 | |

**User's choice:** 3D点击选择 + 右侧面板
**Notes:** 需要 raycasting 检测 + outline 高亮效果。

---

## 面板关系（创建 vs 属性）

| Option | Description | Selected |
|--------|-------------|----------|
| 创建对话框+属性面板 | 两个独立面板，不同的生命周期和位置 | ✓ |
| 统一右侧面板 | 双模式切换 | |

**User's choice:** 创建对话框 + 属性面板（推荐）——两个独立面板
**Notes:** 创建时弹出模态对话框，选中已有实体时右侧显示属性面板。

---

## 编辑规则

| Option | Description | Selected |
|--------|-------------|----------|
| 运行时实时编辑 | 运行中修改即时生效 | |
| 仅暂停时可编辑 | 运行中属性面板只读 | ✓ |
| 位置可编辑 | x,y,z三维输入 | ✓ |
| 全部物理参数可编辑 | 位置/质量/弹性/摩擦/初速度/颜色/尺寸 | ✓ |

**User's choice:** 仅暂停时可编辑 + 全部物理参数可编辑
**Notes:** 防止运行中误操作。暂停时面板清晰显示「可编辑」状态。

---

## 创建对话框字段

| Option | Description | Selected |
|--------|-------------|----------|
| 形状+位置+尺寸 | 形状选择、初始位置、尺寸参数 | ✓ (later) |
| 物理参数 | 质量、弹性、摩擦 | ✓ |
| 初速度+颜色 | 可选字段 | ✓ |

**User's choice:** 物理参数 + 初速度/颜色，创建时设置尺寸
**Notes:** 形状由工具箱按钮决定。全部字段最终纳入创建对话框——形状、尺寸、物理参数、初速度、颜色。

---

## 实体列表

| Option | Description | Selected |
|--------|-------------|----------|
| 属性面板内含 | 可滚动列表，名称+图标+颜色点 | ✓ |
| 独立面板 | 独立管理场景层级 | |
| 仅3D选择 | 无列表 | |

**User's choice:** 属性面板内含实体列表
**Notes:** 列表支持点击切换选中，与3D点击互为补充。

---

## 删除功能

| Option | Description | Selected |
|--------|-------------|----------|
| 支持删除 | 属性面板按钮+Delete快捷键 | ✓ |
| 仅全局重置 | 无单个删除 | |

**User's choice:** 支持删除（推荐）
**Notes:** 确认对话框防止误删。删除后从ECS和渲染中同时移除。

---

## 重置行为

| Option | Description | Selected |
|--------|-------------|----------|
| 空场景 | 仅地面+网格+坐标轴 | ✓ |
| 保留硬编码物体 | Phase 1风格压力测试场景 | |
| 用户自定义初始场景 | 预设默认实体配置 | |

**User's choice:** 空场景（仅地面）
**Notes:** 彻底移除硬编码场景——体现组件组合自由搭建理念。物理世界通过key变化重新挂载。

---

## 撤销/重做

| Option | Description | Selected |
|--------|-------------|----------|
| 暂不实现 | 后续Phase评估 | ✓ |
| 基础撤销 | Zustand temporal middleware | |

**User's choice:** 暂不实现（推荐）
**Notes:** 界面增强功能，不是Phase 2核心能力。用户可用删除+重新创建替代。

---

## Claude's Discretion

- 3D选中高亮的视觉样式（outline颜色、粗细、动画效果）
- 创建对话框的精确UI布局和表单控件选择
- 实体列表在属性面板中的排序规则和展示样式
- 形状默认颜色生成算法（延续Phase 1柔和色彩调色板）
- ECS组件内部数据结构的具体实现
- 属性面板滑块范围、步长、数值精度
- 确认删除对话框的具体文案和按钮布局

## Deferred Ideas

- 撤销/重做功能——Phase 3+ 评估
- 可视化拖拽放置实体（SCN-01）——v2需求
- 实体分组/层级关系——超出Phase 2范围
- 场景保存/加载（SCN-03）——需后端支持
- 实体复制/粘贴快捷键——Phase 3+
