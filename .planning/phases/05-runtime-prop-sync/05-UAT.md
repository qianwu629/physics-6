---
status: complete
phase: 05-runtime-prop-sync
source: 05-01-SUMMARY.md
started: 2026-05-04T03:30:00Z
updated: 2026-05-04T03:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 暂停态修改弹性后恢复播放
expected: 修改 restitution 0.5→0.95 后，球体反弹高度明显增大
result: pass
note: |
  双重确认运行时同步生效：
  (1) 修改 entity 自身 restitution 0.5→0.95 → 反弹次数显著增加（每次保留 ~90% 高度）
  (2) 修改 environment.restitutionScale 进一步放大 → 公式 min(0.95×scale, 1.0) 被 cap 到 1.0 → 几乎无衰减
  能量衰减曲线本身是 Rapier 在 restitution<1.0 下的正确物理行为，不是 bug。

### 2. 运行态实时修改摩擦
expected: 物体运动中编辑 friction 1.0→0.05，物体减速明显减弱
result: pass

### 3. 运行态修改质量
expected: 修改运动中物体的 mass，物体在碰撞/弹簧中表现不同
result: skipped
reason: |
  用户选择跳过此项（不便于现场设置碰撞/弹簧场景）。
  setAdditionalMass 调用已被单元测试 Test C（runtime-prop-sync.test.tsx）覆盖：
  断言 mass 1→5 时 setAdditionalMass(5, true) 被调用。
  与 Test 1/2 共同的 useEffect 链路（dep 数组包含 rigidBody?.mass）保证了同样的运行时同步行为。

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none]
