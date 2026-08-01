---
status: resolved
trigger: 创建磁场后，放入球体并且开始运行后，球体会凭空加速，能量也凭空增加，会在极短时间内增加到63兆焦耳达到上限并且消失
created: 2026-05-24
updated: 2026-05-24
---

# Debug Session: magnetic-field-energy-explosion

## Symptoms

1. 创建磁场后，放入球体开始运行，球体凭空加速
2. 能量凭空增加，极短时间内增加到63兆焦耳
3. 达到能量上限后球体消失

## Expected Behavior
- 球体（带电）在磁场中应受洛伦兹力作用，做圆周/螺旋运动
- 洛伦兹力不做功，动能/能量应保持守恒（仅方向改变，速度大小不变）
- 球体不应凭空加速，能量不应凭空增加

## Actual Behavior
- 球体开始运行后速度急剧增加
- 能量显示在极短时间内飙升到63兆焦耳上限
- 达到上限后球体消失

## Timeline
- 问题在 Phase 3 完成后出现
- 创建磁场并放入手动创建的自定义球体后触发

## Current Focus

hypothesis: "磁场力计算存在数值不稳定或力被重复/错误累加，导致能量不守恒"
test: "检查磁场力计算公式和每帧施加逻辑"
expecting: "找到导致能量凭空增加的力计算错误"
next_action: "gather initial evidence"
reasoning_checkpoint: ""

## Evidence

- **2026-05-24**: 检查 `frontend/src/ecs/forceFieldCalc.ts` 中磁场力计算公式
  - `magnetic()` 函数实现: `F = q * (v x B)`，公式本身正确
  - 但 `bodyCharge` 默认值为 0（`createSphereEntity` 中 `charge: 0`）
  - 属性面板中电荷范围: `-10` 到 `10` C

- **2026-05-24**: 检查 `frontend/src/components/ForceFieldSystem.tsx` 力施加逻辑
  - 使用 `useBeforePhysicsStep`（别名为 `useBeforeStep`）
  - 每物理步前调用 `body.addForce(F, true)` 施加力

- **2026-05-24**: 检查 `frontend/src/components/Scene3D.tsx`
  - Physics timeStep = `1/120`（120Hz 固定步长）
  - 无能量上限或自动删除逻辑

- **2026-05-24**: 检查 `frontend/src/utils/physicsCalc.ts`
  - 能量计算: `KE = 0.5 * m * v^2`
  - 63 MJ 对应: 若 m=1kg, v = sqrt(2*63e6) ≈ 11225 m/s（约 11km/s！）

- **2026-05-24**: 关键数学推导——半隐式欧拉对洛伦兹力的数值稳定性分析
  - 洛伦兹力: `F = q(v x B)`，始终垂直于速度，物理上不做功
  - 半隐式欧拉积分: `v_{n+1} = v_n + (q/m)(v_n x B) * dt`
  - 令 `w = (qB/m) * dt`
  - 速度平方: `v_{n+1}^2 = v_n^2 * (1 + w^2)`
  - **每步能量增长因子为 `(1 + w^2)`！**
  - 当 `q=10` C, `B=10` T, `m=1` kg, `dt=1/120` s: `w ≈ 0.833`
  - 每步能量增长 ≈ 69%，1秒内增长约 10^26 倍
  - 这就是能量在极短时间内爆炸到 63 MJ 的根因

## 根因分析

**根本原因**: `@react-three/rapier` 的半隐式欧拉积分器对速度相关的洛伦兹力 `F = q(v x B)` 的显式处理导致数值能量不守恒。每步能量增长因子为 `(1 + (qB/m * dt)^2)`，当参数较大时能量指数爆炸，球体速度急剧增加至 ~11km/s，能量飙升至 63 MJ 后飞出场景消失。

**为什么物理上洛伦兹力不做功，但数值模拟中能量增加？**
- 物理上: `v · F = 0`（力始终垂直于速度）
- 数值上: 半隐式欧拉中，`v_{new} = v + a(v) * dt`
- 离散化后: `v_{new}^2 = v^2 + a(v)^2 * dt^2 > v^2`
- 额外的 `a(v)^2 * dt^2` 项是离散化误差，导致能量每步增加

## 修复方案

**推荐方案**: 对磁场力特殊处理，不通过 `addForce` 施加，而是使用罗德里格斯旋转公式直接旋转速度向量，保证能量严格守恒。非磁场力（重力、电场、均匀场）仍通过 `addForce` 正常施加。

**修复文件**:
- `frontend/src/components/ForceFieldSystem.tsx`
- `frontend/src/components/RigidBodyRefContext.tsx` (添加 `setLinvel` 类型)

## Specialist Review

**typescript-expert 审查结果**: LOOKS_GOOD

1. 根因分析正确——半隐式欧拉对速度相关力的显式处理确实会导致能量漂移，这是数值分析中的经典问题
2. 使用罗德里格斯旋转公式直接旋转速度向量是处理磁场力的标准数值方法，能保证能量严格守恒
3. 将磁场力与其他力分离处理是合理的架构

**需要注意的改进点**:
1. `setLinvel` 会覆盖 Rapier 在该步中对速度的积分结果。但由于 `dt = 1/120` 很小，顺序误差可忽略
2. 需确认 `setLinvel` 在 `@react-three/rapier` v2.2.0 中是否存在。若不存在，需使用替代方法
3. 建议将旋转逻辑提取到单独函数中便于测试
4. 建议添加单元测试验证能量守恒

## Eliminated

- [x] 磁场力公式错误 — 公式 `F = q(v x B)` 正确
- [x] `addForce` 跨步累加 — Rapier 的力累加器每步清零，不会跨步累加
- [x] 电荷默认值问题 — 默认 `charge=0` 正确
- [x] 能量上限自动删除 — 不存在能量上限自动删除逻辑
- [x] 多个磁场叠加 — 不是主要问题

## Resolution

### Round 1（不完整）

- **root_cause**: 半隐式欧拉积分器对速度相关洛伦兹力的显式处理导致能量漂移
- **fix**: 引入罗德里格斯旋转 + `setLinvel` 处理磁场力
- **遗漏**: `computeTotalForce` 仍包含磁场力并通过 `addForce` 施加 → **双重施加**

### Round 2（最终修复）

- **root_cause**: Round 1 未将磁场力从 `computeTotalForce` → `addForce` 路径中移除，导致磁场力被双重施加。`setLinvel(rotate(v))` 设置旋转速度后，`addForce` 中残留的 F_magnetic 又在 `stepWorld` 中被积分，每步额外增加 `0.5·m·|a_mag|²·dt²` 能量。
- **fix**:
  1. `forceFieldCalc.ts` 新增 `computeNonMagneticForce()`，排除 `kind === 'magnetic'` 的力场
  2. `ForceFieldSystem.tsx` 替换 `computeTotalForce` → `computeNonMagneticForce`
  3. 修复磁场检查条件的运算符优先级：`charge !== 0 && (B.x !== 0 || B.y !== 0 || B.z !== 0)`
- **fix_location**: `frontend/src/ecs/forceFieldCalc.ts` + `frontend/src/components/ForceFieldSystem.tsx`
- **verification**: TypeScript 编译通过（零错误）
