# Project Research Summary

**Project:** Physis — 组件化物理模拟平台
**Domain:** Web 物理模拟平台（高中经典力学，组件化架构）
**Researched:** 2026-04-30
**Confidence:** HIGH

## Executive Summary

Physis 是一个基于 Web 的组件化物理模拟平台，目标用户为高中物理学生。其核心价值主张是**组件化自由组合**——用户通过组合基础物理原语（形状、力场、约束）自由搭建任意场景，而非使用预制模板。这一理念直接源于前身项目的失败教训：模板化架构导致用户被限制在预设场景中，无法自由探索。

经过对物理引擎、3D渲染、状态管理、构建工具、架构模式和常见陷阱五个维度的全面调研，推荐技术栈为 **Rapier (WASM) + React Three Fiber (R3F) + Zustand + Vite**。Rapier 基于 Rust/WASM 编译，性能是纯 JS 引擎 Matter.js 的 3-15 倍，是 2025-2026 年 Web 物理引擎的明确赢家。React Three Fiber 将 Three.js 的渲染能力与 React 的组件化模型结合，天然匹配项目的组件组合架构理念。Zustand 已在现有代码中使用，轻量且适合实时仿真状态流。

关键风险有三：一是可变时间步长导致的跨设备行为不一致（必须从第一天采用固定步长累加器模式）；二是高频物理数据通过 Zustand 触发 React 重渲染风暴（需要瞬态更新机制旁路 React reconciliation）；三是 WASM 引擎在移动端的兼容性问题（需要在引擎选型阶段就在真机 iOS Safari 和 Android Chrome 上验证）。三种风险均可通过架构设计在早期阶段规避。

## Key Findings

### Recommended Stack

**核心决策：Rapier (WASM) + React Three Fiber + Zustand + Vite**

**为什么选择 Rapier 2D 而非 3D：** 高中经典力学（抛体、斜面、碰撞、圆周运动、弹簧振子）本质是二维物理。项目要求在 3D 视角下模拟 2D 物理，Rapier2D 性能优于 Rapier3D（更少计算维度），且通过抽象层设计未来可平滑迁移到 Rapier3D。

**Core technologies:**
- **@dimforge/rapier2d-compat (^0.19.3) + @react-three/rapier (^2.2.0):** 物理引擎核心。Rust/WASM 编译，compat 构建内联 WASM base64 无需额外配置。R3F 绑定以 JSX 声明物理世界，消除命令式样板。性能：4500 物体时 Rapier 120fps vs Matter.js 38fps。
- **React (^19.x) + React Three Fiber (^9.x) + @react-three/drei (^9.x):** UI 与 3D 渲染。R3F 将 3D 场景映射为 React 组件树，与项目的"物理原语自由组合"理念一致。Drei 提供 OrbitControls、网格、辅助线等开箱即用组件。
- **three.js (^0.172.x):** 底层渲染引擎。WebGL + WebGPU 双后端，r171+ 生产级 WebGPU 支持，Three.js Shading Language (TSL)。
- **zustand (^5.0.x) + zundo (^2.x):** 全局状态管理与时间旅行。极轻量（~1KB），切片模式支持模块化。zundo 中间件提供仿真步骤的 undo/redo。
- **Vite (^6.x):** 构建工具。2026 前端构建事实标准，原生 ESM 开发服务器，对 WASM 模块一流支持。
- **comlink (^4.4.2):** Web Worker RPC 通信（按需）。将 Worker 中的 Rapier API 暴露为异步代理对象。

**关键架构决策：**
- 主线程物理运行 v1（高中场景 <50 实体，主线程完全可行），架构预留 Worker 迁移路径
- 单 Zustand Store 多 Slice 模式（物理、场景、仿真控制、UI 各一个 slice）
- 自建轻量 ECS 变体（不使用完整 ECS 框架如 bitecs），约 200 行代码，与 Rapier Body Handle 直接映射

### Expected Features

