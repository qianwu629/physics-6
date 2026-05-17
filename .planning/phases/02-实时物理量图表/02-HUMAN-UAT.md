---
status: partial
phase: 02-实时物理量图表
source: [02-VERIFICATION.md]
started: 2026-05-17T04:20:00Z
updated: 2026-05-17T04:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 完整功能集成测试
expected: 创建实体 → 开启图表追踪 → 点击Toolbar图表按钮 → ChartPanel浮动面板显示 → 播放仿真后实时曲线绘制 → 切换4类指标 → 切换时间窗口 → 暂停冻结 → 重置清空 → 多实体多曲线
result: [pending]

### 2. ChartPanel 拖拽功能
expected: 拖拽面板标题栏可移动位置；已知 C-02 (ref冲突) 委托 Phase 01.1
result: [pending]

### 3. separate 模式多实体图表
expected: 切换到 separate 模式后每个追踪实体有独立子Chart；已知 C-03 委托 Phase 01.1
result: [pending]

### 4. 性能基准 (V-CHART-07)
expected: 16条曲线 × 30秒场景下 FPS下降 < 2，median update < 3ms/frame
result: [pending]

### 5. 长时间运行内存稳定性 (V-CHART-03)
expected: 10分钟连续运行后内存稳定，每个buffer不超过500K数据点
result: [pending]

### 6. 弹簧振子能量守恒实际验证 (V-CHART-01)
expected: 加载弹簧振子预设，运行30秒，总能量相对漂移 < 5%
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
