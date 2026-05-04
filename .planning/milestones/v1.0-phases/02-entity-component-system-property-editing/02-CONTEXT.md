# Phase 2: 组件化实体系统与属性编辑 - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

替换 Phase 1 硬编码场景（INITIAL_SCENE_OBJECTS）——用户通过左侧工具箱自由添加实体（球体、方块、圆柱、斜面），点击 3D 场景中的实体选中后通过右侧属性面板编辑物理参数。底层采用完整 ECS 组件架构，实体行为由其附加的组件集合决定。

**不在本 Phase**: 约束系统（弹簧等，Phase 3）、全局环境参数配置（Phase 3）、轨迹与矢量可视化（Phase 4）、可视化拖拽放置（v2 SCN-01）、撤销/重做（deferred）。
</domain>

<decisions>
## Implementation Decisions

### ECS 架构
- **D-01:** 完整 ECS 变体实现——遵循 ARCHITECTURE.md Pattern 1（EntityNode + Component Map + System 函数）。不使用完整 ECS 框架（bitecs/javelin），自建约 300 行。
- **D-02:** 五件套组件集——Transform（位置/旋转/缩放）、RigidBody（类型/质量/弹性/摩擦）、Collider（形状/尺寸参数）、Velocity（初始线速度/角速度）、Material（颜色/渲染样式）。组件为纯数据，行为由 System 函数操作。
- **D-03:** ECS 层作为场景定义的数据模型——Rapier 的 RigidBody/Collider 仍由 @react-three/rapier 管理（物理权威），ECS 层提供类型安全、可组合性和序列化能力。物理帧数据不经过 Zustand（维持 PITFALLS #6 防护）。

### 实体添加
- **D-04:** 左侧独立浮动工具箱——与顶部 Toolbar（播放/暂停/重置/调试）分离。垂直排列形状图标按钮（球体/方块/圆柱/斜面）。可折叠。位置：视口左侧居中。
- **D-05:** 点击工具箱形状按钮 → 弹出创建配置对话框（模态）。对话框含：形状选择 + 尺寸参数 + 质量/弹性/摩擦 + 初始速度[x,y,z]（可选）+ 颜色（可选）。确认后实体生成于场景中心 (0, 5, 0)。
- **D-06:** 空场景初始状态——启动后场景仅含地面 + 参考网格 + RGB 坐标轴。用户通过工具箱添加所有物体。彻底移除 INITIAL_SCENE_OBJECTS。

### 属性编辑
- **D-07:** 3D 点击选择——Raycasting 检测点击物体，选中后高亮描边（outline 效果）。同时属性面板内的实体列表同步高亮对应条目。
- **D-08:** 右侧常驻属性面板——显示选中实体的全部可编辑参数。内含可滚动实体列表（名称 + 形状图标 + 颜色点），支持点击列表条目切换选中。
- **D-09:** 仅暂停时可编辑——模拟运行中（isRunning=true）属性面板只读。用户需暂停后才能修改参数。防止运行中误操作导致物理不一致。
- **D-10:** 全部物理参数可编辑——位置[x,y,z]、形状尺寸（球半径/方块半尺寸/圆柱半高半宽）、质量、弹性系数(0-1)、摩擦系数(0-1)、初速度[x,y,z]、颜色。修改后立即反映到下次物理步长。
- **D-11:** 支持单个实体删除——属性面板提供删除按钮 + Delete/Backspace 键盘快捷键。删除后实体从 ECS 和场景中同时移除。确认对话框防止误删。

### 重置行为
- **D-12:** 重置 = 空场景 + 暂停——清除所有用户添加的实体，场景回到初始状态（仅地面 + 网格 + 坐标轴）。物理世界通过 key 变化重新挂载（延续 CR-02 修复方案）。

### Claude's Discretion
- 3D 选中高亮的视觉样式（outline 颜色、粗细、动画）
- 创建对话框的精确 UI 布局和表单控件选择
- 实体列表在属性面板中的排序规则和展示样式
- 形状默认颜色生成算法（延续 Phase 1 柔和色彩调色板）
- ECS 组件内部数据结构的具体实现细节
- 属性面板滑块范围、步长、数值精度
</decisions>

<specifics>
## Specific Ideas

- 「空场景，不要做预设场景」——Phase 1 D-12 的延续，Phase 2 启动后场景必须是空的（仅地面），用户的一切从添加第一个物体开始
- 创建对话框 → 确认 → 实体出现的流程应流畅、即时，无延迟感
- 属性面板在暂停时应有清晰的「可编辑」视觉提示（如白色边框），运行时切换为灰色「只读」状态
- 废案教训持续有效：组件组合是唯一合法的场景搭建方式，绝不走模板化路线
</specifics>

