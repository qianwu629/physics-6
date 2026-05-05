---
phase: "02-实时物理量图表"
plan: "01"
subsystem: "store"
tags: ["chart", "buffer", "zustand", "data-layer"]
dependency_graph:
  requires: []
  provides: ["02-02", "02-03", "02-04", "02-05"]
  affects: ["simulationSlice", "store/index"]
tech_stack:
  added:
    - "lightweight-charts@5.2.0"
    - "react-draggable@4.5.0"
    - "re-resizable@6.11.2"
  patterns:
    - "Zustand config + Ref data separation (PITFALLS #6)"
    - "Float64Array ring buffer (D-02-05, D-02-06)"
    - "Module-level Map for per-entity buffers"
key_files:
  created:
    - "frontend/src/store/chartBuffer.ts"
    - "frontend/src/store/chartDataStore.ts"
    - "frontend/src/store/__tests__/chartBuffer.test.ts"
    - "frontend/src/store/__tests__/chartDataStore.test.ts"
  modified:
    - "frontend/src/store/simulationSlice.ts"
    - "frontend/src/store/index.ts"
    - "frontend/package.json"
    - "frontend/package-lock.json"
decisions:
  - "MAX_POINTS = 500_000 (约 10 分钟 @ 60Hz，D-02-05)"
  - "METRICS_PER_ENTITY = 12 (x,y,z,vx,vy,vz,ax,ay,az,KE,PE,TotalE)"
  - "chartDataStore 作为独立 Zustand store，不合并到 useSimulationStore (避免 re-render 风暴)"
  - "peReferenceY 放入 EnvironmentState (与重力/摩擦同一层级，教学场景统一参考面)"
metrics:
  duration: "~15 min"
  completed_date: "2026-05-05"
---

# Phase 02 Plan 01: 数据层骨架 —— 依赖安装 + chartBuffer + chartDataStore + simulationSlice 扩展

## 概述

安装 Phase 2 所需的 3 个 npm 包，并构建图表数据层骨架：
- **chartBuffer.ts**: Float64Array 环形缓冲区，每实体存储 12 个物理量指标
- **chartDataStore.ts**: Zustand 配置层，管理追踪开关、时间窗口、布局模式、可见指标、势能参考高度
- **simulationSlice.ts 扩展**: 添加 `peReferenceY` 到环境状态

## 任务完成状态

| # | 任务 | 状态 | 提交 |
|---|------|------|------|
| 1 | 安装 npm 依赖 | 完成 | 3067a77 |
| 2 | 创建 chartBuffer.ts + 单元测试 | 完成 | a6e9f53 |
| 3 | 创建 chartDataStore.ts + 扩展 simulationSlice | 完成 | a6e9f53 |

## 提交记录

- **3067a77** `chore(02-01): install lightweight-charts@5.2.0 + react-draggable@4.5.0 + re-resizable@6.11.2`
- **a6e9f53** `feat(02-01): create chartDataStore + chartBuffer + extend simulationSlice`

## 验证结果

- TypeScript 编译通过 (`tsc --noEmit`)
- 单元测试: 7 test files, 89 tests, 全部 PASS
  - chartBuffer.test.ts: 16 tests (初始状态、push、MAX_POINTS 限制、wrap-around、clear、时间过滤、12 指标、模块级 helper)
  - chartDataStore.test.ts: 15 tests (初始状态、toggleTracking、setTimeWindow、setLayoutMode、setVisibleMetrics、setPeReferenceY)
  - 现有测试无回归

## 偏差记录

无偏差 — 计划按预期执行。

## 已知桩点

无 — 所有文件均实现完整功能，无 placeholder 或 stub。

## 威胁标记

无新增威胁表面。chartBuffer 的索引计算完全内部化，metricIndex 由常量控制，push 使用模运算保证边界安全。

## 自检

- [x] `frontend/src/store/chartBuffer.ts` 存在
- [x] `frontend/src/store/chartDataStore.ts` 存在
- [x] `frontend/src/store/__tests__/chartBuffer.test.ts` 存在
- [x] `frontend/src/store/__tests__/chartDataStore.test.ts` 存在
- [x] `frontend/src/store/simulationSlice.ts` 已修改 (peReferenceY)
- [x] `frontend/src/store/index.ts` 已修改 (export useChartDataStore)
- [x] 提交 a6e9f53 存在于 git 历史

**自检结果: PASSED**
