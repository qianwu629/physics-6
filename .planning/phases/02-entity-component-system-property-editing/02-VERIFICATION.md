---
phase: 02-entity-component-system-property-editing
verified: 2026-05-02T00:00:00Z
status: human_needed
score: 3/4 roadmap must-haves verified (1 UNCERTAIN)
overrides_applied: 0
re_verification: true
previous_status: human_needed
previous_score: 3/4
gaps_closed: []
gaps_remaining:
  - "SC-3: 实体属性修改即时生效 — RigidBody ref 声明但无 Rapier 运行时 API 调用（Pitfall 5 推迟项未关闭）"
regressions: []
human_verification:
  - test: "暂停状态下编辑实体属性，恢复播放后观察物理行为是否反映更新后的参数值"
    expected: "编辑的属性（质量、弹性系数、摩擦系数、位置、初速度）在恢复播放后应在实体物理行为中观察到"
    why_human: "Rapier 运行时参数修改（通过 rigidBodyRef.current.setRestitution() 等 API）已在 Plan 05 Pitfall 5 中明确推迟到后续阶段。ECS 数据模型更新链路完整（PropertyPanel → updateComponent → Zustand store → EntityRenderer re-render），但 @react-three/rapier 的 RigidBody 将 position/restitution/friction/mass 视为仅初始化值，挂载后通过 React props 变更可能不生效。代码扫描确认 rigidBodyRef 已声明（EntityRenderer.tsx:26）但整个 src/ 中无任何 rigidBodyRef.current.set*() 调用。需人工验证暂停编辑后恢复播放是否产生可观察的行为变化，或是否需要实体销毁-重建才能生效。"
  - test: "打开应用，确认工具箱（左侧）、属性面板（右侧）、工具栏（顶部）和 3D 画布均正确显示且 z-index 层级无遮挡"
    expected: "Toolbox 在左中位置（left:16px, top:50%），PropertyPanel 在右侧（right:16px, top:80px, bottom:16px），Toolbar 在顶部居中，Canvas 充满全屏。属性面板可通过 X 按钮折叠/展开。所有面板使用玻璃态样式。"
    why_human: "视觉布局和 z-index 层级正确性需要实际浏览器渲染验证，无法通过代码扫描确认"
  - test: "通过工具箱点击形状按钮 → 配置参数（尺寸、质量、弹性系数、摩擦系数、初速度、颜色）→ 确认添加，验证实体出现在场景中心 (0,5,0)"
    expected: "球体/方块/圆柱/斜面出现在场景中心位置，颜色与创建对话框中选择的一致，在重力下正确运动。工具栏物体计数正确递增。"
    why_human: "完整的 GUI 交互流程和 3D 渲染正确性需要运行时验证"
  - test: "在属性面板输入框中输入非法值（如负数半径），确认输入被限制在有效范围内"
    expected: "Slider 组件限制滑动范围，Input 组件的 min/max 属性阻止超出范围的值。"
    why_human: "HTML5 表单验证和组件行为需要运行时验证"
---

# Phase 2: 组件化实体系统与属性编辑 -- Re-Verification Report

**Phase Goal:** 用户可以通过 UI 控件自由添加实体到场景中，通过属性面板编辑其物理参数，系统底层采用组件化架构使得实体行为由其附加的组件集合决定
**Verified:** 2026-05-02
**Status:** human_needed
**Re-verification:** Yes -- after gap closure attempt (no changes to SC-3 gap)

## Re-Verification Summary

Previous verification (2026-05-01) found:
- **3/4 roadmap success criteria VERIFIED** (SC-1, SC-2, SC-4)
- **1 UNCERTAIN** (SC-3: 属性修改即时生效 -- Pitfall 5)
- **30/30 plan must-haves verified**
- **No code-level gaps**

