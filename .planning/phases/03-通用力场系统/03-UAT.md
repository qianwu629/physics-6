---
status: pending
phase: 03-通用力场系统
source:
  - ROADMAP.md Phase 3
  - REQUIREMENTS.md FIELD-01~04
started: ""
updated: "2026-05-05"
---

## Current Test

[phase not started — UAT template created for future execution]

## Tests

### 1. ForceField ECS 实体创建
expected: 通过 Toolbox + CreationDialog 可创建 ForceField 类型实体，包含 type/position/range/strength 参数。
result: pending

### 2. 均匀方向力场
expected: 创建均匀方向场（如 [1,0,0] 方向），场中所有动态实体受到恒定向量力，运动轨迹为匀加速直线。
result: pending

### 3. 点引力源
expected: 创建点引力源，距离场源 r 处的实体受力大小符合 1/r² 衰减。释放测试球体后轨迹为类抛物线/椭圆。
result: pending

### 4. 点电荷电场
expected: 创建带电荷的点电荷电场，同性电荷相斥、异性相吸，力大小符合库仑定律。带电荷实体响应电场力。
result: pending

### 5. 均匀磁场
expected: 创建均匀磁场（如 [0,1,0] 方向），带电荷且具初速度的实体做圆周运动（洛伦兹力 F=qv×B）。
result: pending

### 6. 力场 UI 编辑
expected: 选中力场实体后，PropertyPanel 可编辑类型、位置、强度、作用范围。修改后场景中力场效果实时更新。
result: pending

### 7. 力场删除
expected: 选中的力场实体可被删除，删除后不再对场景中的实体施加力。
result: pending

### 8. 力场体积可视化
expected: 力场实体在 3D 场景中显示为半透明体积或方向箭头矩阵，直观展示力场分布。
result: pending

### 9. 力线可视化 toggle
expected: Toolbar 中「力线」toggle 按钮可开启/关闭力线（流线/电场线/磁感线）叠加层。密度反映场强大小。
result: pending

### 10. 多力场叠加
expected: 场景中同时存在多个不同类型的力场，实体受力为各力场的矢量和，与重力正确叠加。
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

Phase 3 尚未开始执行，所有测试项为模板状态。执行阶段时逐项验证并更新 result。
