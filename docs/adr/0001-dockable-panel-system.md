# 0001: 工作区采用可停靠面板系统

前端视觉重做（Sci-fi Lab 方向）中，工作区布局从 fixed/absolute 浮动面板迁移到 Blender 式可停靠面板系统（dockable panels），通过引入停靠布局库实现面板的拖拽分栏与重排。

选择停靠系统而非"重设计的固定布局"的理由：物理模拟工作流的面板组合高度因人而异（属性、图表、实体列表、环境参数的使用频率随场景变化），固定布局无法同时服务好不同任务；用户明确选择了灵活性优先，接受引入停靠库的成本。

**Consequences:** 布局壳层整体重写；所有面板组件需要适配停靠容器的生命周期（卸载/重挂载）；旧的面板开关状态（如 propertyPanelCollapsed）语义并入停靠布局状态。

**库选型（2026-07 调研）：** 采用 `dockview-react@^7`——React 19 peerDeps 显式支持、维护最活跃、零依赖、三层主题系统（CSS 变量 + theme 对象 + 自定义渲染器）最适合 Sci-fi Lab 视觉；面板经 React portal 渲染，zustand/Radix context 保留，布局操作不进 React 渲染循环，不影响 120Hz 物理帧率。备选项 flexlayout-react@^0.10；排除 rc-dock（latest 指向停滞的 alpha）。注意：v7 起 React 绑定在 `dockview-react` 包，旧教程的 `from 'dockview'` 是 v6 写法。