Current re-verification confirms:
- All previously VERIFIED items remain VERIFIED -- no regressions detected
- SC-3 remains UNCERTAIN -- `rigidBodyRef` exists but zero `rigidBodyRef.current.set*()` calls in entire `src/` directory
- No new gaps or regressions introduced
- `propertyPanelCollapsed` + `togglePropertyPanel` added to uiSlice as enhancement beyond plan scope (correctly wired)

## Goal Achievement

### Roadmap Success Criteria (Re-verified)

| # | Truth | Previous | Current | Evidence |
|---|-------|----------|---------|----------|
| SC-1 | 用户可以通过 UI 控件向场景中添加新实体（球体、方块、平面/斜面），实体即时出现在 3D 视图中 | VERIFIED | VERIFIED | Toolbox.tsx (4 shape buttons + openDialog) → CreationDialog.tsx (zod验证表单 + ECS工厂调用 + addEntity, handleConfirm at line ~460) → entitySlice.ts (Map CRUD, MAX_ENTITIES=50) → Scene3D.tsx (entityEntries.map at line 141) → EntityRenderer.tsx (ECS→R3F+Rapier翻译器). 完整链路确认完整，所有文件 substantively 实现。 |
| SC-2 | 用户可以在场景中选择任意实体，通过属性面板编辑其物理属性 | VERIFIED | VERIFIED | EntityRenderer.tsx (mesh.onClick + stopPropagation at line 103 + Outlines高亮 at line 143-151) → entitySlice.selectEntity → PropertyPanel.tsx (PhysicsField/Vector3Field 可编辑/只读切换 at lines 62-108/123-177, 8个回调函数: handlePositionChange, handleVelocityChange, handleMassChange, handleRestitutionChange, handleFrictionChange, handleColliderParamChange, handleColorChange) → updateComponent 深层不可变更新. EntityList.tsx (点击selectEntity + ARIA可访问性) 提供替代选择路径 |
| SC-3 | 实体属性修改即时生效——实体在模拟中的行为反映更新后的参数值 | UNCERTAIN | UNCERTAIN | ECS 数据模型更新链路完整（PropertyPanel → updateComponent → Zustand → EntityRenderer re-render），但代码扫描确认: (1) rigidBodyRef 已声明于 EntityRenderer.tsx:26，(2) 整个 `frontend/src/` 中 **零处** `rigidBodyRef.current.set*()` 调用，(3) @react-three/rapier RigidBody 将 position/restitution/friction/mass 视为初始化 props，挂载后通过 React prop 变更可能不生效。Pitfall 5 明确推迟的 ref-based Rapier 运行时 API 调用未被任何后续计划关闭 |
| SC-4 | 系统架构采用基于组件的实体模型，实体行为由其附加的组件集合决定，而非由硬编码类型模板决定 | VERIFIED | VERIFIED | Entity 接口: `components: Map<ComponentType, Component>` (types.ts:61-65)；EntityRenderer 从 components Map 读取渲染 (line 29-33)，非硬编码 switch-type；createEntity() 接受任意 Component[] (Entity.ts)；Shape-specific 工厂仅预填充组件数组；Scene3D 通过 `entityEntries.map()` 渲染 (line 141)；hardcodedScene.ts 已删除 (确认不存在)；SceneObject 类型标记 @deprecated (types.ts:16-42) |

**Score:** 3/4 roadmap criteria verified, 1 remains UNCERTAIN (unchanged from previous)

### Plan Must-Have Truths -- Regression Check

All 30 plan must-have truths from previous verification were re-checked. Quick regression on the most critical:

