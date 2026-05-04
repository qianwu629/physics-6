# Phase 4: 轨迹与矢量可视化 - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

在 Phase 2/3 已建成的 ECS 实体系统 + 约束系统 + 环境配置基础上，叠加两类可视化效果：

1. **运动轨迹残影（拖尾线条）** —— 记录并渲染每个动态实体的运动路径，以渐变褪色线条呈现
2. **矢量箭头叠加显示** —— 速度矢量（蓝色）和受力矢量（分力+合力，彩色）从实体中心发出

用户可通过 Toolbar 全局开关和属性面板按实体开关独立控制两类可视化。

**不在本 Phase**：
- 运动图表/数据导出（v2 ANL-01/02）
- 慢动作/时间操控（v2 ANL-03）
- 预设场景库
- 撤销/重做（持续 deferred）
</domain>

<decisions>
## Implementation Decisions

### 轨迹采样与存储策略

- **D-01:** 采样频率 30Hz（约每3帧记录一次）。平衡平滑度与内存占用。50个物体10秒运行约消耗 15,000 个三维点。
- **D-02:** 双限制存储策略：最大300点 + 最长5秒。先触发者截断（按时间或按点数任一条件满足即截断老数据）。
- **D-03:** 重置模拟时清空所有轨迹（与 Phase 2 D-12 "重置 = 空场景 + 暂停" 语义一致）。
- **D-04:** 全局开关 + 按实体开关并存。Toolbar 放全局轨迹显示按钮，属性面板中每个实体有独立轨迹开关。两者独立——关闭全局时所有轨迹隐藏，但单个开关状态保留，下次开启全局时按各自开关恢复。
- **D-05:** 渐变褪色视觉样式——轨迹头部（最近点）最亮最实，向尾部（最旧点）逐渐变暗变透明。营造"彗星尾巴"效果。
- **D-06:** 仅线条，无间隔残影（ghost snapshots）。保持简洁，避免额外几何渲染开销。
- **D-07:** 正常深度测试——轨迹线被其他物体遮挡时不可见。符合物理直觉。

### 受力矢量的信息来源与显示粒度

- **D-08:** 显示已知力（重力 + 弹力 + 空气阻力）+ 从 Rapier 碰撞事件估算接触力/摩擦力。已知力从 store/environment 和 ECS 组件直接计算；接触力通过监听 collision events 结合动量变化估算。
- **D-09:** 分力 + 合力并存。每个分力独立箭头（细线），再加一个粗一点的合力箭头。信息最全面，视觉层次分明。
- **D-10:** 颜色方案：速度统一蓝色；分力分色——重力灰色、弹力绿色、接触力红色、阻力黄色；合力白色粗箭头。
- **D-11:** 箭头长度对数比例（log10），压缩大范围数值差异，让小力也能在视觉上可见。
- **D-12:** 显示范围全局可切换：Toolbar 增加"全部显示 / 仅选中显示"按钮，默认全部显示。

### 叠加层控制 UI

- **D-13:** 轨迹开关和矢量开关都放在顶部 Toolbar（与 Phase 3 环境按钮同组），不占用常驻屏幕空间。Toolbar 按钮为 toggle 类型，图标区分轨迹/速度/受力三种。
- **D-14:** 三种叠加层（轨迹、速度矢量、受力矢量）各自独立开关，用户可任意组合开启。

### Claude's Discretion

- 轨迹线条具体宽度、淡出函数曲线（幂函数/指数函数/线性）
- 对数比例的具体系数和最小/最大长度裁剪值
- 3D 箭头的具体几何实现（@react-three/drei 的 Html 箭头 vs 自定义 Cone+Cylinder 组合）
- 碰撞事件估算接触力的具体算法实现（Δmomentum/Δt 或其他方案）
- 轨迹/矢量渲染器在 Scene3D 中的挂载顺序和层级关系
- 矢量开关的状态管理细节（uiSlice 扩展字段命名）
- 静止物体（速度接近零）是否继续记录轨迹点的策略
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目定义
- `.planning/PROJECT.md` — 项目愿景、组件组合自由搭建核心价值、废案教训（严禁模板化）
- `.planning/REQUIREMENTS.md` — DIF-02（轨迹残影）、DIF-03（矢量箭头）映射本 Phase
- `.planning/ROADMAP.md` § Phase 4 — 目标定义、5 项成功标准

### 架构与设计
- `.planning/research/ARCHITECTURE.md` — ECS 变体 Pattern 1（EntityNode + Component Map）。轨迹/矢量渲染器应遵循 EntityRenderer/SpringRenderer 的同模式。
- `.planning/research/STACK.md` — Rapier WASM + R3F + Zustand 技术栈
- `.planning/research/PITFALLS.md` — Pitfall #6（物理帧数据不经过 Zustand）。轨迹采样和矢量计算必须在渲染层通过 useRef 缓存，不得写入 store。

### Phase 1/2/3 交付物（依赖）
- `.planning/phases/01-simulation-core-3d-render/01-CONTEXT.md` — D-12（严禁模板模式）、D-07（顶部浮动 Toolbar）持续约束
- `.planning/phases/02-entity-component-system-property-editing/02-CONTEXT.md` — D-09（仅暂停可编辑）、D-07/D-08（3D 选中高亮 + 属性面板模式）持续约束；EntityRenderer 模式、RigidBodyRefContext 可复用
- `.planning/phases/03-constraint-system-environment-config/03-CONTEXT.md` — D-01（顶部 Toolbar 增加按钮弹出面板）、环境参数面板设计模式可复用到矢量控制

