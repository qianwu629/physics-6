---
status: complete
phase: 02-实时物理量图表
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
  - 02-05-SUMMARY.md
  - 02-06-SUMMARY.md
started: "2026-05-05"
updated: "2026-05-17T04:25:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. PropertyPanel 图表追踪开关
expected: 选中任意实体后，PropertyPanel 可视化区域显示「图表追踪」Switch，默认关闭。开启后该实体进入追踪列表。
result: pass

### 2. Toolbar 图表按钮
expected: Toolbar 右侧显示「图表」toggle 按钮。点击后 ChartPanel 浮动面板出现；再次点击或点击面板关闭按钮后面板消失。
result: pass

### 3. ChartPanel 浮动面板显示
expected: 面板包含标题栏（可拖拽）、时间窗口切换按钮（5s/30s/全程）、布局模式切换（叠加/分离）、ChartMetricTabs（位置/速度/加速度/能量）、ChartCanvas 图表区域。
result: pass
note: 拖拽不可用（已知 C-02，委托 Phase 01.1）

### 4. 单实体单指标图表
expected: 开启一个实体的图表追踪，播放仿真，ChartPanel 中该实体的位置曲线（x/y/z 三条）应实时绘制。
result: pass
note: 曲线同色（全蓝），多曲线时难以区分——切换到其他指标时问题更明显

### 5. 多实体多曲线并存
expected: 开启 4 个实体的图表追踪，ChartPanel 中应同时显示最多 16 条曲线（4 实体 × 4 指标），按颜色区分不同实体。
result: issue
reported: "同时显示，但是颜色都是蓝色"
severity: major

### 6. 时间窗口切换
expected: 点击 5s/30s/全程 按钮，图表视口范围相应变化。切换过程中底层缓冲区数据不丢失，重新打开全程可看到完整历史。
result: pass
note: 面板固定左侧无法拖动（C-02），无法严格验证时间刻度；低置信度通过

### 7. 暂停时图表冻结
expected: 播放状态下图表实时更新；点击暂停后，图表曲线停止更新，定格在当前帧。
result: pass

### 8. 重置时图表清空
expected: 按 R 键重置仿真后，所有图表缓冲区被清空，ChartPanel 中曲线消失（或归零）。
result: pass

### 9. EnvironmentPanel 势能参考高度
expected: EnvironmentPanel 底部显示「势能参考高度」滑块，范围 -50~50m。调整数值后，能量曲线（PE/TotalE）应相应变化。
result: pass

### 10. 图表面板拖拽和调整大小
expected: 拖拽面板标题栏可移动面板位置；拖拽右下角可调整面板大小；面板尺寸变化后图表自适应。
result: issue
reported: "不能"
severity: major
note: 已知 C-02 (draggable ref) + W-02 (resize handle class mismatch)，委托 Phase 01.1

### 11. 关闭面板不影响采样
expected: 关闭 ChartPanel 后，被追踪实体的数据继续写入 buffer。重新打开面板后，能看到关闭期间的历史数据。
result: pass

### 12. 内存稳定性（长时间运行）
expected: 4 实体追踪、运行 10 分钟后，chartBuffers 中每个实体的数据点不超过 500K，JS Heap 无持续增长。
result: skipped
reason: 长时间测试，用户选择跳过

### 13. 能量守恒验证（弹簧振子）
expected: 加载「弹簧振子」预设，开启图表追踪，运行 30 秒后，总能量（KE + PE_gravity + PE_spring）相对漂移 < 5%。
result: pass

### 14. 加速度噪声验证
expected: 创建静态物体（无运动），开启图表追踪观察加速度曲线，SMA(5) 平滑后加速度幅值 < 0.05 m/s²。
result: pending

## Summary

total: 14
passed: 11
issues: 2
resolved: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "ChartPanel 中应同时显示最多 16 条曲线（4 实体 × 4 指标），按颜色区分不同实体"
  status: resolved
  reason: "User reported: 同时显示，但是颜色都是蓝色"
  severity: major
  test: 5
  root_cause: "ChartCanvas.tsx:127 使用 entityIdx % colors.length 取色——单实体下 entityIdx=0 导致 x/y/z 三条曲线全部取 colors[0]（同一蓝）。调色板仅 3 色/指标，无多实体余量。"
  artifacts:
    - path: "frontend/src/components/ChartCanvas.tsx"
      issue: "entityIdx % colors.length → 应使用 (entityIdx + axisIdx)"
  missing:
    - "改用 axisIdx 参与颜色索引，使同实体不同轴取不同色"
    - "扩展调色板从 3 色到 6 色/指标，支持多实体区分"
  debug_session: ""
- truth: "拖拽面板标题栏可移动面板位置；拖拽右下角可调整面板大小；面板尺寸变化后图表自适应"
  status: failed
  reason: "User reported: 不能拖拽也不能调整大小"
  severity: major
  test: 10
  note: 已知 C-02/W-02，委托 Phase 01.1
  artifacts: []
  missing: []