**Must have (Table Stakes — v1 MVP):**
- 基础刚体形状（球体、方块、平面/斜面）—— 所有场景的构建单元
- 重力与环境参数配置 —— 经典力学第一前提
- 碰撞检测与响应 —— 物理模拟的核心
- 实时 3D 渲染 + 摄像机控制 —— 用户"看到"物理的基础
- 播放/暂停/重置控制 —— 基本交互控制
- 物体属性编辑面板（质量、初速度、位置、摩擦/弹性系数） —— "调参做实验"的核心交互
- 弹簧约束 —— 弹簧振子是高中物理必学内容
- 可视化拖拽场景搭建 —— 核心理念的载体，与模板化竞品的根本区别
- 轨迹/残影 —— 低复杂度、高感知价值

**Should have (v1.x — 核心循环验证后):**
- 矢量可视化叠加层（速度/力箭头） —— 在 3D 中"看到"抽象物理量
- 实时运动图表（位置-时间、速度-时间图） —— 高中物理核心分析工具
- 时间操控（慢动作、逐帧步进） —— 深度分析工具
- 场景保存/加载（本地） —— 有值得保存的场景之后才有意义
- 数据导出（CSV） —— 依赖图表系统的数据采集管线

**Defer (v2+):**
- 多场景并行对比 —— 架构挑战大，需要多世界架构
- 场景 URL 分享 —— 需要服务端基础设施
- 完整时间回放（带时间轴拖拽） —— 内存/性能挑战
- 测量工具（虚拟直尺、量角器） —— 3D 空间中的测量 UI 交互设计复杂
- 物理领域扩展（光学、电磁、热力学） —— 架构预留插件接口但 v1 只做力学
- 脚本/编程接口 —— 高级用户自定义行为

**明确不构建（Anti-Features）:**
- 预制题目模板（违背核心设计理念，废案失败的根本原因）
- 移动端 App（项目约束明确排除）
- 多人实时协作（v1 技术复杂度巨大）
- 照片级真实渲染（分散物理精度关注点；采用"卡通式清晰"风格）
- 自动解题功能（鼓励惰性学习）
- 物理常量数据库（高中使用简化系数）

### Architecture Approach

采用四层分离架构，核心原则：**物理拥有真相，渲染只是镜子。**

**Major components:**
1. **仿真核心层 (simulation/)：** 纯 TypeScript 逻辑，零依赖 React/Three.js。包含 PhysicsWorld（Rapier 封装）、SceneGraph（DAG 结构）、ECS 组件与系统、SimulationLoop（固定步长累加器）、领域插件接口。可无头运行和测试。
2. **渲染层 (rendering/)：** 只读层，从仿真核心读取 PhysicsSnapshot 并同步到 Three.js Object3D。绝不修改物理状态。包含 Scene3D、RenderLoop、物体渲染器工厂。
3. **状态管理层 (store/)：** Zustand 单 Store 多 Slice 模式。sceneStore（场景定义 JSON）、simStore（仿真生命周期）、uiStore（编辑/选择状态）。桥接 UI 和仿真核心。
4. **编辑器层 (editor/)：** React UI 层，包含 EditorCanvas（拖拽区域）、Toolbox（组件工具箱）、PropertyPanel（属性面板）、SceneHierarchy（场景层级树）。通过 store actions 间接操作仿真核心。

**关键模式：**
- **ECS 变体场景图：** 实体节点附加任意物理组件（RigidBody、Collider、Force、Constraint），用户自由组合。自建轻量实现，不引入完整 ECS 框架。
- **固定时间步长 + 状态插值：** 物理以固定 120Hz 步进（或 60Hz v1），渲染以显示器刷新率运行。累加器收集帧时间差，插值因子平滑渲染。
- **单向物理-渲染桥接：** PhysicsWorld 是权威状态持有者，SyncSystem 每帧单向读取变换并应用到 Three.js 对象。
- **领域插件架构：** 每个物理领域实现 IDomainPlugin 接口，向核心框架注册组件类型和系统。从第一天就采用此架构，避免日后重构。