| # | Truth (abbreviated) | Previous | Regression |
|---|---------------------|----------|------------|
| T-01 | 5 ECS Component interfaces | VERIFIED | PASS -- types.ts 74 lines, all interfaces present |
| T-02 | Entity factory with 5 creators | VERIFIED | PASS -- Entity.ts intact |
| T-04 | Immutable Map in Zustand store | VERIFIED | PASS -- 3x `new Map(state.entities)`, 0 direct mutations |
| T-05 | MAX_ENTITIES=50 hard cap | VERIFIED | PASS -- entitySlice.ts:43, addEntity returns boolean |
| T-09 | Scene3D ECS-driven, no hardcoded | VERIFIED | PASS -- `entityEntries.map()` at line 141, 0 `INITIAL_SCENE_OBJECTS` imports |
| T-10 | Click-to-select with Outlines | VERIFIED | PASS -- mesh onClick with stopPropagation, Outlines at line 143 |
| T-14 | Toolbox 4 shape buttons, collapsible | VERIFIED | PASS -- Toolbox.tsx:48-62, 4 SHAPES with icons |
| T-16 | CreationDialog zod validation | VERIFIED | PASS -- creationSchema at line 28, useForm+zodResolver |
| T-19 | PropertyPanel with editable fields | VERIFIED | PASS -- 608 lines, PhysicsField/Vector3Field, 8 handlers |
| T-20 | Editable/readonly toggle (D-09) | VERIFIED | PASS -- disabled=(isRunning) pattern, badge |
| T-26 | Keyboard shortcuts B/N/C/S | VERIFIED | PASS -- App.tsx:104-119 |
| T-29 | Reset clears entities + pauses | VERIFIED | PASS -- resetCounter subscription at App.tsx:138-147 |
| T-30 | hardcodedScene.ts deleted | VERIFIED | PASS -- file does not exist, 0 code imports |

**Plan must-haves regression: 30/30 still pass.** No regressions.

### Enhanced Feature (Beyond Plan)

The `propertyPanelCollapsed` state + `togglePropertyPanel()` action was added to `uiSlice.ts` (lines 22, 32, 42, 49), enabling the PropertyPanel to be collapsed to a small `<PanelRight>` icon button (App.tsx:183-205). This is a fully implemented, correctly wired enhancement that improves UX beyond the plan's original scope.

### Data-Flow Trace (Level 4) -- Re-verified

| Artifact | Data Variable | Source | Status |
|----------|---------------|--------|--------|
| Scene3D.tsx | `entityEntries` | `useSimulationStore(s => Array.from(s.entities.entries()))` | FLOWING |
| EntityRenderer.tsx | `entity.components` Map | Props from Scene3D entityEntries | FLOWING |
| Toolbox.tsx | `toolboxCollapsed` | `useSimulationStore(s => s.toolboxCollapsed)` | FLOWING |
| CreationDialog.tsx | `dialogOpen` | `useSimulationStore(s => s.dialogOpen)` | FLOWING |
| PropertyPanel.tsx | `selectedEntity` | `useSimulationStore(s => entities.get(selectedEntityId))` | FLOWING |
| EntityList.tsx | `entityList` | `useSimulationStore(s => Array.from(s.entities.values()).map(...))` | FLOWING |
| App.tsx | `resetCounter` | `useSimulationStore.subscribe()` | FLOWING |

### Key Link Verification -- Re-verified

All 16 critical links from previous verification remain WIRED. Top-line checks:

| Link | Pattern | Status |
|------|---------|--------|
| EntityRenderer.tsx → types.ts | `import type { TransformComponent, ... } from '../ecs/types'` | WIRED |
| Scene3D.tsx → entitySlice entities | `useShallow((s) => Array.from(s.entities.entries()))` | WIRED |
| Scene3D onPointerMissed → selectEntity(null) | `onPointerMissed={() => selectEntity(null)}` at line 153 | WIRED |
| Toolbox.tsx → uiSlice.openDialog | `onClick={() => openDialog(type)}` at line 54 | WIRED |
| CreationDialog.tsx → Entity.ts factory | `import { createSphereEntity, ... } from '../ecs/Entity'` | WIRED |
| CreationDialog.tsx → addEntity | `handleConfirm → factory → addEntity(entity)` | WIRED |
| PropertyPanel.tsx → updateComponent | 8 callback handlers all wired | WIRED |
| App.tsx → keyboard shortcuts | B/N/C/S/Delete/Backspace all wired | WIRED |
| App.tsx → resetEntities (cross-slice) | `subscribe → resetCounter > prev → resetEntities()` at line 141 | WIRED |

