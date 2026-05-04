---
phase: 05-runtime-prop-sync
plan: 01
subsystem: rendering
tags: [react-three-rapier, useEffect, imperative-api, ren-03, pitfall-5, runtime-sync]
requirements: [REN-03]
requirements_addressed: [REN-03]

# ── Dependency graph (lightweight) ──
provides:
  - "EntityRenderer useEffect hook that synchronises Rapier RigidBody/Collider state to ECS component changes at runtime"
  - "Phase 2 SC-3 closure (PropertyPanel edits now reach physics during play)"
requires:
  - "Phase 2 PropertyPanel → updateComponent → Zustand entity store (already verified)"
  - "Phase 3 environment scales (frictionScale / restitutionScale / drag) (already wired)"
  - "@react-three/rapier ref forwarding to underlying RapierRigidBody"
affects:
  - frontend/src/components/EntityRenderer.tsx
  - "Indirect: PropertyPanel edit-loop now end-to-end functional in both paused and running states"

tech_stack:
  added: []  # No new dependencies
  patterns:
    - "Imperative ref-based state sync inside useEffect for React-wrapped physics engines"
    - "Hook-before-early-return ordering with optional-chaining deps to satisfy Rules of Hooks"
    - "Comment-stripped static source-code grep gate to lock in critical fixes against future regression"

key_files:
  created:
    - frontend/src/__tests__/runtime-prop-sync.test.tsx
    - frontend/src/__tests__/physics/runtime-prop-sync-smoke.test.ts
  modified:
    - frontend/src/components/EntityRenderer.tsx

decisions:
  - id: D-05-01
    title: "Use rb.setAdditionalMass(mass, true) over setMassProperties"
    rationale: "Minimal invasion; does not require recomputing inertia tensor; wakeUp=true triggers sleeping bodies to respond to new mass."
  - id: D-05-02
    title: "Route restitution / friction through rb.collider(0)"
    rationale: "Rapier3D defines these properties on the Collider, not the RigidBody. Calling rb.setRestitution does not type-check and would have no effect at runtime."
  - id: D-05-03
    title: "Place new useEffect before the early-return null check"
    rationale: "React Rules of Hooks require unconditional ordering. Deps use optional chaining (rigidBody?.mass) to remain safe when the entity briefly lacks components."
  - id: D-05-04
    title: "Keep RigidBody initialisation props on the JSX element"
    rationale: "First-paint values still need the props; the useEffect only handles post-mount synchronisation. Removing them would break initial render."

metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 4
  commits: 3
  files_created: 2
  files_modified: 1
  tests_added: 12  # 6 unit + 6 smoke
---

# Phase 5 Plan 01: 运行时属性同步 Summary

One-liner: 在 EntityRenderer.tsx 中添加单一 useEffect，挂载后通过 Rapier imperative API（setAdditionalMass、setLinearDamping、collider(0).setRestitution、collider(0).setFriction）同步 PropertyPanel 编辑到底层物理引擎，关闭 Phase 2 SC-3 已知债务。

## Implementation Summary

### 1. EntityRenderer.tsx 修改（36 行新增）

在第 51-89 行新增 useEffect 块（位于 transform/rigidBody/collider/material 提取之后、early-return null 检查**之前**，以满足 React Rules of Hooks）：

- **依赖数组**: `[rigidBody?.mass, rigidBody?.restitution, rigidBody?.friction, restitutionScale, frictionScale, drag]`
- **调用**:
  - `rb.setAdditionalMass(rigidBody.mass, true)` — 唤醒休眠物体
  - `rb.setLinearDamping(drag)`
  - `rb.setAngularDamping(drag * 0.5)` — 运行时特性检测后才调用（部分版本类型未导出）
  - `rb.collider(0).setRestitution(Math.min(restitution * restitutionScale, 1.0))`
  - `rb.collider(0).setFriction(Math.min(friction * frictionScale, 2.0))`

保留：第 167-173 行 RigidBody JSX props（mass/restitution/friction/linearDamping/angularDamping）保持不变，作为首次挂载初始值。

### 2. Unit Tests（runtime-prop-sync.test.tsx, 6 cases）

| Test | 行为                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| A    | 初次挂载触发所有 4 个 setter (setAdditionalMass / setLinearDamping / setRestitution / setFriction) |
| B    | restitution 0.5 → 0.95 重新触发 setRestitution，最后参数 ≈ Math.min(0.95 * 1.0, 1.0)        |
| C    | mass 1 → 5 触发 setAdditionalMass(5, true) — 第二参数 wakeUp 显式断言                  |
| D    | friction 0.5 → 0.1 触发 setFriction(0.1)                                            |
| E    | environment.drag 0.1 → 0.5 触发 setLinearDamping(0.5)（通过 mockEnv 切换 + rerender） |
| F    | ref.current 为 null（mock 不附加 ref）useEffect 不抛错且无 setter 被调用              |