**数据流：**
```
用户拖拽 → EditorCanvas action → sceneStore.addEntity() → PhysicsWorld.createEntity() → SyncSystem.register() → Three.js 出现新物体
用户点击开始 → simStore.startSimulation() → SimulationLoop { step → snapshot → sync → render } 循环
```

### Critical Pitfalls

从 10 个已识别的陷阱中，以下 5 个为最高优先级，必须在 Phase 1 就规避：

1. **可变时间步长物理积分（CRITICAL）：** 绝不能将 rAF 的 deltaTime 直接传给 world.step()。必须使用固定步长累加器模式（Gaffer on Games 经典方案），配合 MAX_STEPS 上限和 tab-out 保护。这是物理模拟正确性的基石，选错了就是重写。

2. **"先做功能，后加 3D"的开发顺序陷阱（CRITICAL）：** 不要在纯 2D 引擎上开发完所有逻辑后再"加 3D 视图"。Day 1 就使用 3D 物理引擎（Rapier），数据模型从第一天就支持 {x, y, z} 和四元数旋转。否则后期"加 3D"本质上是架构重构。

3. **Zustand 高频更新触发 React 重渲染风暴（HIGH）：** 物理引擎每 16.67ms 产生一帧数据，直接通过 setState 写入 Zustand 会导致每个订阅组件每帧重渲染。解决方案：热路径使用 Transient Updates（旁路 React，通过 subscribe + ref 直接更新 Three.js mesh），UI 状态降频写入（15-30fps）。

4. **物理状态与 3D 渲染差一帧（Frame Lag）（HIGH）：** 物理步进、矩阵同步、渲染执行之间存在隐式顺序依赖。必须严格执行管线顺序：world.step() → setMatrixAt() → renderer.render()，绝不能颠倒。

5. **WASM 引擎在移动端的兼容性问题（MEDIUM-HIGH）：** 桌面端完美运行的 WASM 引擎在移动端可能因 32 位模式内存限制而崩溃。必须在引擎选型阶段就在真机 iOS Safari 和 Android Chrome 上验证。设定 WASM 内存上限 256MB，实现降级方案（纯 JS 引擎作为 fallback）。

其他值得注意的陷阱：组件粒度过细导致 GetComponent 热路径开销、每帧创建对象引发 GC 抖动、浮动点数跨浏览器非确定性（接受同运行时确定性即可）。

## Implications for Roadmap

基于四份研究报告中的依赖关系、架构构建顺序和陷阱防范需求，建议以下阶段结构：

### Phase 1: 仿真核心与基础 3D 渲染

**Rationale:** 物理引擎和渲染管线是整个系统的地基。STACK.md 确定了 Rapier + Three.js/R3F 的技术选型，ARCHITECTURE.md 的构建顺序分析确认仿真核心无外部依赖应首先构建。PITFALLS.md 明确指出可变时间步长、渲染帧差、坐标系不匹配、3D 推迟陷阱必须在第一天解决。

**Delivers:** 一个可运行的物理沙盒 —— 球体和方块在重力下下落、碰撞、堆叠，用户可在 3D 视图中旋转观察。

**Implements:**
- PhysicsWorld（Rapier 封装）+ SceneGraph（DAG 实体管理）
- SimulationLoop（固定步长 60Hz + 累加器 + MAX_STEPS 保护）
- SyncSystem（物理快照 → Three.js Object3D 单向同步）
- Three.js 场景初始化 + OrbitControls
- 基础刚体形状渲染器（球体、方块、平面/斜面）
- 播放/暂停/重置控制
- 执行管线顺序验证：step → sync → render

**Addresses features:** 基础刚体形状、重力配置、碰撞检测与响应、实时 3D 渲染、3D 摄像机控制、播放/暂停/重置

**Avoids:** Pitfall 1（可变时间步长）、Pitfall 3（物理-渲染帧差）、Pitfall 8（坐标系不匹配）、Pitfall 10（3D 推迟陷阱）

