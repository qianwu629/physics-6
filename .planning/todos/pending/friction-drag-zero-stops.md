---
area: physics
phase: 3
created: 2026-05-03
source: UAT-04 环境参数修改
---

# 摩擦和空气阻力全调为0后物体仍会停止

## 描述

在环境面板中将摩擦倍率和空气阻力全部调成 0，运行仿真后物体仍然会逐渐减速并最终停下来。预期在无摩擦、无空气阻力条件下，物体应保持运动。

## 可能原因

- Rapier 内置的最小阻尼值未覆盖
- EntityRenderer 中 `linearDamping` 公式有下限
- `@react-three/rapier` 的 RigidBody 默认 damping 值

## 发现环境

Phase 3 UAT 手动验证
