---
id: 5
title: Playwright 视觉回归：截图基线 + 对比
blocked_by: [3, 4]
labels: [ready-for-agent]
spec: ../SPEC.md
status: done（2026-07-26 实现；4 用例全过，主题回归冒烟验证通过；用系统 Chrome channel）
---

# Ticket 5: Playwright 视觉回归

## 目标

引入 Playwright，建立 Sci-fi Lab 改造后的视觉回归网（SPEC.md Seam 2）。与 Phase 7 D-07-05 的 Playwright 规划同源。

## 范围

- 引入 Playwright 工具链（配置文件、npm scripts、浏览器安装说明）
- 截图用例：工作区整体（含 dock 布局）、3D 场景关键画面（bloom/网格/材质）、至少一个对话框
- 建立基线截图并实现对比断言（允许合理阈值抗渲染噪声）
- 用例覆盖布局持久化：重排面板 → 刷新 → 截图对比恢复后布局

## 验收标准

- Playwright 套件本地可运行并通过
- 截图对比能捕获主题回归（改错 token 时测试变红）
- 现有 vitest 套件保持绿色

## 约束

- 只做视觉回归与布局持久化验证，不扩展到物理正确性测试（属 Phase 7 范围）
- 截图基线纳入仓库管理，更新基线有明确命令