**Research flag:** 需要研究阶段 —— Rapier + R3F 集成细节（@react-three/rapier 的 JSX 声明式 API、Collider 形状配置）、Vite + WASM 打包配置（optimizeDeps.exclude、COOP/COEP 头设置）

---

### Phase 2: 组件化场景搭建

**Rationale:** 这是项目核心理念的实现载体。Phase 1 完成后有了可运行的物理世界，Phase 2 让用户能够通过拖拽自由搭建场景。ARCHITECTURE.md 的 ECS 场景图设计在此阶段落地。PITFALLS.md 警告组件粒度过细问题，需在此阶段确定组件数据结构设计。

**Delivers:** 用户可拖拽球体/方块/斜面到画布，调整属性，添加弹簧，场景即时反应。

**Implements:**
- 轻量 ECS 实体-组件系统（EntityNode + Component 数据容器）
- 场景编辑器（Toolbox 工具箱 + EditorCanvas 拖拽画布）
- 物体属性编辑面板（质量、位置、速度、摩擦/弹性系数）
- 弹簧约束（Rapier distance joint）
- 环境参数配置面板（重力强度/方向、空气阻力系数）
- 轨迹/残影渲染

**Uses:** @react-three/drei（OrbitControls、网格辅助线、HTML 叠加层）、Zustand sceneStore slice

**Addresses features:** 可视化拖拽场景搭建、物体属性编辑、弹簧约束、环境参数配置、轨迹/残影

**Avoids:** Pitfall 2（组件粒度过细 —— 相关物理数据放在同一组件中，避免微组件拆分）

**Research flag:** 需要研究阶段 —— 拖拽交互的 3D 射线检测实现（Three.js Raycaster vs R3F 事件系统）、ECS 组件序列化格式设计、场景图父子变换传播

---

### Phase 3: 状态管理与 UI 完善

**Rationale:** Phase 2 完成后场景搭建能力就绪，Phase 3 完善状态管理架构、仿真生命周期控制和 UI 面板系统。PITFALLS.md 的 Zustand 重渲染风暴警告需在此阶段通过架构设计规避。

**Delivers:** 完整的 UI 控制面板、仿真生命周期管理、场景本地保存/加载。

**Implements:**
- Zustand Store 切片架构落地（sceneStore、simStore、uiStore 三个切片组合）
- 仿真生命周期 actions（创建/启动/暂停/重置/销毁模拟）
- 场景层级树面板（SceneHierarchy）
- 场景保存/加载（本地 JSON 序列化/反序列化）
- Transient Update 机制（物理帧数据旁路 React，通过 subscribe + ref 直接驱动 Three.js）
- UI 状态降频写入（simulationTime 等以 15-30fps 更新）

**Uses:** zustand v5 slice pattern, zundo（undo/redo 中间件）

**Addresses features:** 场景保存/加载（本地）

**Avoids:** Pitfall 6（Zustand 重渲染风暴 —— 热路径使用 subscribe + ref，UI 数据降频写入，选择器使用 useShallow）

**Research flag:** 可跳过深入研究 —— Zustand slicing pattern 和 transient updates 是文档完善的模式；需要关注的是 zundo 与高频物理状态的集成可行性

---

### Phase 4: 高级可视化与分析工具

**Rationale:** 这是 Physis 区别于 Algodoo/Physion 等纯沙盒的关键差异化层。Phase 1-3 确保基础模拟正确，Phase 4 添加分析工具。FEATURES.md 的依赖图显示图表、矢量可视化、数据导出都依赖统一的数据采集管线——应作为子系统统一设计。

**Delivers:** 实时运动图表、矢量可视化叠加层、慢动作/步进控制、CSV 数据导出。

**Implements:**
- 统一数据采集管线（每物理步长采集状态快照 → 时序数据缓冲区）
- 实时运动图表（x-t、v-t、a-t 图，Canvas/SVG 渲染，多对象叠加对比）
- 矢量可视化叠加层（速度/力/加速度箭头，颜色编码，可切换显示）
- 时间操控（慢动作 0.1x-2x、逐帧步进）
- CSV 导出（时序数据序列化为 CSV 下载）

