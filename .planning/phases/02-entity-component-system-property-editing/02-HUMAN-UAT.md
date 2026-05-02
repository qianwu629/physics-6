---
status: partial
phase: 02-entity-component-system-property-editing
source: [02-VERIFICATION.md]
started: 2026-05-02T01:03:00Z
updated: 2026-05-02T08:30:46Z
gap_closure: 02-07
gaps_resolved: 2
gaps_remaining: 1
---

## Current Test

[testing complete — gap closure 02-07 executed]

## Tests

### 1. 属性编辑即时生效 (SC-3)
expected: 暂停→编辑弹性/摩擦/质量→恢复播放→实体行为反映参数变更
result: pending
note: "Rapier 运行时 API (rigidBodyRef.current.set*()) 未实现，ECS 数据模型更新链路完整但物理引擎层未同步。需要后续专门计划处理。"
severity: major

### 2. UI 布局和 z-index (含面板关闭)
expected: 工具箱(左)、属性面板(右)、工具栏(顶部)、3D 画布正确分层，面板可通过 X 按钮关闭/重新打开
result: pass
fixed_by: "02-07: uiSlice 新增 propertyPanelCollapsed + togglePropertyPanel；App.tsx 条件渲染面板 + 重新打开按钮；PropertyPanel X 按钮同时取消选中并折叠面板"
severity: null

### 3. 完整创建流程 (含初始位置)
expected: 点击工具箱按钮→弹出创建对话框→配置参数（含初始位置 X/Y/Z）→确认→实体出现在指定 3D 坐标位置并受物理引擎控制
result: pass
fixed_by: "02-07: creationSchema 新增 positionX/Y/Z 字段（默认 0/5/0）；创建对话框渲染初始位置 section；handleConfirm 将 position 元组传递至全部 4 个工厂函数"
severity: null

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "暂停模拟→在属性面板中编辑实体的弹性/摩擦/质量参数→恢复播放→实体行为反映参数变更"
  status: resolved
  reason: "User reported: 没有做设置初始位置的功能"
  severity: major
  test: 1
  resolved_by: "02-07: CreationDialog 添加 positionX/Y/Z 输入字段，Zod schema 扩展，handleConfirm 将 position 元组传递给所有工厂函数"
  root_cause: "CreationDialog.tsx 缺少初始位置 (x/y/z) 输入字段。Zod schema 没有 position 字段，工厂调用从未传递 position 参数——所有实体都用默认位置 [0,5,0] 创建。PropertyPanel 已有完整位置编辑功能，问题仅限于创建流程。"
  artifacts:
    - path: "frontend/src/components/CreationDialog.tsx"
      issue: "creationSchema 缺少 positionX/positionY/positionZ 字段，表单未渲染位置输入框，handleConfirm 中工厂调用未传 position 参数"
    - path: "frontend/src/ecs/Entity.ts"
      issue: "工厂函数已支持可选 position 参数，无需更改"
  debug_session: ".planning/debug/transform-position-missing.md"
- truth: "工具箱(左)、属性面板(右)、工具栏(顶部)、3D 画布正确分层，无遮挡"
  status: resolved
  reason: "User reported: 右侧实体属性无法关闭"
  severity: major
  test: 2
  resolved_by: "02-07: uiSlice 新增 propertyPanelCollapsed + togglePropertyPanel；App.tsx 条件渲染；PropertyPanel X 按钮调用 togglePropertyPanel()"
  root_cause: "PropertyPanel 在 App.tsx 中被无条件渲染（<PropertyPanel />），且 uiSlice 缺少 propertyPanelCollapsed 状态。X 按钮仅调用 selectEntity(null) 取消选中，不隐藏面板。左侧 Toolbox 已有 toolboxCollapsed/toggleToolbox 模式可供复用。"
  artifacts:
    - path: "frontend/src/components/PropertyPanel.tsx"
      issue: "X 按钮 onClick 仅执行 selectEntity(null)，未切换面板可见性"
    - path: "frontend/src/store/uiSlice.ts"
      issue: "缺少 propertyPanelCollapsed 状态和 togglePropertyPanel action"
    - path: "frontend/src/components/App.tsx"
      issue: "PropertyPanel 无条件渲染，需根据折叠状态条件渲染"
  debug_session: ".planning/debug/property-panel-cant-close.md"
- truth: "实体属性修改即时生效——暂停编辑后恢复播放，Rapier 物理运行时反映参数变更"
  status: failed
  reason: "rigidBodyRef 已声明但整个 src/ 中无 rigidBodyRef.current.set*() 调用"
  severity: major
  test: 1 (SC-3)
  root_cause: "@react-three/rapier RigidBody 将 position/restitution/friction/mass 视为仅初始化值，挂载后 React prop 变更可能不生效。ECS 数据模型更新链路完整，但物理引擎运行时层未同步。需要 useEffect + rigidBodyRef.current.set*() 或实体销毁-重建策略。"
  artifacts:
    - path: "frontend/src/components/EntityRenderer.tsx"
      issue: "rigidBodyRef 已声明（line 26）但无任何 rigidBodyRef.current.set*() 调用，也无 useEffect 监听组件变更"
  missing:
    - "添加 useEffect 监听 RigidBody/Collider 组件字段变更"
    - "调用 rigidBodyRef.current.setRestitution() / setFriction() / setMass() 等 Rapier API"
    - "或在暂停期间销毁-重建 RigidBody 以应用参数变更"
  debug_session: ""
