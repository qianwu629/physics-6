---
phase: 02-实时物理量图表
plan: 05
subsystem: UI integration
tags: [ui-wiring, integration, chart-panel, toolbar, property-panel, environment-panel]
depends_on:
  - 02-01
  - 02-02
  - 02-03
  - 02-04
provides:
  - PropertyPanel 图表追踪 Switch
  - EnvironmentPanel 势能参考高度滑块
  - Toolbar 图表面板 toggle 按钮
  - App.tsx ChartPanel 挂载 + chartPanelOpen 状态管理
affects:
  - frontend/src/components/PropertyPanel.tsx
  - frontend/src/components/EnvironmentPanel.tsx
  - frontend/src/components/Toolbar.tsx
  - frontend/src/components/App.tsx
tech-stack:
  added: []
  patterns:
    - Zustand selector pattern for chartDataStore integration
    - Toolbar props-based state lifting (chartPanelOpen/onToggleChartPanel)
    - HighlightSlider reuse for peReferenceY in EnvironmentPanel
    - cn() utility for conditional button styling
key-files:
  created: []
  modified:
    - frontend/src/components/PropertyPanel.tsx
    - frontend/src/components/EnvironmentPanel.tsx
    - frontend/src/components/Toolbar.tsx
    - frontend/src/components/App.tsx
key-decisions:
  - "peReferenceY unified in simulationSlice.environment as single source of truth (C-04 fix)"
  - "Toolbar chart button uses prop drilling from App.tsx (not a separate store)"
  - "图表追踪 Switch placed in both spring and entity PropertyPanel sections"
  - "ChartPanel uses fixed positioning — rendering order in App.tsx tree is irrelevant"
duration: ~8 min
completed_date: "2026-05-17"
---

# Phase 02 Plan 05: UI 集成接线 Summary

将 Phase 2 新建的图表组件（chartDataStore、ChartPanel、ChartCanvas、ChartSampler）集成到现有 UI 中，完成四个关键接线点。

## 一、执行结果

| 任务 | 名称 | 状态 | 关键提交 |
|------|------|------|----------|
| 1 | PropertyPanel 添加图表追踪 Switch | 已完成 | 33a89e8 |
| 2 | EnvironmentPanel 添加势能参考高度输入 | 已完成 | 33a89e8 |
| 3 | Toolbar 添加图表面板 toggle 按钮 | 已完成 | 33a89e8 |
| 4 | App.tsx 挂载 ChartPanel + 状态管理 | 已完成 | 33a89e8 |

所有集成代码已在提交 `33a89e8` 中实现，并在当前基线 `2264865` 中验证通过。

## 二、各任务详情

### Task 1: PropertyPanel 图表追踪 Switch

**文件:** `frontend/src/components/PropertyPanel.tsx`

- 在文件顶部导入 `useChartDataStore`
- 在函数体添加 `trackedIds` 和 `toggleTracking` store 选择器
- 在弹簧属性可视化开关区域（line 509-515）和普通实体可视化开关区域（line 763-769）各添加一个「图表追踪」Switch
- 默认关闭状态；切换时调用 `toggleTracking(selectedEntity.id)`

### Task 2: EnvironmentPanel 势能参考高度滑块

**文件:** `frontend/src/components/EnvironmentPanel.tsx`

- 从 `useSimulationStore` 读取 `environment.peReferenceY`（C-04 fix: 唯一来源）
- 通过 `setPeReferenceY` 写入
- 在 Drag 区域之后添加 `HighlightSlider` 组件：范围 -50~50m，步进 0.1m，单位 m
- 始终可编辑（`disabled={false}`），不受运行状态锁定影响

### Task 3: Toolbar 图表面板 toggle 按钮

**文件:** `frontend/src/components/Toolbar.tsx`

- 扩展 `ToolbarProps` 接口：添加 `chartPanelOpen?: boolean` 和 `onToggleChartPanel?: () => void`
- 函数签名接收可选 props（默认 `{}`）
- 在可视化控制按钮组（轨迹/速度/受力/全部）之后添加分隔线和「图表」按钮
- 按钮使用 `cn()` 条件样式：激活时 `bg-white/15 text-white`，未激活时 `text-white/50`
- 通过 `title` 属性提供原生 tooltip

### Task 4: App.tsx 挂载 ChartPanel

**文件:** `frontend/src/components/App.tsx`

- 导入 `ChartPanel` 组件
- 添加 `chartPanelOpen` state（初始 `false`）
- 向 `Toolbar` 传入 `chartPanelOpen` 和 `onToggleChartPanel` props
- 在渲染树中添加 `<ChartPanel open={chartPanelOpen} onClose={() => setChartPanelOpen(false)} />`
- ChartPanel 使用 fixed 定位（z-40），与 PropertyPanel 同级

## 三、验证结果

| 验证项 | 结果 | 备注 |
|--------|------|------|
| TypeScript 编译 (`npx tsc --noEmit`) | PASS | 零错误 |
| PropertyPanel grep (图表追踪/toggleTracking) | 6 matches | 弹簧+实体两个区域各一个 Switch |
| EnvironmentPanel grep (peReferenceY/势能参考高度) | 5 matches | HighlightSlider + store 选择器 |
| Toolbar grep (图表/chartPanelOpen) | 8 matches | Props 接口 + 按钮 + 样式 |
| App.tsx grep (ChartPanel/chartPanelOpen) | 7 matches | import + state + Toolbar + ChartPanel |

## 四、成功标准确认

1. PropertyPanel 中为选中实体添加「图表追踪」Switch，默认关闭 -- 已实现
2. EnvironmentPanel 中添加「势能参考高度」滑块，范围 -50~50m，步进 0.1m -- 已实现
3. Toolbar 中添加「图表」toggle 按钮，控制 ChartPanel 显示/隐藏 -- 已实现
4. App.tsx 中挂载 ChartPanel，状态由 Toolbar 控制 -- 已实现
5. 图表面板关闭后不影响采样（重新打开能看到历史数据） -- 架构保证：ChartSampler.useFrame 独立于 ChartPanel open 状态
6. TypeScript 编译通过，无新增错误 -- 已确认

## Deviations from Plan

无偏差 -- 所有任务均按计划规范完成，代码在提交 `33a89e8` 中实现，当前基线 `2264865` 中验证通过。实现细节与 `must_haves.truths` 和 `must_haves.artifacts` 完全一致。

## Known Stubs

无 -- 所有数据流已完整接线（chartDataStore <-> PropertyPanel, simulationSlice <-> EnvironmentPanel, App state <-> Toolbar <-> ChartPanel）。

## Threat Flags

无 -- 威胁模型 T-05-01 判定为 accept（纯组件组合和状态绑定，无安全影响），实现确认无新增安全表面。