**Uses:** Canvas 2D API 或轻量图表库用于图表渲染

**Addresses features:** 实时运动图表、矢量可视化叠加层、时间操控（慢动作/步进）、数据导出 CSV

**Avoids:** 无需特殊规避已知陷阱，但需注意数据采集缓冲区的内存管理（环形缓冲区，限制最大记录帧数）

**Research flag:** 需要研究阶段 —— 高性能时序图表渲染方案（Canvas vs SVG vs WebGL）、多对象图表叠加的视觉设计、矢量箭头的 3D 箭头几何体实现

---

### Phase 5: 多场景对比与分享

**Rationale:** 多场景并行对比是科学方法的直接体现（改变单一变量对比结果），教育价值极高但技术复杂度也高。FEATURES.md 指出多场景并行对比与时间操控存在冲突（各场景需要独立时间轴），建议先实现并排展示独立场景。

**Delivers:** 并排多场景对比、场景 URL 分享、完整时间回放。

**Implements:**
- 多 PhysicsWorld 实例管理（每个场景独立物理世界）
- 并排视口布局（或标签页切换）
- 场景 JSON 序列化 → Base64 URL 编码分享
- 完整时间回放（状态快照记录 + 时间轴拖拽 UI）
- 测量工具（虚拟直尺、量角器、秒表）

**Uses:** 后端 REST API（场景存储）、WebSocket（可选实时同步）

**Addresses features:** 多场景并行对比、场景 URL 分享、完整时间回放、测量工具

**Research flag:** 需要研究阶段 —— 多世界架构的资源管理（多个 Rapier World 实例的内存占用）、时间回放的状态存储策略（关键帧 + 增量 vs 全量快照）

---

### Phase 6: 性能优化与领域扩展

**Rationale:** 在核心功能验证完成后进行性能优化和架构扩展。STACK.md 的 Worker 迁移策略（Phase 2: comlink → Phase 3: SharedArrayBuffer）在此阶段执行。领域插件架构正式化，为 v2 的电磁/光学/热力学扩展做准备。

**Delivers:** Web Worker 物理计算、InstancedMesh 渲染优化、领域插件接口正式化。

**Implements:**
- 物理计算迁移到 Web Worker（comlink RPC）
- InstancedMesh 批量渲染（减少 draw calls）
- 视锥剔除 + LOD
- IDomainPlugin 接口完善（力学领域作为参考实现）
- 性能基准测试（100+ 物体 >30fps）

**Uses:** comlink（Worker RPC）、SharedArrayBuffer（零拷贝方案，需 COOP/COEP 头）

**Avoids:** Pitfall 5（WASM 移动端 —— 验证 Worker 化后移动端内存占用）、Pitfall 4（GC 抖动 —— SoA 布局 + 对象池化）、Pitfall 9（用户数据量超预期 —— 设定系统容量上限）

**Research flag:** 可跳过深入研究 —— Worker + WASM 集成模式有 comlink 成熟方案；InstancedMesh 是 Three.js 标准优化模式

---

### Phase Ordering Rationale

- **Phase 1 必须在最前面：** 仿真核心和渲染管线是整个系统的地基。所有其他层（场景编辑、状态管理、分析工具）都依赖正确运行的物理世界和 3D 视图。PITFALLS.md 明确警告"先做功能后加 3D"会导致架构重构。
- **Phase 2 紧随 Phase 1：** 组件化场景搭建是核心理念的载体，需在物理世界就绪后立即实现。这是与 PhET 等演示型平台的根本区别——用户必须能从第一天就自由搭建。
- **Phase 3 与 Phase 2 可并行：** 状态管理架构设计可以与场景编辑器并行开发，但 Zustand 的 Transient Update 机制需要在连接物理引擎和 React 时处理。
- **Phase 4 依赖 Phase 1-3：** 图表和分析工具需要稳定的物理数据和场景编辑能力。
- **Phase 5 可以推迟：** 多场景对比和分享功能属于"锦上添花"，核心价值在 Phase 1-4 已交付。
- **Phase 6 是持续优化层：** Worker 迁移和性能优化可以在任何阶段按需进行，但建议在功能稳定后再做。

