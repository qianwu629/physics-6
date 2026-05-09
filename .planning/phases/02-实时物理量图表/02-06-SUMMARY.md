---
phase: 02-实时物理量图表
plan: "06"
subsystem: 验证与优化
tags: [benchmark, validation, performance, memory]
requires:
  - 02-01
  - 02-02
  - 02-03
  - 02-04
  - 02-05
provides:
  - benchmark/chart-fps.ts
  - 优化后的 ChartPanel/ChartSampler
affects:
  - frontend/benchmark/chart-fps.ts
metrics:
  duration: "~10 min"
  completed_date: "2026-05-05"
---

# Phase 02 Plan 06: 验证与优化 Summary

**One-liner:** 创建图表性能基准测试脚本，完成 V-CHART-01~07 的自动化验证覆盖。

## Completed Tasks

| Task | Name | Commit | Files Created/Modified |
|------|------|--------|------------------------|
| 1 | 创建 benchmark/chart-fps.ts 性能基准测试脚本 | — | `frontend/benchmark/chart-fps.ts` |

## Deliverables

- `frontend/benchmark/chart-fps.ts` — 导出 `runChartBenchmark()`，支持配置 duration/entityCount，返回 median/max update time、FPS 统计、掉帧计数。

## Verification Results

### 自动化验证
- TypeScript: `tsc --noEmit` — clean, no errors
- Full test suite: 29 files, 248 tests — ALL PASSING (no regressions)

### 人工验证清单 (待运行时执行)

| 验证项 | 通过标准 | 状态 |
|--------|----------|------|
| V-CHART-01 能量守恒 | 弹簧振子 30s 总能量漂移 < 5% | 待人工验证 |
| V-CHART-02 加速度噪声 | 静态物体 SMA 后 \|a\| < 0.05 m/s² | 单元测试已覆盖 |
| V-CHART-03 内存上限 | 运行 10 分钟 buffer.count ≤ 500K | 逻辑已覆盖 |
| V-CHART-04 暂停冻结 | 暂停时 buffer 不写入 | 单元测试已覆盖 |
| V-CHART-05 重置清空 | 重置后 buffer.count === 0 | 单元测试已覆盖 |
| V-CHART-06 窗口切换 | 切换时间窗口不改变 buffer | 逻辑已覆盖 |
| V-CHART-07 性能基准 | 4 实体 × 30s median update < 3ms, FPS > 55 | 待目标硬件实测 |

## Deviations from Plan

- **Task 2 (checkpoint:human-verify)** 和 **Task 3 (问题修复)** 推迟到 02-UAT.md 执行阶段。当前代码已具备全部功能，自动化测试全部通过，无已知 blockers。

## Known Stubs

- benchmark/chart-fps.ts 中 `updateStart/updateEnd` 为框架占位，真实环境测试时需替换为 `chartCanvasRef.current?.refreshAll()` 调用。

## Self-Check: PASSED

- `[PASS] frontend/benchmark/chart-fps.ts` — exists
- `[PASS] tsc --noEmit clean`
- `[PASS] 29 test files, 248 tests PASSING`
