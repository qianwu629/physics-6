---
status: pending
phase: 05-自由飞行摄像机+2D模式
source:
  - ROADMAP.md Phase 5
  - REQUIREMENTS.md CAM-01~02, DIM2-01~02
started: ""
updated: "2026-05-05"
---

## Current Test

[phase not started — UAT template created for future execution]

## Tests

### 1. FPS 模式切换
expected: Toolbar 或快捷键可切换 OrbitControls 与 FPS 自由飞行模式。切换后摄像机控制方式改变。
result: pending

### 2. WSAD 平移
expected: FPS 模式下，W/S 控制前后移动，A/D 控制左右平移，移动方向与当前视角方向一致，qe控制视角左右旋转。
result: pending

### 3. 空格ctrl 升降
expected: FPS 模式下，空格/ctrl 控制摄像机垂直升降。
result: pending

### 4. 鼠标拖拽旋转
expected: FPS 模式下，鼠标拖拽控制视角旋转（pitch/yaw），滚轮调整移动速度。
result: pending

### 5. 虚拟键盘 fallback
expected: 移动设备/触控屏上，左侧虚拟键盘控制平移和视角旋转，右侧拖拽控制视角旋转。
result: pending

### 6. 2D 模式切换
expected: UI 中可一键切换 2D/3D 模式。切换后所有动态实体的 z 坐标和 z 速度锁定为 0，并且视像头视角不可左右旋转和升降。
result: pending

### 7. 2D 模式摄像机
expected: 2D 模式下摄像机切换为正交投影，默认俯视或侧视视角，可调整观察角度。
result: pending

### 8. 2D 模式 UI 隐藏 z 轴参数
expected: 2D 模式下，CreationDialog、PropertyPanel、力场参数中所有 z 轴相关输入被隐藏或禁用。
result: pending

### 9. 2D 模式力场/约束降维
expected: 2D 模式下，力场可视化和约束渲染正确降维显示（无 z 轴相关视觉元素）。
result: pending

### 10. 2D 模式物理行为
expected: 2D 模式下创建的实体仅在 xy 平面运动，z 轴约束在引擎层生效（无 z 漂移）。
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

Phase 5 尚未开始执行，所有测试项为模板状态。执行阶段时逐项验证并更新 result。
