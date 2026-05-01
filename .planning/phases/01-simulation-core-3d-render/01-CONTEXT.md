# Phase 1: 仿真核心与基础3D渲染 - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

可运行的 3D 物理沙盒——使用硬编码初始物体（Phase 1 临时方案）在重力下碰撞堆叠，用户可旋转观察并控制播放/暂停/重置。Phase 2 将替换为 UI 自由添加物体的组件化架构。

**不在本 Phase**: 用户通过 UI 添加物体、属性编辑面板、约束系统、轨迹可视化。
</domain>

<decisions>
## Implementation Decisions

### 初始场景与物体
- **D-01:** 硬编码初始物体——Phase 1 用代码直接放置约 10+ 个随机物体（压力测试场景），Phase 2 替换为 UI 自由添加。硬编码仅是引擎验证手段。
- **D-02:** 地面是隐式基础设施——一个大平面作为默认地面，不属于"物体"，始终存在。
- **D-03:** 物体按随机柔和色彩分配——每个物体随机分配一个柔和颜色，视觉活泼但不刺眼。
- **D-04:** 启动后模拟暂停等待——场景渲染但模拟暂停，用户点击"播放"才开始。给用户时间旋转观察初始场景布局。

### 摄像机与辅助元素
- **D-05:** 摄像机默认从 45° 对角方向俯瞰场景中心。用户可自由轨道旋转、平移、缩放。
- **D-06:** 完整辅助视觉——地面参考网格（Grid helper）+ RGB 三色坐标轴指示器 + 简单光照阴影。物理课堂风格。

### 模拟控制
- **D-07:** 顶部浮动工具栏——播放/暂停/重置按钮 + 物理调试开关（默认关闭，开启后渲染线框碰撞体和接触点）。
- **D-08:** 键盘快捷键——Space = 播放/暂停切换，R = 重置。通过 Tooltip 提示。

### 性能与兼容
- **D-09:** 桌面优先——目标 Chrome/Firefox/Edge 稳定 60fps。移动端暂不作为硬性要求。
- **D-10:** 3D 画布自适应窗口大小，物体比例不变。工具栏浮动在画布上方。

### 加载体验
- **D-11:** WASM 加载期间中央显示加载动画 + "正在加载物理引擎..."文字。加载完成后自动渲染场景并进入暂停状态。

### 核心设计原则
- **D-12:** **严禁模板模式**——这是废案失败的根本原因。上一版项目仅创建了几个预设运动模板（圆周运动、平抛运动等），用户零自由度，最终项目废弃。Phase 1 的硬编码场景仅作为物理引擎和渲染管线的验证手段，**不得演变为预设模板系统**。每个 Phase 的交付物必须服务于"组件组合自由搭建"这一核心价值。

### Claude's Discretion
- 硬编码压力测试场景的具体物体数量、位置、初始参数
- 加载动画的具体视觉设计
- 调试线框碰撞体的样式
- 物体随机色彩的生成算法
</decisions>

<specifics>
## Specific Ideas

- "空场景，不要做预设场景"——用户对模板模式极度敏感，硬编码场景是 Phase 1 的临时妥协，Phase 2 必须立即移除并替换为自由添加方式
- 废案教训：上一版"工程师仅仅创建了几个特殊运动的模板，类似圆周、平抛运动这样，没有任何自由度可言"——这违背了项目核心
</specifics>

<canonical_refs>
## Canonical References

### 项目定义
- `.planning/PROJECT.md` — 项目愿景、核心价值（组件组合自由搭建）、废案教训、技术约束
- `.planning/REQUIREMENTS.md` — v1 需求定义，SIM-01/03/06、REN-01/02 映射到本 Phase
- `.planning/ROADMAP.md` — Phase 1 目标、成功标准

### 技术研究
- `.planning/research/STACK.md` — 技术栈决策：Rapier WASM + React Three Fiber + Zustand + Vite（HIGH confidence）
- `.planning/research/ARCHITECTURE.md` — ECS 变体、固定 120Hz 时间步长、4 层分离
- `.planning/research/PITFALLS.md` — 关键陷阱：可变时间步长、Zustand 重渲染风暴、WASM 移动兼容

### UI 设计合同
- `.planning/01-UI-SPEC.md` — 深色主题、顶部浮动工具栏、间距/排版/颜色/文案合同（已通过 checker 审核）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/store/api.ts` — 现有 Zustand store 骨架，包含仿真控制 actions（start/pause/resume/reset）、WebSocket 管理、通知系统。可直接复用控制逻辑。

### Established Patterns
- Zustand slicing pattern（STACK.md 推荐）——当前为单一 store，Phase 1 可演进为 physicsSlice + simulationSlice
- 现有代码使用 TypeScript 严格模式，所有新代码保持一致

### Integration Points
- Phase 1 代码写入 `frontend/src/`，与现有 store 目录平级
- 物理引擎通过 R3F 的 `<Physics>` 组件集成（主线程运行，STACK.md Phase 1 策略）
- 项目尚无 package.json，需先初始化 Vite + React 项目
</code_context>

<deferred>
## Deferred Ideas

- 用户通过 UI 自由添加物体——Phase 2
- 属性编辑面板——Phase 2
- 预设场景库（精选起始场景，非模板）——未来 Phase
</deferred>

---

*Phase: 01-simulation-core-3d-render*
*Context gathered: 2026-05-01*