Mock 表面: `@react-three/rapier`（RigidBody 同步附加 spy 对象到 ref）、`@react-three/drei` Outlines（no-op）、`useSimulationStore` selector（受控 environment）、`RigidBodyRefContext`（no-op）、`contactForceStore`（no-op）。

### 3. Smoke Tests（runtime-prop-sync-smoke.test.ts, 6 assertions）

源代码静态正则 grep gate，运行 < 10ms，过滤注释行后断言：

1. 调用了 `.setAdditionalMass(`
2. 调用了 collider(0) 链上的 setRestitution（接受 inline 链或 `const col = ...; col.setRestitution(...)` 重构形式）
3. 同上 setFriction
4. 调用了 `.setLinearDamping(`
5. 关键 token 全部出现：rigidBody.mass / rigidBody.restitution / rigidBody.friction / restitutionScale / frictionScale
6. 保留了首次挂载 props (`mass={rigidBody.mass}` 与 `restitution={Math.min(rigidBody.restitution...`)

这是回归保险：未来任何重构若意外移除该 useEffect 同步块，将立刻 fail 该 gate。

## Why setAdditionalMass instead of setMassProperties?

D-05-01: `setAdditionalMass(mass, wakeUp)` 是 Rapier 推荐的最小侵入路径——无需手工计算/传递 inertia tensor、center of mass、angular inertia local frame 等参数。`setMassProperties` 适用于需要精细控制刚体惯性张量的高级场景，对于"用户在 UI 滑块上调整 mass"这类粗粒度编辑而言过度复杂，且容易因参数错误导致仿真不稳定。

## Why restitution / friction through collider?

D-05-02: 在 Rapier3D 中，restitution（弹性系数）和 friction（摩擦系数）物理上是 **Collider** 的属性，不是 RigidBody 的属性。验证：
- `frontend/node_modules/@dimforge/rapier3d-compat/geometry/collider.d.ts:143,151` 暴露 `setRestitution` / `setFriction`
- `frontend/node_modules/@dimforge/rapier3d-compat/dynamics/rigid_body.d.ts` 没有这两个 setter

直接调用 `rb.setRestitution` 在类型层面不存在。因此必须通过 `rb.collider(0)` 路由。numColliders() 守卫处理理论边界（实体无 collider，虽 EntityRenderer 渲染前已守卫）。

## Test Coverage

- **Unit tests added**: 6 (A–F)
- **Smoke assertions added**: 6
- **Total new tests**: 12
- **Regression**: 21 个 Phase 1-4 测试套件全部通过；唯一失败 (Scene3D.test.tsx, 9 个 case) 为 baseline tech debt（three.js Vector3 mock 缺失），与本期改动无关，确认无回归

测试结果对比：

| 指标       | Baseline      | 本期完成后       | Delta |
| ---------- | ------------- | ---------------- | ----- |
| Test files | 20 passed / 1 failed | 22 passed / 1 failed | +2 passed |
| Tests      | 173 passed / 9 failed | 185 passed / 9 failed | +12 passed |

## Mock Difficulties Encountered & Resolution

**难点 1**: 初版试图用 `(React as any).createElement = ...` patch 拦截 R3F intrinsic JSX 元素（`<mesh>` / `<sphereGeometry>` 等）。React 19 将 `React.createElement` 设为非可写属性，patch 抛出 `TypeError: Cannot redefine property: createElement`。

**解决**: 移除 patch；在 JSDOM 下 React 会把未识别的 intrinsic 元素当成自定义 HTML 元素渲染（仅产生 console warning，不阻塞测试）。改为静默 console.error 中的 React casing/prop warnings 以保持输出整洁。useEffect 行为不受影响。

**难点 2**: 计划骨架使用 `vi.mock('../store', ...)` selector pattern 中 `mockEnv` 需要在 rerender 时切换。Zustand 在真实代码中通过订阅推动重渲染；mock 下需要显式 rerender。Test E 通过先改 `mockEnv` 再 rerender 同一 entity，让 selector 取到新值，触发 useEffect 的 drag 依赖变化。

## Lint Suppressions

无。React 项目未配置 `eslint.config.js`（升到 ESLint 9 后未迁移，属 baseline 状态），故未跑 lint。useEffect 依赖数组**完整且最小化**（6 个真实参与 setter 的字段，全部声明），不需要 `// eslint-disable-next-line react-hooks/exhaustive-deps`。

