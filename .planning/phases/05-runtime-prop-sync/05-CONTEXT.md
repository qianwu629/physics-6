# Phase 5: 运行时属性同步与债务清理 - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Source:** Tech debt closure (REN-03 / Pitfall 5)

<domain>
## Phase Boundary

关闭 Phase 2 遗留的 SC-3 已知问题：让 PropertyPanel 中编辑实体物理参数（mass、restitution、friction）后，Rapier 物理引擎在运行时立即响应这些变更，无需重置或重新创建实体。

**作用范围：**
- ✅ 修改 `EntityRenderer.tsx`：通过 `useEffect` 在 component 数据变化时调用 `rigidBodyRef.current.set*()` API
- ✅ 验证编辑→运行时同步链路（暂停态和运行态都生效）
- ❌ 不重写 ECS 数据流（已 verified working）
- ❌ 不动 PropertyPanel/Zustand store（已 verified working）

</domain>

<decisions>
## Implementation Decisions

### Root Cause（已锁定）
- `@react-three/rapier` 的 RigidBody 把 React props（mass/restitution/friction/position）视为**初始化值**，挂载后 prop 变更不触发 Rapier 内部状态更新
- 修复手段：通过 `rigidBodyRef.current.setRestitution()/setFriction()/setAdditionalMass()` 等 imperative API 同步

### 修复方案（已锁定）
- 在 `EntityRenderer.tsx` 中添加 `useEffect`，依赖 `rigidBody.mass`、`rigidBody.restitution`、`rigidBody.friction`（以及环境倍率 `frictionScale`、`restitutionScale`）
- 每次 component 变化时调用：
  - `rigidBodyRef.current.setRestitution(restitution * restitutionScale)` （注意：实际应用需要找到 collider）
  - `rigidBodyRef.current.setFriction(friction * frictionScale)` （同上）
  - `rigidBodyRef.current.setAdditionalMass(mass)` （或 setMassProperties）
- 阻力（drag）仍通过 `linearDamping` prop（drag 是环境级且通过 setLinearDamping 也可以同步）
- `position`/`rotation` 编辑保持暂停态可改、运行时动态改可选：先实现暂停态生效，再考虑运行时

### 验证策略（已锁定）
- 单元测试：mock `rigidBodyRef.current.set*()` 调用次数（确保 useEffect 触发）
- E2E：暂停模拟 → 编辑弹性系数 0.5 → 0.95 → 恢复播放 → 球体反弹高度明显增加
- E2E：运行中编辑摩擦系数 → 物体减速明显变化
- 回归：Phase 1-4 的 21+ 测试套件继续通过

### Claude's Discretion
- useEffect 的具体依赖列表组织
- mass 用 setAdditionalMass 还是 setMassProperties（需查 @react-three/rapier docs 确认）
- 是否需要拆分多个 useEffect（按字段分还是合并）
- 测试用例的 mocking 方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 上下文（修复源头）
- `.planning/phases/02-entity-component-system-property-editing/02-VERIFICATION.md` — SC-3 详细分析、Pitfall 5 确认、修复路径建议（含 useEffect 伪代码）
- `frontend/src/components/EntityRenderer.tsx` — 当前 RigidBody 挂载位置、rigidBodyRef 已声明
- `frontend/src/components/PropertyPanel.tsx` — 编辑触发链路（updateComponent action）

### Rapier API 文档
- `@react-three/rapier` RigidBody ref API: setRestitution / setFriction / setAdditionalMass / setLinearDamping
- `@dimforge/rapier3d` Collider 上的 setRestitution/setFriction（注意：物理参数有些是 collider-level，不是 body-level）

### 环境倍率
- `frontend/src/store/simulationSlice.ts` — frictionScale / restitutionScale 已存在
- `frontend/src/components/EntityRenderer.tsx` lines 134-137 — 当前倍率应用方式（仅作为初始 prop）

</canonical_refs>

<specifics>
## Phase-Specific Notes

- 这是**单计划阶段**（small focused fix），预期 1 个 PLAN 文件，3-5 个 task
- 修复点高度集中在 `EntityRenderer.tsx`，影响小，回归风险低
- Success Criteria 见 ROADMAP.md Phase 5 section（4 项）
- 没有 UI 变更（PropertyPanel 已就绪）
- 没有新依赖

</specifics>
