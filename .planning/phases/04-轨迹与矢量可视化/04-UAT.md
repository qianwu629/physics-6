---
status: complete
phase: 04-轨迹与矢量可视化
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md
started: 2026-05-04T02:01:00Z
updated: 2026-05-04T02:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 轨迹残影显示
expected: 运动物体（球体下落弹跳）留下可见的拖尾残影线条，描绘运动路径，线尾透明渐变消失
result: issue
reported: "这个轨迹线有点短了，别的问题到没有"
severity: minor

### 2. 轨迹全局与按实体独立开关
expected: ① Toolbar"轨迹"按钮可全局切换轨迹显示/隐藏 ② PropertyPanel 中单个实体的"显示轨迹"Switch 可独立控制该实体 ③ 全局和单个开关相互独立
result: pass

### 3. 速度矢量箭头
expected: 开启"速度"toggle 后，运动物体中心发出蓝色箭头，箭头长度与速率成正比（快速物体箭头长，慢速物体箭头短），方向与瞬时速度方向一致
result: pass

### 4. 受力矢量彩色显示
expected: 开启"受力"toggle 后：① 自由下落物体显示灰色重力箭头 + 潜在的接触力 ② 弹簧连接物体显示绿色弹力箭头 ③ 箭头颜色区分不同力类型
result: pass

### 5. 速度和受力独立切换
expected: 分别点击 Toolbar 中"速度"和"受力"按钮可独立开关各自矢量层，两者互不影响
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "运动物体留下可见的轨迹残影线条，描绘随时间变化的运动路径"
  status: failed
  reason: "User reported: 这个轨迹线有点短了，别的问题到没有"
  severity: minor
  test: 1
  root_cause: "TrajectoryBuffer.ts 中 MAX_AGE_SECONDS=5 限制了轨迹长度——30Hz 采样×5秒=150 个有效点，对快速运动的物体显得过短"
  artifacts:
    - path: "frontend/src/ecs/TrajectoryBuffer.ts:4"
      issue: "MAX_AGE_SECONDS=5 过于严格，导致拖尾长度不足"
  missing:
    - "增大 MAX_AGE_SECONDS 至 10 秒（同时确认 MAX_POINTS=300 能覆盖 10 秒×30Hz=300 点）"
    - "或将默认值与 visualizationStore 中可调参数关联，允许用户调节"
  debug_session: ""