### Research Flags

**需要深度研究的阶段（推荐在规划时运行 /gsd-research-phase）：**
- **Phase 1:** Rapier + R3F 集成细节（@react-three/rapier API、Vite WASM 配置、COOP/COEP 头）。理由：集成复杂度高，配置错误会导致 WASM 加载失败。
- **Phase 2:** 3D 拖拽交互（射线检测方案、吸附/对齐机制）、ECS 组件序列化格式。理由：交互设计复杂，有多个可行方案需要对比。
- **Phase 4:** 高性能时序图表渲染（Canvas/SVG/WebGL 方案对比）、矢量箭头 3D 几何体实现。理由：涉及渲染性能和质量权衡。
- **Phase 5:** 多世界架构资源管理、时间回放存储策略。理由：架构决策影响面大，需要专门调研。

**标准模式阶段（可跳过深度研究）：**
- **Phase 3:** Zustand slicing pattern 和 transient updates 是文档完善的模式，社区有大量实战参考。
- **Phase 6:** Worker + WASM 集成有 comlink 成熟方案，InstancedMesh 是 Three.js 标准优化模式。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 物理引擎和渲染框架结论有多源验证（Context7 API 文档 + 官方 changelog + 社区性能对比）；版本号来自 npm 注册表和 GitHub CHANGELOG |
| Features | HIGH | 8 个竞品深度分析 + 学术文献（PhET 元分析、Augmented Physics UIST 2024）+ 游戏设计理论（Game Feel）；特征优先级有依赖图验证 |
| Architecture | HIGH | 基于经典游戏引擎架构（Gaffer on Games）+ 多个 Web 物理模拟框架实战参考（Rapier 官方、Verekia、Fnms）；构建顺序有依赖分析支撑 |
| Pitfalls | HIGH | 多源验证：官方引擎限制文档（Planck.js、Box2D 作者）、浏览器 bug 追踪（Chromium/WebKit issues）、框架维护者推荐方案（Zustand discussions）；每个陷阱有预防措施和恢复成本估算 |

**Overall confidence:** HIGH

四项研究均有官方文档、社区讨论和学术文献的多源交叉验证。关键版本号、API 签名和兼容性矩阵来自 Context7 库文档和 GitHub CHANGELOG（HIGH confidence 来源）。部分二级来源（如社区博客的性能对比数据）标注为 MEDIUM confidence，但不影响核心决策。

### Gaps to Address

- **移动端真机验证尚未执行：** PITFALLS.md 明确指出 WASM 引擎必须在真机 iOS Safari 和 Android Chrome 上验证。建议在 Phase 1 早期在至少一台 iOS 和一台 Android 真机上运行 Rapier 基础 demo。
- **@react-three/rapier 的具体 API 行为需要实际验证：** Context7 提供了 API 签名但未覆盖边缘情况（如多 Collider 组合、碰撞事件过滤的运行时行为）。建议在 Phase 1 中通过原型代码验证。
- **Rapier2D 在 z 轴约束上的行为需要确认：** 项目要求在 3D 视角下模拟 2D 物理，Rapier2D 的 z 轴锁定行为需要通过代码验证。
- **zundo 中间件与高频物理状态的兼容性未测试：** zundo 通过记录每次 setState 实现 undo/redo，高频物理更新可能产生大量历史记录。需要测试或使用 partialize 排除高频字段。
- **时序数据采集的内存策略需要规划：** Phase 4 的数据采集管线会持续记录每帧的物理状态。需要确定环形缓冲区大小和存储策略（内存 vs IndexedDB），避免长时间运行后内存溢出。

