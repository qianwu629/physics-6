---
id: 2
title: Sci-fi Lab 主题 tokens：深空配色 + 发光体系 + dockview 主题
blocked_by: [1]
labels: [ready-for-agent]
spec: ../SPEC.md
status: done（2026-07-26 实现 + 截图验收通过；主强调色：全息青）
---

# Ticket 2: 主题 tokens

## 目标

建立 Sci-fi Lab 视觉基座：重写 shadcn/Tailwind theme tokens 为深空 oklch 配色，定义发光阴影/描边体系，输出 dockview 自定义主题。面板具体换皮在 Ticket 3。

## 范围

- 重写全局 theme tokens（`--background/--foreground/--card/--primary/--accent/--border/--ring/--chart-*` 等）为深空配色（oklch）
- 新增 Sci-fi Lab 语义 tokens：发光阴影、玻璃拟态参数（透明度/模糊度）、全息强调色
- dockview 主题：自定义 theme class 覆盖 `--dv-*` 变量 + theme 对象（`dndTabIndicator` 等），不改库内类名
- 全局背景从纯 `#0a0a0a` 升级为深空基调
- 字体体系沿用 Geist，核对字号/字重层级

## 验收标准

- 所有颜色集中在 CSS 变量，改配色只动一处（user story 11）
- dock tab/分割条/拖拽指示器呈现深空主题
- 现有 vitest 套件保持绿色

## 约束

- 只动 tokens 与 dockview 主题层，不逐个重绘面板（那是 Ticket 3）
- tokens 命名与 CONTEXT.md 的 Sci-fi Lab 术语一致
