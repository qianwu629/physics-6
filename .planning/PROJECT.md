# Physis — 组件化物理模拟平台

## What This Is

Physis 是一个基于 Web 的物理模拟平台，允许用户通过组合基础物理原语（形状、力场、约束、材料属性）自由搭建模拟场景，而非使用预设模板。初期聚焦高中经典力学（抛体、斜面、碰撞、圆周运动、弹簧振子等），长期愿景是支持多物理场耦合的世界模拟系统。

## Core Value

用户可以将任意基础物理组件自由组合，搭建任意场景——不受预设模板限制。场景搭建采用可视化拖拽操作，模拟结果以 3D 画面实时呈现。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 用户组合基础物理原语（球体、方块、斜面、弹簧等）构建场景
- [ ] 实时 3D 可视化呈现模拟过程，支持 3D 视角下模拟 2D 物理
- [ ] 可视化拖拽搭建场景，设定物体参数（质量、速度、角度等）
- [ ] 经典力学模拟准确（抛体、碰撞、斜面、圆周运动、弹簧振子）
- [ ] 模拟结果贴近真实世界物理行为
- [ ] 环境参数可配置（重力、摩擦力、空气阻力等）
- [ ] 模块化架构，方便未来扩展其他物理领域（光学、电磁、热力学）

### Out of Scope

- 预制物理题目模板 — 违背核心设计理念，废案教训
- 移动端 App — Web 优先
- 多人协作 — v1 不涉及

## Context

### 用户背景
高中生，选修物理。希望通过可视化模拟理解复杂物理题目中的物体运动过程。

### 技术背景
- 现有代码：`frontend/src/store/api.ts` — 基于 Zustand 的状态管理骨架，包含场景/仿真 API 集成和 WebSocket 实时通信模块
- 工作目录已有 `frontend/` 结构

### 废案教训
之前的项目尝试采用"模板模式"——为每种物理题目预制独立模块（抛体模拟器、斜面模拟器、碰撞模拟器）。用户只能使用现成模板，无法自由搭建场景，最终导致项目失败。本次开发严格遵循**组件组合模式**。

## Constraints

- **架构**: 组件组合模式，严禁模板模式。物理世界 = 基础原语 × 自由组合
- **平台**: Web 优先，浏览器运行
- **可视化**: WebGL/WebGPU 3D 渲染
- **物理引擎**: 待调研确定（Rapier WASM / Box2D / Cannon.js / 自研）
- **用户交互**: 目标支持可视化拖拽搭建，初期可接受配置文件方式过渡
- **语言**: TypeScript 优先（与现有代码一致）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 组件组合架构而非模板模式 | 废案失败的根本原因，模板模式无法自由搭建场景 | — Pending |
| 力学为第一阶段物理领域 | 高中物理核心内容，运动过程直观可见 | — Pending |
| Web 平台 | 免安装、跨平台、3D 可视化生态成熟 | — Pending |
| 物理引擎待调研 | 需要在性能、准确性和集成难度之间权衡 | — Pending |
| 3D 渲染方案待调研 | Three.js、Babylon.js 等方案待评估 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-30 after initialization*