### Anti-Pattern Scan

| File | Finding | Classification |
|------|---------|---------------|
| EntityRenderer.tsx:38,66 | `return null` in defensive null check for missing components | LEGITIMATE (T-02-01 mitigation, not a stub) |
| EntityRenderer.tsx:26 | `rigidBodyRef` declared but no `.set*()` calls in entire codebase | WARNING (Pitfall 5 -- planned deferral, not a bug) |
| CreationDialog.tsx:296 | `placeholder={String(min)}` | LEGITIMATE (HTML input placeholder showing min value) |

**Zero stubs, zero placeholders, zero empty handlers.** All `return null` paths are legitimate defensive checks. The `rigidBodyRef` warning is the known SC-3 gap.

### Requirements Coverage

| Requirement | Description | Plans | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| DIF-01 | 组件化自由组合架构——用户组合基础物理原语搭建场景，而非使用预制模板 | 02-01, 02-02, 02-03, 02-04, 02-06 | SATISFIED | Entity.components: Map<ComponentType, Component>；EntityRenderer reads from Map；createEntity() accepts arbitrary Component[]；hardcodedScene deleted；SceneObject @deprecated |
| REN-03 | 用户可通过属性面板编辑物体的物理参数（质量、速度、位置、摩擦系数、弹性系数） | 02-02, 02-05 | SATISFIED | PropertyPanel: PhysicsField for mass/restitution/friction, Vector3Field for position/velocity, color swatches. All edit handlers wired to updateComponent. Editable/readonly toggle via isRunning |

**Note:** REQUIREMENTS.md still lists both DIF-01 and REN-03 as `[ ]` (Pending). The implementation is complete but the traceability file has not been updated. This should be updated when Phase 2 is accepted.

**Orphaned Requirements:** None. Both Phase 2 requirements (DIF-01, REN-03) are covered by plan `requirements:` fields.

### Behavioral Spot-Checks

Step 7b: SKIPPED -- Frontend dependencies require `npm install` in the correct environment. TypeScript compilation and test execution are downstream of dependency installation. All grep-based structural checks pass.

### Gaps Summary

**SC-3 (实体属性修改即时生效) remains the sole uncertainty.**

The data model update chain is complete and verified:

```
PropertyPanel → updateComponent → Zustand store (deep immutable) → EntityRenderer re-render (new props)
```

However, the Rapier physics runtime layer is not updated:

```
EntityRenderer re-render → React props on <RigidBody> → Rapier may ignore prop changes post-mount
```

**Code evidence confirming the gap:**
1. `rigidBodyRef` declared at EntityRenderer.tsx:26
2. `ref={rigidBodyRef}` attached to `<RigidBody>` at line 115
3. **Zero** occurrences of `rigidBodyRef.current.set*()` in entire `frontend/src/`
4. No `useEffect` watching component changes to trigger Rapier API

**Resolution path (not deferrable to Phase 3 or 4 -- neither addresses this):**

A dedicated follow-up plan should add Rapier runtime API calls to EntityRenderer:

```typescript
// In EntityRenderer, add useEffect to watch specific component fields:
useEffect(() => {
  if (rigidBodyRef.current) {
    rigidBodyRef.current.setRestitution(rigidBody.restitution);
    rigidBodyRef.current.setFriction(rigidBody.friction);
    // etc.
  }
}, [rigidBody.restitution, rigidBody.friction, ...]);
```

Or alternatively, force entity re-creation (destroy + re-create `<RigidBody>`) when component params change during pause. This would be simpler but visually jarring.

---

_Verified: 2026-05-02_
_Verifier: Claude (gsd-verifier -- re-verification mode)_
