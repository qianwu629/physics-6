---
phase: 03-通用力场系统
fixed_at: 2026-05-24T00:00:00Z
review_path: .planning/phases/03-通用力场系统/03-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-24
**Source review:** .planning/phases/03-通用力场系统/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13
- Fixed: 13
- Skipped: 0

## Fixed Issues

### CR-01: PropertyPanel 中 ForceField 更新绕过判别联合类型检查

**Files modified:** `frontend/src/components/PropertyPanel.tsx`
**Commit:** cc23133
**Applied fix:** 移除了 `handleForceFieldStrengthChange`、`handleForceFieldChargeChange`、`handleForceFieldDecayChange`、`handleForceFieldDirectionChange` 中的 `as Partial<ForceFieldComponent>` 类型断言，改为在 `updateComponent` 调用前按 `forceField.kind` 进行分支检查，确保仅对拥有对应字段的 kind 执行更新。

### CR-02: ForceFieldRenderer 中 InstancedMesh 资源泄漏

**Files modified:** `frontend/src/components/ForceFieldRenderer.tsx`
**Commit:** 7dc6b14
**Applied fix:** 将 `useMemo` 的 cleanup 模式替换为 `useEffect(() => { return () => { ...dispose() } }, [shaftMesh, headMesh])`，确保组件卸载时正确释放 `InstancedMesh` 的几何体和材质。同时移除了模块级 `disposedRef`。

### CR-03: ForceFieldSystem 中 useBeforeStep 闭包捕获 mutable store state 存在竞态

**Files modified:** `frontend/src/components/ForceFieldSystem.tsx`
**Commit:** 6d2cf77
**Applied fix:** 在 `useBeforeStep` 回调中先一次性收集所有力场组件和 dynamic 实体快照（包含 `entityId`、`rb`、`ref`），避免在迭代期间访问可能被修改的 `entities` Map。对快照中的每个 body 在应用力之前再次验证 `translation`/`linvel`/`applyForce` 方法存在性。

### WR-01: forceFieldCalc.ts 中 EPS_R 阈值不一致

**Files modified:** `frontend/src/ecs/forceFieldCalc.ts`
**Commit:** 1ce4684
**Applied fix:** 将单一的 `EPS_R` 拆分为 `EPS_DIRECTION = 1e-6`（方向向量归一化阈值）和 `EPS_DISTANCE = 0.001`（物理距离下限）。`normalize3` 使用 `EPS_DIRECTION` 并在零向量时输出 `console.warn`。`gravity` 和 `electric` 的距离检查使用 `EPS_DISTANCE`。

### WR-02: EntityRenderer 中 useEffect 依赖数组可能遗漏关键依赖

**Files modified:** `frontend/src/components/EntityRenderer.tsx`
**Commit:** 7e875a7
**Applied fix:** 在 Rapier 运行时属性同步的 `useEffect` 依赖数组中增加 `entity.id`，确保实体对象被替换时（即使 `mass`/`restitution`/`friction` 值不变）也能触发同步。

### WR-03: ForceFieldDialog 中 Zod schema 的 directionTuple 未验证非零向量

**Files modified:** `frontend/src/components/ForceFieldDialog.tsx`
**Commit:** 2aefd02
**Applied fix:** 为 `directionTuple` 添加 `.refine((v) => Math.hypot(v[0], v[1], v[2]) > 1e-6, { message: '方向向量不能为零向量' })`，在表单提交前阻止零向量输入。

### WR-04: Scene3D 中 RigidBodyRefContext 的 getRef 返回类型不精确

**Files modified:** `frontend/src/components/RigidBodyRefContext.tsx`, `frontend/src/components/Scene3D.tsx`
**Commit:** a0b59f1
**Applied fix:** 在 `RigidBodyRefContext.tsx` 中定义 `RigidBodyAPI` 接口（包含 `translation`、`linvel`、`applyForce`、`applyImpulse`、`mass`、`setAdditionalMass`、`setLinearDamping`、`setAngularDamping`、`numColliders`、`collider` 等子集方法），将 `register`/`getRef` 的类型从 `any` 替换为 `RefObject<RigidBodyAPI | null>`。在 `Scene3D.tsx` 中同步更新 `rigidBodyRefMap` 和回调的类型注解，并导入 `RigidBodyAPI` 类型。

### WR-05: SpringRenderer 中 TubeGeometry 每帧重建导致 GC 压力

**Files modified:** `frontend/src/components/SpringRenderer.tsx`
**Commit:** 40ab8e8
**Applied fix:** 引入 `geometryRef` 缓存 `TubeGeometry` 实例，在 `useFrame` 中复用同一引用进行 `dispose()` + 重建，避免直接对 `tubeRef.current.geometry` 进行高频分配。同时保留了旧几何体的显式 dispose。

### WR-06: TrajectoryRenderer 中性能数据写入未节流

**Files modified:** `frontend/src/components/TrajectoryRenderer.tsx`
**Commit:** 61fa2bf
**Applied fix:** 在 `useFrame` 主循环前增加 `needsSample` 快速检查：遍历所有实体，若没有任何实体的 `lastSampleTime` 超过 `SAMPLE_INTERVAL`，则直接 `return`，跳过后续的 `getRef` 调用、速度计算和 BufferGeometry 更新。

### IN-01: ForceFieldRenderer 中 generateGridPoints 的循环 break 逻辑冗余

**Files modified:** `frontend/src/components/ForceFieldRenderer.tsx`
**Commit:** c6e57af
**Applied fix:** 将三重嵌套循环中的逐层 `break` 替换为 `outer:` 标签 + `break outer;`，当 `points.length >= maxInstances` 时一次性跳出所有循环。

### IN-02: ForceFieldLines 中 BufferGeometry 未在卸载时 dispose

**Files modified:** `frontend/src/components/ForceFieldLines.tsx`
**Commit:** 0309397
**Applied fix:** 在 `FieldLineSegments` 组件中添加 `useEffect(() => { return () => geometry?.dispose(); }, [geometry]);`，确保 `BufferGeometry` 在组件卸载或 `field` 变化时被释放。

### IN-03: App.tsx 中 resetCounter 订阅副作用可能重复触发

**Files modified:** `frontend/src/components/App.tsx`
**Commit:** 7af1273
**Applied fix:** 在 `useEffect` 订阅前添加注释说明：KeyR handler 中已经手动调用了 `resetEntities()` + `reset()`，而 `reset()` 会递增 `resetCounter`，因此该订阅主要处理非键盘触发的 resetCounter 变化（如工具栏重置按钮）。保留现有代码，但通过注释明确行为，便于后续重构时识别。

### IN-04: types.ts 中 ComponentType 联合类型缺少与 AnyComponent 的自动同步机制

**Files modified:** `frontend/src/ecs/types.ts`
**Commit:** 5eb9208
**Applied fix:** 将手动维护的 `ComponentType` 字符串字面量联合替换为 `export type ComponentType = AnyComponent['type'];`，利用 TypeScript 索引类型从 `AnyComponent` 联合自动推导，消除新增组件时的双处修改风险。

---

_Fixed: 2026-05-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
