---
status: pending
phase: 04-表达式驱动外加力
source:
  - ROADMAP.md Phase 4
  - REQUIREMENTS.md EXPR-01~02
started: ""
updated: "2026-05-05"
---

## Current Test

[phase not started — UAT template created for future execution]

## Tests

### 1. 表达式输入界面
expected: 选中实体后，PropertyPanel 中显示 fx/fy/fz 三个表达式输入框，可输入数学公式。
result: pending

### 2. 基本四则运算表达式
expected: 输入表达式如 "px * 2"、"vy + 1"、"5 - t"，仿真运行时实体受到正确计算的外加力。
result: pending

### 3. 三角函数表达式
expected: 输入表达式如 "sin(t)"、"cos(px)"、"tan(py * 0.1)"，每帧正确求值并施加力。
result: pending

### 4. 指数对数表达式
expected: 输入表达式如 "exp(-t)"、"log(mass)"，求值结果正确。
result: pending

### 5. 常量支持
expected: 表达式中可使用 pi、e、g 等常量，求值结果与标准数学常量一致。
result: pending

### 6. 变量绑定
expected: 表达式支持 px/py/pz（位置）、vx/vy/vz（速度）、t（时间）、m（质量）变量，每帧根据实体实时状态求值。
result: pending

### 7. 语法错误即时反馈
expected: 输入无效表达式（如 "sin()"、"px +"），输入框边框变红并显示错误提示；无效表达式不被启用，不影响仿真。
result: pending

### 8. 性能基准
expected: 50+ 实体场景下，每帧表达式解析+求值总开销 < 2ms，不影响 FPS。
result: pending

### 9. 表达式与力场叠加
expected: 实体同时受表达式力和力场力作用时，合力为两者矢量和，物理行为正确。
result: pending

### 10. 表达式持久化
expected: 表达式随场景导出/导入，保存到快照后恢复时表达式仍然有效。
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

Phase 4 尚未开始执行，所有测试项为模板状态。执行阶段时逐项验证并更新 result。
