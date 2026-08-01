# Spec: 前端科幻实验室风改造（Sci-fi Lab Redesign）

> 状态：待发布到 GitHub Issues（当前 gh CLI 未安装、GitHub MCP 未认证；发布后应用 `ready-for-agent` label）
> 关联：`CONTEXT.md`、`docs/adr/0001-dockable-panel-system.md`

## Problem Statement

物理模拟平台的当前 UI 是扁平暗色工具界面：纯色 `#0a0a0a` 背景、中性灰 shadcn 默认 tokens、fixed/absolute 浮动面板。这与"前瞻性、突破性物理模拟平台"的产品定位不匹配；且面板位置全部硬编码，用户无法根据模拟任务（调参、看图表、管理实体）调整工作区布局。

## Solution

**Sci-fi Lab（科幻实验室风）视觉重做**：全量 2D UI + 3D 场景视觉升级为深空配色、发光元素、玻璃拟态面板、全息质感 3D 材质；工作区从固定浮动面板迁移到 Blender 式可停靠面板系统（Docked Panels），用户可自由分栏、合并、重排面板，布局自动持久化。

术语遵循 `CONTEXT.md` glossary（Sci-fi Lab / Docked Panels）；架构决策见 `docs/adr/0001-dockable-panel-system.md`。

## User Stories

1. As a 平台用户, I want a 深空背景 + 发光网格地面的 3D 场景, so that 模拟过程有沉浸式的实验室氛围
2. As a 平台用户, I want 力矢量、弹簧、轨迹线等可视化元素带辉光效果, so that 物理量的空间分布一目了然
3. As a 平台用户, I want 实体使用全息质感材质, so that 场景视觉风格统一且能清晰区分实体与背景
4. As a 平台用户, I want 所有 UI 面板为玻璃拟态风格（半透明 + 模糊 + 发光描边）, so that 面板不遮挡场景又保持可读性
5. As a 平台用户, I want 拖拽面板标题栏即可分栏/合并/重排面板, so that 我可以按当前任务组织工作区
6. As a 平台用户, I want 布局在刷新后自动恢复, so that 我不必每次重新摆面板
7. As a 平台用户, I want 图表面板在切换 tab/隐藏后曲线不丢失, so that 长时间模拟的数据持续可见
8. As a 平台用户, I want MenuBar、Toolbar、Toolbox 与对话框统一为 Sci-fi Lab 风格, so that 整个应用视觉一致
9. As a 平台用户, I want 布局拖拽/缩放时模拟帧率不下降, so that 实时模拟始终流畅
10. As a 平台用户, I want 所有现有功能（创建实体、调参、运行模拟、快照）行为不变, so that 视觉升级不影响我的工作流
11. As a 开发者, I want 主题通过 CSS 变量集中定义, so that 后续调整配色只改一处
12. As a 开发者, I want 停靠布局状态可序列化, so that 未来可并入场景文件持久化

## Implementation Decisions

- **停靠库**：`dockview-react@^7`（ADR-0001；注意 v7 起 React 绑定在 `dockview-react` 包，非 `dockview`）
- **组件层**：保留 shadcn/ui + Tailwind v4，重写 theme tokens（oklch 深空配色、玻璃拟态、发光阴影），不换组件库
- **布局壳**：dock shell 取代 App 层 fixed/absolute 浮动面板；面板组件注册进 dock 的 components map，props 走可序列化 params；dock 面板经 React portal 渲染，zustand/Radix context 天然保留
- **图表面板**：使用 `renderer: 'always'`，避免隐藏时 DOM 拆建导致 lightweight-charts canvas 重建
- **布局持久化**：监听布局变更事件，防抖后序列化存 localStorage；启动时先注册面板组件再恢复布局
- **旧面板开关状态**（如 propertyPanelCollapsed）语义并入 dock 布局状态，不再单独维护
- **主题定制方式**：自定义 theme class 覆盖 `--dv-*` CSS 变量 + 自定义 theme 对象，不改库内类名；vendor CSS 在 `@import "tailwindcss"` 之后引入
- **3D 场景**：引入 `@react-three/postprocessing` bloom；深空渐变/星空背景；发光网格地面；实体全息材质
- **Radix 叠加层**：Dialog/Tooltip portal 到 body，z-index 高于 dock 默认层级，保持可用
- **功能冻结**：store / ECS / 物理集成 / 组件行为逻辑不动；允许顺手修复明显小问题（如 React 19 兼容性）
- **性能纪律**：布局操作不进 React 渲染循环；自定义 tab 渲染器内不放重计算；物理数据高频订阅不得 setState 到布局层

## Testing Decisions

好测试 = 只断言外部行为（面板是否渲染、布局是否恢复、截图是否一致），不断言实现细节（CSS 类名、内部 state）。

- **Seam 1（现有）**：App 级 Vitest + React Testing Library 渲染测试——dock 壳渲染、全部面板注册可见、布局序列化/恢复往返。Prior art：`Toolbar.test.tsx`、`Scene3D.test.tsx`、`LoadingScreen.test.tsx`（mock 重依赖的模式沿用）
- **Seam 2（新增）**：Playwright 视觉回归截图——工作区整体 + 3D 场景关键画面，与基线对比；引入 Playwright 工具链（与 Phase 7 D-07-05 规划一致）
- **回归网**：现有 vitest 套件全部保持绿色，作为功能冻结的回归保障
- 视觉细节（发光强度、模糊程度）不做数值断言，靠截图对比 + 人工验收

## Out of Scope

- 物理引擎、模拟逻辑、store/ECS 的任何行为改动
- 更换 UI 组件库（shadcn/ui 保留）
- 新模拟能力的前端支持（电磁学等）
- PropertyPanel 内部架构拆分（属后续 UI 重构阶段）
- react-draggable → dnd-kit 迁移（属 React 19 兼容性阶段）
- 移动端/响应式适配

## Further Notes

- 停靠库调研（2026-07）：dockview-react@^7 首选（React 19 peerDeps 显式支持、零依赖、三层主题系统、布局操作不进渲染循环）；备选 flexlayout-react@^0.10；排除 rc-dock（latest 指向停滞 alpha）
- 相关文档：`CONTEXT.md`、`docs/adr/0001-dockable-panel-system.md`、`.planning/codebase/ARCHITECTURE.md`