<canonical_refs>
## Canonical References

### 项目定义
- `.planning/PROJECT.md` — 项目愿景、核心价值（组件组合自由搭建）、废案教训、技术约束
- `.planning/REQUIREMENTS.md` — DIF-01（组件化架构）、REN-03（属性面板编辑）映射到本 Phase
- `.planning/ROADMAP.md` — Phase 2 目标、成功标准（4 项全部 MUST verify）

### 架构与设计
- `.planning/research/ARCHITECTURE.md` — ECS 变体方案（Pattern 1）、EntityNode + Component Map 设计、项目结构模板。**必须完整阅读 Pattern 1-4 和 Anti-Patterns 章节。**
- `.planning/research/STACK.md` — 技术栈：Rapier WASM + React Three Fiber + Zustand + Vite
- `.planning/research/PITFALLS.md` — 关键陷阱：Zustand 重渲染风暴（#6）、可变时间步长（#1）、渲染层持有物理副本（#4）

### Phase 1 交付物（依赖）
- `.planning/phases/01-simulation-core-3d-render/01-CONTEXT.md` — Phase 1 实施决策（D-01~D-12），D-12 严禁模板模式持续约束
- `.planning/phases/01-simulation-core-3d-render/01-VERIFICATION.md` — Phase 1 验证报告，CR-01/CR-02 修复方案

### UI 设计
- `.planning/01-UI-SPEC.md` — 深色主题、工具栏毛玻璃风格、间距/排版/颜色合同。左侧工具箱和右侧属性面板需遵循此规范。

### 现有代码（Phase 1）
- `frontend/src/simulation/types.ts` — SceneObject 类型（将被 ECS 组件类型替代）
- `frontend/src/simulation/hardcodedScene.ts` — 硬编码场景数据（将被移除）
- `frontend/src/store/simulationSlice.ts` — Zustand store（需扩展 entity/selection 状态）
- `frontend/src/components/Scene3D.tsx` — 3D 渲染管线（需重构为 ECS 驱动）
- `frontend/src/components/Toolbar.tsx` — 顶部工具栏（保持，作为设计参考）
- `frontend/src/components/App.tsx` — 应用根组件（需整合新面板）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PhysicsObject` 组件（Scene3D.tsx:20-75）——当前基于 SceneObject 的渲染逻辑，可重构为基于 ECS 组件的通用渲染器
- `Ground` 组件（Scene3D.tsx:81-95）——Phase 2 保持不变
- Zustand `SimulationSlice`（simulationSlice.ts）——isRunning/showDebug/fps/resetCounter 控制逻辑完整可复用。需新增 entity/selection slice
- `@react-three/drei` 的 OrbitControls/GizmoHelper/Grid——摄像机控制和辅助视觉组件不变
- LoadingScreen + ErrorFallback——加载和错误处理组件保持不变

### Established Patterns
- Zustand 多 Slice 模式——延续 simulationSlice，新增 entitySlice + uiSlice
- @react-three/rapier 的 `<Physics>` + `<RigidBody>` + `<Collider>` 声明式 API——ECS 的 RigidBody/Collider 组件直接映射到这些 JSX 组件
- 固定 120Hz 时间步长 + 渲染插值——物理确定性架构不变
- 物理帧数据不经过 Zustand——仅元数据（isRunning、objectCount）在 store 中
- 暗色主题 + Tailwind v4 + shadcn/ui 工具——UI 组件统一风格
- Vitest + React Testing Library——测试基础设施可复用

### Integration Points
- Scene3D.tsx 的 `<Physics>` 子树——当前硬编码 `INITIAL_SCENE_OBJECTS.map()`，需改为从 ECS 实体管理器读取
- `simulationSlice.ts` 的 store——需新增 `entities: Map<string, Entity>` 状态和 `selectedEntityId` 状态
- `App.tsx` 的渲染树——需在 Scene3D + Toolbar 外增加工具箱面板 + 属性面板
- `types.ts`——SceneObject 类型需保留为向后兼容参考，新增 ECS 组件类型文件
</code_context>

<deferred>
## Deferred Ideas

- 撤销/重做——Phase 2 暂不实现，用户可用删除+重新创建替代。后续 Phase 评估基于 Zustand temporal middleware 的方案
- 可视化拖拽放置实体（SCN-01）——v2 需求，Phase 2 使用创建对话框替代
- 实体分组/层级关系——方便管理大型场景，但超出 Phase 2 范围
- 场景保存/加载（SCN-03）——需后端支持，v2 范围
- 实体的复制/粘贴快捷键——便利功能，defer 到 Phase 3+
</deferred>

---

*Phase: 02-entity-component-system-property-editing*
*Context gathered: 2026-05-01*
