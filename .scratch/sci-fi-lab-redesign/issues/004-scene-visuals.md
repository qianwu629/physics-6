---
id: 4
title: 3D 场景科幻视觉：bloom + 深空背景 + 发光网格 + 全息材质
blocked_by: [2]
labels: [ready-for-agent]
spec: ../SPEC.md
status: done（2026-07-26 实现 + 截图验收通过；FPS 57 ≥ 55）
---

# Ticket 4: 3D 场景视觉

## 目标

3D 场景升级为全套 Sci-fi Lab 视觉：辉光后处理、深空背景、发光网格地面、全息实体材质。与 Ticket 3 可并行，共用 Ticket 2 的配色 tokens。

## 范围

- 安装并接入 `@react-three/postprocessing`，配置 bloom（选择性发光：力矢量、弹簧、轨迹线、网格）
- 场景背景：深空渐变/星空，取代纯色 `#0a0a0a`
- 发光网格地面
- 实体全息质感材质（与背景清晰区分、风格统一）
- 配色与 Ticket 2 tokens 对齐

## 验收标准

- user stories 1-3 的视觉效果达成
- 模拟运行时帧率不下降（120Hz 物理步 + 60fps 渲染，user story 9）
- 现有 vitest 套件保持绿色（Scene3D 相关测试适配）

## 约束

- 功能冻结：物理集成、EntityRenderer 的 body 同步逻辑不动，只改视觉层
- bloom 强度以可读性为上限：力矢量数值判读不得受辉光干扰
