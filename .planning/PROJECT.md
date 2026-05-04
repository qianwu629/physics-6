# Physis — 组件化物理模拟平台

## What This Is

Physis 是一个基于 Web 的物理模拟平台，允许用户通过组合基础物理原语（形状、力场、约束、材料属性）自由搭建模拟场景，而非使用预设模板。**v1.0 已交付组件化物理沙盒 MVP**：4 种基础刚体形状 + 弹簧约束 + 环境配置 + 轨迹/矢量可视化，覆盖经典力学场景（抛体、斜面、碰撞、弹簧振子）。长期愿景是支持多物理场耦合的世界模拟系统。

## Current State

**v1.0 — MVP 物理沙盒**（已发布 2026-05-04）

- 5 个阶段，17 个执行计划，3 天交付
- 12/12 v1 需求全部满足
- 8,708 LOC TypeScript（71 个 .ts/.tsx 文件）
- 22 测试套件 / 185 测试用例 PASS
- 详见 `.planning/MILESTONES.md` 和 `.planning/milestones/v1.0-ROADMAP.md`

## Current Milestone: v2.0 力场与多维模拟

**Goal:** 让用户在原 ECS 物理沙盒之上获得场景持久化、力场体系、表达式驱动外加力、实时物理量分析、FPS 摄像机控制和 2D 模拟模式；同时清理 v1.0 遗留交互精度与性能债务，从"3D 经典力学组件箱"扩展为"可保存、可分析、可定制力学规则、可降维"的交互物理实验室。

**Target features:**

新能力：
- 场景 JSON 持久化（文件 IO + localStorage + 预设场景库；只保存初始配置）
- 物理量实时图表（位置 / 速度 / 加速度 / 能量 KE/PE/E，多实体多曲线）
- 通用向量力场系统（ForceField 组件框架 + 多类型预设 + 力线/箭头可视化）
- 表达式驱动外加力（用户输入数学表达式逐帧求值；解析器待研究）
- 类 FPS 自由飞行摄像机（WSAD + 鼠标拖拽 + 屏幕摇杆 fallback；2D 模式降级正交）
- 2D 模拟模式（沿用 rapier3d + z 轴约束 + 正交摄像机 + UI 切换）

v1.0 polish / debt 清理：
- 弹簧 3D tube 射线点击选中精度修复
- 多弹簧链（≥3）数值稳定性测试与调参
- 50+ 实体 + 20 弹簧性能基准与优化（目标 60fps）
- Scene3D.test.tsx three.js Vector3 mock 修复（9 用例）+ Phase 4 补回 VERIFICATION.md

**Key context（关键决策）:**
- 架构：3D 引擎模拟 2D（不引入 rapier2d，通过 z 轴约束 + 正交相机 + 2D UI 风格降级）
- 力场：通用 ForceField 组件框架（电磁场、引力源、方向场作为预设类型）
- 自定义力：表达式驱动（mathjs vs expr-eval 待研究阶段确认）
- 摄像机：类 FPS 自由飞行（保留 OrbitControls 作为 fallback）
- 持久化：文件 + 本地 + 预设三合一，仅保存初始配置（教学场景理念）

## Core Value

用户可以将任意基础物理组件自由组合，搭建任意场景——不受预设模板限制。场景搭建采用可视化拖拽操作，模拟结果以 3D 画面实时呈现。

**v1.0 验证：** 核心价值已实现 — ECS 架构（DIF-01）让用户组合 4 种形状 + 弹簧约束 + 环境参数搭建任意经典力学场景；3D 实时呈现 + 可视化叠加层（轨迹/速度/受力）让物理量"可见"。

## Requirements

### Validated (v1.0)

- ✓ **SIM-01..06**：基础刚体形状、重力配置、碰撞响应、弹簧约束、环境参数、播放/暂停/重置 — v1.0 (Phases 1, 3)
- ✓ **REN-01..03**：WebGL 实时 3D 渲染、3D 摄像机控制、属性面板运行时编辑 — v1.0 (Phases 1, 2, 5)
- ✓ **DIF-01..03**：组件化自由组合架构、轨迹残影、速度/受力矢量箭头 — v1.0 (Phases 2, 4)

