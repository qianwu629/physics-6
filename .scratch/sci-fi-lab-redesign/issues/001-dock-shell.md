---
id: 1
title: 停靠布局壳：dockview 接入 + 面板迁移 + 布局持久化
blocked_by: []
labels: [ready-for-agent]
spec: ../SPEC.md
status: done（2026-07-26 实现 + 冒烟验证通过）
---

# Ticket 1: 停靠布局壳

## 目标

工作区从 fixed/absolute 浮动面板迁移到 dockview-react@^7 停靠系统。本 ticket 只改布局结构，**视觉风格保持现状**（换皮在后续 ticket）。

## 范围

- 安装 `dockview-react@^7`（注意：不是 `dockview`，v7 包名已迁移）
- 新建 dock shell 作为 App 工作区容器，取代 App 层的 fixed/absolute 面板定位
- 以下面板迁入 dock components map：PropertyPanel、EntityList、EnvironmentPanel、ChartPanel、Toolbox
- ChartPanel 使用 `renderer: 'always'`（防止 lightweight-charts canvas 重建丢曲线）
- 布局持久化：布局变更事件防抖后 `toJSON()` 存 localStorage；启动时先注册组件再 `fromJSON()` 恢复
- 旧 `propertyPanelCollapsed` 状态语义并入 dock 布局状态
- vendor CSS 在 `@import "tailwindcss"` 之后引入

## 验收标准

- 所有面板在 dock 壳中渲染且功能行为不变（创建实体、调参、运行模拟、快照）
- 拖拽面板可分栏/合并/重排；刷新后布局恢复
- App 级 RTL 测试通过：dock 壳渲染、面板注册可见、序列化/恢复往返
- 现有 vitest 套件全部保持绿色

## 约束

- 功能冻结：store/ECS/物理集成不动（SPEC.md "Implementation Decisions"）
- Radix Dialog/Tooltip 叠加层保持可用
