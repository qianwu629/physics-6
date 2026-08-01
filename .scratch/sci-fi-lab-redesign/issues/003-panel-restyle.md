---
id: 3
title: 全面板玻璃拟态换皮：MenuBar/Toolbar/Toolbox/对话框/各面板
blocked_by: [2]
labels: [ready-for-agent]
spec: ../SPEC.md
status: done（2026-07-26 实现 + 截图验收通过）
---

# Ticket 3: 全面板换皮

## 目标

把 Ticket 2 的 tokens 应用到所有 2D UI：玻璃拟态面板（半透明 + 模糊 + 发光描边），MenuBar、Toolbar、Toolbox、全部对话框统一为 Sci-fi Lab 风格。

## 范围

- 玻璃拟态样式应用到 dock 面板与全部独立 UI 组件：MenuBar、Toolbar、Toolbox、PropertyPanel、EntityList、EnvironmentPanel、ChartPanel
- 对话框统一换皮：CreationDialog、ForceFieldDialog、SpringCreationDialog、PresetSelector、SnapshotManager Drawer、SpringCreationBanner
- 控件级细节：按钮、输入框、slider、tab 的发光 hover/focus 态
- 滚动条、tooltip、toast（sonner）风格统一

## 验收标准

- 全部 UI 视觉一致，无残留旧扁平灰风格（user stories 4、8）
- 面板半透时不遮挡场景且内容可读（user story 4）
- 所有交互行为不变；现有 vitest 套件保持绿色

## 约束

- 只动样式与 className，不改组件行为逻辑；允许顺手修复明显小问题
- 重交互控件（slider 拖拽）不得因发光/模糊特效掉帧
