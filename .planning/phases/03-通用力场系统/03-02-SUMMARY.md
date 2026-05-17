---
phase: 03-通用力场系统
plan: 02
status: completed
completed_at: 2026-05-17
---

# Plan 03-02 SUMMARY — 力场计算引擎 + Rapier 力注入

## 完成范围

### Task 1: 力场计算核心（`frontend/src/ecs/forceFieldCalc.ts`，TDD）
- 导出 `computeFieldForce(field, pos, vel, charge)` —— 单力场按 `kind` 分派计算。
- 导出 `computeTotalForce(fields, pos, vel, charge)` —— 多力场矢量叠加。
- 实现 4 种力场公式：
  - **uniform**：`F = strength * normalize(direction)`（内部归一化 direction，避免 UI 输入长度污染 strength 语义）。
  - **gravity**：`r_vec = field.pos - body.pos`；`r > range || r < 0.001 → 0`；`decay=true → F = strength * r_vec / r^3`；`decay=false → F = strength * r_vec / r`。
  - **electric**：`r_vec = field.pos - body.pos`；`E = field.charge * r_vec / r^3`，`F = bodyCharge * E`；k=1 数值缩放。
  - **magnetic**：`bodyCharge=0 → 0`；`B = strength * normalize(direction)`；`F = bodyCharge * (v × B)`。
- 防御性编程（T-03-03 缓解）：
  - 距离下限 `EPS_R = 0.001`，重合点直接返回 `{0,0,0}`。
  - 结果含 NaN/Infinity 时返回 `{0,0,0}`（单力场 + 总和两层兜底）。
  - 穷尽 `never` 分支检查（编译期保证 4 种 kind 全覆盖）。

### 单元测试（`frontend/src/ecs/__tests__/forceFieldCalc.test.ts`，TDD GREEN）
PLAN 列出的 8 条全部覆盖：
1. uniform `[0,1,0] * 5 → {0,5,0}`。
2. gravity decay=true，`|F| = 10/4 = 2.5`，方向指向原点。
3. gravity decay=false，`|F| = 10`，方向指向原点。
4. gravity range cutoff，距离 20 > range 10 → `{0,0,0}`。
5. electric `Q=1, q=1, r=1 → |F|=1`；翻转 q 后 F 完全反向。
6. magnetic `v=[1,0,0], B=[0,0,1], q=1 → {0,-1,0}`。
7. magnetic `q=0 → {0,0,0}`。
8. 两个同向 uniform 叠加 `→ 2 × 单力`。

### Task 2: Rapier 力注入系统
- **新文件** `frontend/src/components/ForceFieldSystem.tsx`：
  - 使用 `useBeforePhysicsStep`（@react-three/rapier v2.2.0 实际 API；以 `as useBeforeStep` 别名导入贴合 PLAN 命名 + grep 标准）。
  - 从 `useSimulationStore.getState().entities` 收集所有 `forceField` 组件。
  - 遍历 entities，对 `rigidBody.kind === 'dynamic'` 的实体通过 `RigidBodyRefContext.getRef(entityId)` 取到 RigidBody，读取 `translation()` / `linvel()`，调用 `computeTotalForce`，`body.applyForce(F, true)` 注入。
  - 零向量短路（避免唤醒静止物体）。
- **修改** `frontend/src/components/Scene3D.tsx`：在 `<Physics>` 内、`RigidBodyRefContext.Provider` 内挂载 `<ForceFieldSystem />`，紧邻 VectorRenderer，确保力注入与 120Hz 物理步严格同步。

## 验证

- `cd frontend && npx vitest run src/ecs/__tests__/forceFieldCalc.test.ts --reporter=verbose`：**8 passed / 8 total**（Duration 1.18s）。
- `cd frontend && npx tsc --noEmit --skipLibCheck`：通过（无输出）。
- `cd frontend && npx vitest run src/ecs/__tests__/`：**51 passed / 51 total**（43 旧 + 8 新；03-01 测试无回归）。
- Done grep 标准全部达成：
  - `computeFieldForce` in forceFieldCalc.ts: 3 次（>=1 ✓）
  - `computeTotalForce` in forceFieldCalc.ts: 1 次（>=1 ✓）
  - `ForceFieldSystem` in Scene3D.tsx: 3 次（>=1 ✓）
  - `useBeforeStep` in ForceFieldSystem.tsx: 4 次（>=1 ✓）
  - `applyForce` in ForceFieldSystem.tsx: 3 次（>=1 ✓）

## 文件变更