### Active (v2.0)

REQ-IDs 由 `/gsd-new-milestone` 流程的 Define Requirements 阶段生成，写入 `.planning/REQUIREMENTS.md`。本里程碑预期需求类别：

- **PERSIST**：场景 JSON 保存/加载、本地存储、预设场景库
- **CHART**：实时物理量图表（位置/速度/加速度/能量 4 类，多曲线）
- **FIELD**：通用向量力场（点电荷/磁场/引力/方向场等）+ 力线可视化
- **EXPR**：表达式驱动外加力（实体级公式力）
- **CAM**：类 FPS 自由飞行摄像机（WSAD + 鼠标 + 屏幕摇杆）
- **DIM2**：2D 模拟模式（z 约束 + 正交相机 + UI 切换）
- **DEBT**：v1.0 遗留 UAT 项与测试基线修复

### Future Requirements（暂不在本里程碑）

- 可视化拖拽场景搭建（v2 SCN-01，候选下个里程碑）
- 多人实时协作（v1 已确认 Out of Scope）

### Out of Scope

- 预制题目模板 — 违背核心设计理念，废案教训
- 移动端 App — Web 优先
- 多人实时协作 — v1 不涉及
- 照片级真实渲染（PBR/光追）— 与物理精度焦点冲突
- 自动解题功能 — 与探索式学习理念冲突

## Context

### 用户背景
高中生，选修物理。希望通过可视化模拟理解复杂物理题目中的物体运动过程。

### 技术栈（v1.0 已落地）
- **前端**：React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui
- **3D 渲染**：@react-three/fiber + @react-three/drei
- **物理引擎**：@react-three/rapier (Rapier 3D WASM, 120Hz 固定时间步长)
- **状态管理**：Zustand + zustand/middleware persist
- **测试**：Vitest + jsdom + React Testing Library
- **架构**：ECS 组件组合（Entity = Map<ComponentType, Component>）

### 废案教训
之前的项目尝试采用"模板模式"——为每种物理题目预制独立模块（抛体模拟器、斜面模拟器、碰撞模拟器）。用户只能使用现成模板，无法自由搭建场景，最终导致项目失败。本次 v1.0 严格遵循**组件组合模式**且通过 DIF-01 验证。

## Constraints

- **架构**: 组件组合模式，严禁模板模式（v1.0 已验证）
- **平台**: Web 优先，浏览器运行
- **可视化**: WebGL 3D 渲染（v1.0 已落地）
- **物理引擎**: @react-three/rapier (Rapier 3D WASM)
- **用户交互**: PropertyPanel 编辑参数（v1.0 已落地）；下个里程碑可考虑可视化拖拽
- **语言**: TypeScript 严格模式

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| R3F + Rapier + Zustand + Vite | 技术栈调研 HIGH confidence | ✓ Phase 1 验证通过 |
| ECS 组件组合架构 | 废案模板模式失败教训 | ✓ DIF-01 验证 — 用户自由组合 |
| @react-three/rapier (3D WASM) | 仅需 3D 引擎 | ✓ Phase 1 移除 rapier2d-compat 误用 |
| 120Hz 固定时间步长 + 渲染插值 | 帧率无关物理 (Pitfall #1) | ✓ Phase 1 验证 60Hz/144Hz 一致 |
| Per-frame 物理数据不进 Zustand | Pitfall #6 (re-render storm) | ✓ Phase 1, 4 遵循 |
| restitution/friction 走 collider-level setter | Rapier3D 物理属性归 Collider | ✓ Phase 5 关键修复 |
| TrajectoryBuffer 双 Float32Array 环形缓冲 | O(1) push + 时间裁剪 | ✓ Phase 4 (UAT 后调整 5s→10s) |
| visualizationStore 独立 store | 与 useSimulationStore 解耦 | ✓ Phase 4 落地 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections ✓
2. Core Value check — still the right priority? ✓ 验证通过
3. Audit Out of Scope — reasons still valid? ✓
4. Update Context with current state ✓

---
*Last updated: 2026-05-04 — milestone v2.0 力场与多维模拟 started (continues from v1.0 完成的 5 个 phase)*