## Sources

### Primary (HIGH confidence)
- **Context7** — `/dimforge/rapier.js` (148 snippets), `/pmndrs/react-three-rapier` (190 snippets), `/pmndrs/zustand` (478 snippets, v5.0.12), `/vitejs/vite` (699 snippets, v8.0.7) — 库 API 确认
- **rapier.rs** — Rapier 官方文档和基准测试数据
- **Rapier CHANGELOG** — 版本 0.19.3 (2025-11-05), 0.19.0 (2025-09-05)
- **GitHub — pmndrs/react-three-rapier** — v2.2.0 版本、API、兼容性矩阵
- **Gaffer on Games: Fix Your Timestep** — 固定时间步长的经典参考（Glenn Fiedler）
- **Box2D Blog: Determinism (Erin Catto, 2024)** — 物理引擎确定性权威分析
- **Planck.js Limitations (official docs)** — 堆叠/质量比限制
- **Rapier.js DeepWiki: Architecture Overview & Graphics and Rendering** — Handle 型架构和 3D 渲染集成
- **Zustand Discussion #2275 & #2642** — 维护者推荐的批处理和重渲染方案
- **Chromium Issue #40747423 + WebKit Bug #291677** — WASM 移动端内存限制和编译崩溃

### Secondary (MEDIUM confidence)
- **Dimforge 官方博客** — "The Rapier physics engine 2025 review and 2026 goals" (2026-01-09) — 性能数据、SIMD、路线图
- **dev.to — Rapier vs Matter.js 性能对比** — 直接性能对比数据
- **dev.to — Babylon.js vs Three.js 技术对比** — 3D 框架架构对比
- **W3C WebApps 讨论 (2025-03)** — Web Worker + OffscreenCanvas + WASM 架构最佳实践
- **Threlte Rapier v3.0.0 发布说明** — 2025 年 Rapier 框架集成最新实践
- **Fnms Architecture (2024)** — 多物理场耦合的四层场景图架构
- **SOFA Framework 场景图设计** — 仿真框架场景图的学术参考
- **Verekia Architecture (R3F + Miniplex ECS)** — 游戏 ECS 与 React 渲染分离的实战模式
- **Usagi Component Best Practices** — 游戏引擎团队内部组件设计规范
- **Excalibur Engine: ColliderComponent 耦合问题** — 真实架构问题分析
- **PhET Simulation Design Documentation** — 教育模拟软件设计规范
- **npm.io / ecosyste.ms** — 各包发布版本和下载量统计

### Tertiary (LOW confidence, needs validation)
- **diSessa (1982) — "Broken computer" phenomenon** — 二手引用，需查找原文确认
- **Renken & Nunez (2013)** — 计算机模拟与概念理解，二手引用
- **StackOverflow: 物理-渲染分离讨论** — 社区共识，非官方来源
- **Three.js Discourse: OrbitControls zooming limits** — 社区案例，需验证是否仍适用当前版本

### Competitor Analysis Sources
- PhET Interactive Simulations (phet.colorado.edu)
- Algodoo (algodoo.com)
- Physion (physion.net)
- SimPHY (GitHub)
- oPhysics (ophysics.com)
- MyPhysicsLab (myphysicslab.com)
- VirtuLab (dev.to)
- Spacetime Explorer (lablab.ai)
- nature-laws (GitHub)
- FizziQ (fizziq.org)

### Education & Game Design Sources
- Perkins et al. (2006) — PhET 交互模拟设计原则
- Finkelstein et al. (2006) — 物理教育技术项目
- 2024 Meta-analysis — PhET 教学效果元分析（22 篇文献）
- Augmented Physics (UIST 2024 Best Paper) — 静态图表转交互模拟
- Swink, S. (2009) — Game Feel: A Game Designer's Guide to Virtual Sensation
- Pichlmair & Johansen (2020) — Designing Game Feel: A Survey

---
*Research completed: 2026-04-30*
*Ready for roadmap: yes*
