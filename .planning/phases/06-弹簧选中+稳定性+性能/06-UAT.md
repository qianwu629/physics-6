---
status: pending
phase: 06-弹簧选中+稳定性+性能
source:
  - ROADMAP.md Phase 6
  - REQUIREMENTS.md DEBT-01~03
  - v1.0-MILESTONE-AUDIT.md tech_debt
started: ""
updated: "2026-05-05"
---

## Current Test

[phase not started — UAT template created for future execution]

## Tests

### 1. 弹簧 tube 端点点击选中
expected: 点击弹簧 tube 的任意可见部分（包括端点和中间段），均能正确选中弹簧实体。
result: pending

### 2. 弹簧 tube 中段点击选中
expected: 点击弹簧 helix tube 的中间弯曲部分，射线检测能正确命中并选中弹簧实体。
result: pending

### 3. 多弹簧链稳定性 — 低刚度
expected: 构建 3+ 弹簧链（质量块串联），刚度设为 50 N/m，运行 30 秒，无穿插/爆炸/数值发散。
result: pending

### 4. 多弹簧链稳定性 — 中等刚度
expected: 同上，刚度设为 200 N/m，运行 30 秒，无穿插/爆炸/数值发散。
result: pending

### 5. 多弹簧链稳定性 — 高刚度
expected: 同上，刚度设为 500 N/m，运行 30 秒，无穿插/爆炸/数值发散。
result: pending

### 6. 多弹簧链稳定性 — 超高刚度
expected: 同上，刚度设为 1000 N/m，运行 30 秒，无穿插/爆炸/数值发散。
result: pending

### 7. 性能基准 — 空场景 FPS
expected: 空场景下 FPS ≥ 60（作为基准）。
result: pending

### 8. 性能基准 — 50 实体 + 20 弹簧
expected: 加载 50 实体 + 20 弹簧场景，全可视化（轨迹+矢量+图表）开启，目标硬件平均 FPS ≥ 55。
result: pending

### 9. 性能基准 — 内存占用
expected: 上述场景运行 5 分钟后，JS Heap Size 稳定，无持续增长。
result: pending

### 10. 性能 Profile 记录
expected: 生成 performance profile 报告，记录瓶颈模块（提交至 milestones/v2.0-PERF-PROFILE.md）。
result: pending

## Summary

total: 10
passed: 0
issues: 0
resolved: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

Phase 6 尚未开始执行，所有测试项为模板状态。执行阶段时逐项验证并更新 result。本阶段关闭 v1.0 遗留的 3 项技术债务（DEBT-01~03）。