### UI 设计规范
- `.planning/01-UI-SPEC.md` — 深色主题、毛玻璃风格、间距/排版/颜色合同。Toolbar 新增按钮需遵守此规范。

### 现有代码（Phase 3 交付）
- `frontend/src/components/Scene3D.tsx` — ECS 实体渲染管线挂载点，新增轨迹/矢量渲染器的挂载位置
- `frontend/src/components/EntityRenderer.tsx` — 现有 ECS → R3F 渲染模式参照
- `frontend/src/components/SpringRenderer.tsx` — 约束渲染器模式参照
- `frontend/src/components/RigidBodyRefContext.tsx` — RigidBody ref 注册/查找机制，矢量箭头需要获取实体当前位置
- `frontend/src/components/Toolbar.tsx` — 顶部工具栏，需新增轨迹/矢量/显示范围切换按钮
- `frontend/src/components/PropertyPanel.tsx` — 属性面板，需扩展轨迹开关、实体级矢量开关
- `frontend/src/store/simulationSlice.ts` — environment 状态，重力/阻力数据来源
- `frontend/src/store/uiSlice.ts` — UI 面板状态，需新增轨迹/矢量/显示范围开关状态
- `frontend/src/store/entitySlice.ts` — entities Map CRUD，轨迹开关按实体存储
- `frontend/src/ecs/types.ts` — 组件类型定义，可能需新增轨迹开关组件或扩展 MaterialComponent
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **EntityRenderer / SpringRenderer 模式** —— 新增 `TrajectoryRenderer` 和 `VectorRenderer` 可参照同模式：接收 entity + isSelected + onSelect，在 Scene3D 的 `<RigidBodyRefContext.Provider>` 内挂载
- **RigidBodyRefContext** —— 注册/查找 RigidBody ref 的机制，矢量箭头需要获取实体当前世界坐标位置
- **Outlines 选中高亮** —— Phase 2 D-07 已实现 3D 实体选中视觉，轨迹/矢量的"仅选中显示"模式可复用选中状态
- **Toolbar 模式** —— Phase 3 环境按钮的 toggle + 弹出面板设计可复用，轨迹/矢量开关直接作为 toggle 按钮（无面板）
- **shadcn/ui Button/Toggle/Tabs** —— 已在 Phase 2 集成，Toolbar 新增按钮风格统一

### Established Patterns
- **PITFALLS #6 物理帧数据不经过 Zustand** —— 轨迹采样（位置历史）和矢量计算（速度/受力）必须在渲染层用 useRef 缓存，不得触发 React re-render。仅在开关状态变化时写 store。
- **Map-based store** —— `entities: Map<string, Entity>` 适合扩展为每个实体存储轨迹开关状态
- **Zustand slicing** —— simulationSlice / entitySlice / uiSlice 三切片，轨迹/矢量开关自然落入 uiSlice 扩展
- **固定 120Hz 时间步长 + 渲染插值** —— 物理确定性架构不变。轨迹采样在渲染帧（~60Hz）进行，与物理步长解耦
- **暂停时编辑 / 运行时只读** —— 叠加层开关是显示控制，不是编辑操作，不受 D-09 限制。运行中和暂停均可切换显示
- **Entity 的 components Map** —— 轨迹开关可作为新的组件类型（如 `TrailComponent`）注册到 entity 上，实现按实体开关

### Integration Points
- **Scene3D.tsx 的 `<Physics>` 子树内** —— 轨迹线和矢量箭头应在 Physics 子树内挂载（与实体同坐标系），或在 Physics 外作为 overlay（需手动同步坐标）。推荐在 Physics 内作为 `<group>` 挂载，利用 Rapier 的 transform 自动同步
- **Toolbar 按钮位置** —— 现有 Toolbar 包含 Play/Pause/Reset/Debug/环境按钮，轨迹/矢量/显示范围按钮应放置在右侧一组（与可视化控制分组）
- **PropertyPanel 扩展** —— 属性面板中每个实体需新增"显示轨迹"toggle 和"显示矢量"toggle
- **@react-three/rapier 的 RigidBody ref** —— 通过 `rigidBodyRef.current.translation()` 获取当前世界位置，用于计算矢量起点
- **Rapier 碰撞事件** —— `useContactForce` 或手动监听 collision events 估算接触力。需注意 Rapier WASM API 限制
</code_context>

<specifics>
## Specific Ideas

- PITFALLS #6 对轨迹/矢量的关键约束：每帧物理数据不经过 Zustand。轨迹历史数组和矢量计算结果必须用 useRef 持有，仅在用户切换开关时触发 store 写入。
- 渐变褪色轨迹的实现思路：Three.js `Line` + `BufferGeometry` + 顶点颜色（vertex colors），尾部顶点 alpha 渐变到 0。比创建多个 `LineSegment` 性能更好。
- 对数比例的具体实现：`length = baseLength × log10(1 + magnitude / scaleFactor)`，其中 scaleFactor 根据典型物理场景校准。
- 碰撞力估算思路：监听 Rapier 的 `collisionStarted`/`collisionStopped` 事件，记录碰撞期间的速度变化，结合质量和时间步长反推平均接触力。方向为碰撞法线方向。
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope
</deferred>

---

*Phase: 04-轨迹与矢量可视化*
*Context gathered: 2026-05-03*