## Deviations from Plan

### Auto-fixed: useEffect placement re Rules of Hooks (Rule 1 — Bug)

**计划骨架建议**: "在现有 register/unregister useEffect 之后（第 37 行后）、`<RigidBody>` 返回 JSX 之前添加新 useEffect" — 字面理解会把它放在 `if (!transform || !rigidBody ...) return null` 早退之后。

**问题**: 早退之后再调用 `useEffect` 会违反 React Rules of Hooks（条件分支中的 hook），React 19 严格模式会立刻抛错。

**修复**: 将 useEffect 放在早退检查**之前**，依赖数组改用可选链 `rigidBody?.mass / rigidBody?.restitution / rigidBody?.friction`，并在 useEffect 内部加 `if (!rigidBody) return` 守卫。无功能影响（缺组件场景早退分支不变），合规性恢复。

文件: `frontend/src/components/EntityRenderer.tsx:51-89`
计划锚点: `<action>` 块 "于现有的 register/unregister useEffect 之后（第 37 行后）、`<RigidBody>` 返回 JSX 之前"

### Auto-fixed: Smoke test regex too strict (Rule 1 — Bug)

**计划骨架**: 直接断言 `\.collider\s*\(\s*0\s*\)\s*\.setRestitution`（要求 inline 链）。

**问题**: 实际 Task 1 实现采用了局部变量重构 `const col = rb.collider(0); col.setRestitution(...)` 以提高可读性，inline 正则不匹配，2 个 smoke 测试 fail。

**修复**: 将断言改为 OR 形式，同时接受 inline 链与"先取局部变量后调用"两种模式（`/\.collider\s*\(\s*0\s*\)[\s\S]{0,400}?\.setFriction\s*\(/`）。语义不变（仍要求两次方法都被调用），对未来同等性重构更稳健。

文件: `frontend/src/__tests__/physics/runtime-prop-sync-smoke.test.ts:30-44`

## TypeScript Compliance

`npx tsc --noEmit` 输出为空（0 错误）— 既无新增错误也无 baseline 残余。所有新代码与 Rapier3D 类型签名 (`setAdditionalMass(mass: number, wakeUp: boolean)`、`Collider.setRestitution(n: number)` 等) 完全对齐。

## Recommended Manual UAT Steps

由 verifier 在 phase 完成后执行（不在本 plan 内）：

1. **SC-2: 暂停态修改弹性**
   - 启动 dev 服务器 (`pnpm dev` 或 `npm run dev`)
   - 暂停模拟（默认状态）
   - 创建一颗球（CreationDialog → sphere）
   - 在 PropertyPanel 编辑 restitution: 0.5 → 0.95
   - 点击播放
   - 期望：球落地后反弹高度明显高于默认 0.5 时的反弹

2. **SC-3: 运行态修改摩擦**
   - 创建一个长方体作为地面（fixed kind, friction=1.0）
   - 创建一个球（dynamic, friction=1.0）从斜面滚下
   - 运行模拟
   - 选中球，PropertyPanel 编辑 friction: 1.0 → 0.05
   - 期望：球减速明显减弱（摩擦立即生效）

3. **可选: 运行态修改 mass**
   - 已创建弹簧约束的两端体
   - 编辑其中一端 mass 1 → 10
   - 期望：振荡频率/幅度反映新质量分布

4. **可选: 环境倍率**
   - 编辑 environment.frictionScale 1.0 → 0.1（在 EnvironmentPanel）
   - 期望：所有动态物体减速立刻减弱（一次环境改动同步所有 collider）

## Self-Check: PASSED

- ✅ EntityRenderer.tsx exists; new useEffect with deps `[rigidBody?.mass, rigidBody?.restitution, rigidBody?.friction, restitutionScale, frictionScale, drag]` present at line 56-89
- ✅ Calls `setAdditionalMass`, `setLinearDamping`, `collider(0).setRestitution`, `collider(0).setFriction`
- ✅ runtime-prop-sync.test.tsx exists (272 lines, 6 tests A-F passing)
- ✅ runtime-prop-sync-smoke.test.ts exists (65 lines, 6 assertions passing)
- ✅ Commit f186d06 — Task 1 (feat)
- ✅ Commit 7bf6c44 — Task 2 (test)
- ✅ Commit 7c04eec — Task 3 (test)
- ✅ `npx tsc --noEmit` clean (0 errors)
- ✅ `npx vitest run` 22/23 files passed (1 baseline-failing Scene3D.test.tsx pre-existing); 185 passing tests (+12 new) vs 173 baseline
- ✅ No regressions in Phase 1-4 tests
