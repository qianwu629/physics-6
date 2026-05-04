---
area: ui-ux
phase: 2
created: 2026-05-03
source: Phase 3 UAT — 弹簧创建/实体创建输入
---

# 位置和初速度输入框中最后一个 0 无法删除

## 描述

在创建实体或弹簧时，位置（X/Y/Z）和初速度输入框中，当用户想清空数值重新输入时，最后一个 "0" 字符无法通过退格键或 Delete 删除。输入框似乎有最小值守卫或空值回退逻辑，导致清空瞬间自动填充为 0。

## 期望行为

用户应能完全清空输入框内容，自由输入任意数值（包括负数），失焦或提交时才做校验和默认值填充。

## 可能原因

- `NumberInput` 组件（或底层 `<input type="number">`）在值为空字符串时自动 fallback 为 0
- Slider/Input 双向绑定中 `value ?? 0` 或 `Number(value) || 0` 的 defensive 逻辑
- `react-hook-form` 的 `valueAsNumber` 在空字符串时返回 NaN，被 `|| 0` 兜底

## 发现环境

Phase 3 UAT 手动验证