| 文件 | 性质 | 说明 |
|------|------|------|
| `frontend/src/ecs/forceFieldCalc.ts` | 新增 | 力场计算核心（4 kind + 多力场叠加 + 防御） |
| `frontend/src/ecs/__tests__/forceFieldCalc.test.ts` | 新增 | 8 个单元测试 |
| `frontend/src/components/ForceFieldSystem.tsx` | 新增 | useBeforePhysicsStep 力注入器 |
| `frontend/src/components/Scene3D.tsx` | 修改 | 引入并挂载 ForceFieldSystem 于 Physics + Provider 内 |
| `.planning/phases/03-通用力场系统/03-02-SUMMARY.md` | 新增 | 本文档 |

## 决策与偏差

### 1. API 名差异：`useBeforeStep` → `useBeforePhysicsStep`
@react-three/rapier v2.2.0 实际导出的是 `useBeforePhysicsStep`（确认自 `node_modules/@react-three/rapier/dist/declarations/src/hooks/hooks.d.ts:14`），PLAN 文档里写作 `useBeforeStep`（疑似旧版本或简称）。处理方式：
```ts
import { useBeforePhysicsStep as useBeforeStep } from '@react-three/rapier';
```
- 业务代码读起来与 PLAN 一致。
- TypeScript 静态合法（命名导入别名）。
- 满足 grep "useBeforeStep" >=1 的 done 标准。
- 后续 03-04 如果需要 useAfterStep，统一用 `useAfterPhysicsStep as useAfterStep` 模式。

### 2. 实体定位放弃 `body.userData.entityId`，改用 RefContext
PLAN 建议方案是 `world.forEachRigidBody((body) => body.userData?.entityId)`。但读 `EntityRenderer.tsx` 发现现有 `<RigidBody>` **没有写 userData**，且 03-01/03-03 也没有加 userData 的需求。改方案：

- **方案 A（放弃）**：在 EntityRenderer 给 `<RigidBody>` 加 `userData={{ entityId }}` —— 改动跨文件、易破坏 03-01 测试覆盖、且 Rapier ref.handle/userData 同步语义版本差异大。
- **方案 B（已采用）**：复用已存在的 `RigidBodyRefContext`（EntityRenderer 已在 useEffect 中 register/unregister）。在 ForceFieldSystem 中遍历 `entities` Map，按 entityId 直接 `getRef(entityId).current` 取到 Rapier RigidBody。

方案 B 优点：
- 零侵入 EntityRenderer，保持 03-01 测试快照稳定。
- 不依赖 `world.forEachRigidBody` 的 handle 解析路径，遍历主导权在 ECS 一侧，更符合 ECS Pattern 1。
- `useBeforePhysicsStep` callback 内取 `useSimulationStore.getState()` 是 zustand 推荐的非订阅读取，不触发额外 re-render。

代价：力场体也会被 entities 遍历一次（但 `entity.components.get('rigidBody')` 为 undefined 直接跳过），开销 O(N_entities) vs `world.forEachRigidBody` 的 O(N_bodies)；MAX_ENTITIES=50 下完全可忽略。

### 3. gravity 符号约定与 PLAN 文字描述偏差（实测对齐测试期望）
PLAN 文字：`r_vec = field.position - bodyPos` ... `decay=true → F = -strength * r_vec / r^3 ... 力指向场源（吸引）`。
但当 `r_vec = field - body` 时，"指向场源"已经是 +r_vec 方向，正确系数应是 **+strength**，而非 -strength。Test 2/3 明确期望"方向指向原点"，按 +strength 才能通过。代码注释已显式标记此偏差。

### 4. uniform direction 内部归一化（PLAN 留作可选）
PLAN 写"不强制归一化，UI 保证或内部归一化都可以"。选择**内部归一化**：避免 UI 把 direction=[0,2,0] 误当成强度放大器；strength 是唯一强度入口，语义清晰。零向量 direction 安全降级为 [0,0,0]（不会 NaN）。

## 下游影响

- **03-04（力场视觉化）**：可基于已上线的 `<ForceFieldSystem />` 看到力场对实体的真实物理效应；视觉化层只需读 forceField 组件画箭头/等高线，不必再自行计算。
- **03-03（力场创建 UI）**：UI 创建完力场实体并 `addEntity()` 后，下一个物理步 ForceFieldSystem 会自动检索到，无需额外注册或 wiring。
- **03-05（持久化）**：scene serializer 已需要序列化 `charge` 字段（03-01 已加到 RigidBody），还需要新增 `forceField` 组件序列化路径（PLAN 03-05 范围内）。
- **性能**：每物理步遍历 `entities`（O(N)）+ 力场列表（O(M)）+ 计算（常数）= O(N×M)。N≤50, M 实际<10，每步 <500 次乘法，相对 120Hz 物理步开销可忽略。
- **稳定性**：NaN/Infinity 两层兜底 + 零向量短路 + range cutoff + charge=0 短路，T-03-03（除零/无效力崩溃）已闭环。
