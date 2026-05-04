---
phase: 02-entity-component-system-property-editing
plan: 07
subsystem: UI / Entity Creation / Property Panel
tags: [creation-dialog, position-input, property-panel, ui-toggle, zod, zustand]
requires: [entitySlice, uiSlice, Entity factories]
provides: [position-param-creation, property-panel-collapse-toggle]
affects: [CreationDialog, PropertyPanel, App, uiSlice]
type: execute
gap_closure: true
tech-stack:
  added: []
  patterns: [ResizeObserver-polyfill-jsdom]
key-files:
  created:
    - frontend/src/__tests__/creation-position.test.tsx
    - frontend/src/store/__tests__/uiSlice.test.ts
  modified:
    - frontend/src/components/CreationDialog.tsx
    - frontend/src/store/uiSlice.ts
    - frontend/src/components/App.tsx
    - frontend/src/components/PropertyPanel.tsx
    - frontend/src/test/setup.ts
key-decisions: []
metrics:
  tasks: 2
  tests: 8
  files_changed: 7
  inserts: 301
  deletions: 3
---

# Phase 02 Plan 07: CreationDialog 初始位置 + 属性面板关闭/重新打开

修复 Phase 2 HUMAN-UAT 中诊断出的两个 major 缺陷：CreationDialog 缺少初始位置输入，属性面板无法关闭。

## One-Liner

在创建对话框中新增初始位置 X/Y/Z 输入区域并将位置参数传递至所有工厂函数；为属性面板添加折叠/展开切换机制，支持通过 X 按钮关闭和浮动 PanelRight 按钮重新打开。

## Task Summary

| Task | Name | Type | Status | Commit | Tests |
|------|------|------|--------|--------|-------|
| 1 | CreationDialog 添加初始位置输入 | auto (tdd) | complete | 7d506bc (RED), 96389b7 (GREEN) | 4 passed |
| 2 | 属性面板支持关闭/重新打开 | auto (tdd) | complete | d0d1ab6 (RED), b94368d (GREEN) | 4 passed |

## Commits

| Hash | Type | Message |
|------|------|---------|
| 7d506bc | test | test(02-07): add failing test for CreationDialog position fields |
| 96389b7 | feat | feat(02-07): add position fields to CreationDialog with factory position passing |
| d0d1ab6 | test | test(02-07): add failing tests for propertyPanelCollapsed in uiSlice |
| b94368d | feat | feat(02-07): add property panel close/reopen with toggle state |

## What Changed

### Gap 1: CreationDialog 初始位置输入

**Files:** `frontend/src/components/CreationDialog.tsx`

- **Zod Schema:** 新增 `positionX` (default 0), `positionY` (default 5), `positionZ` (default 0)
- **Default values:** `getDefaultFormValues` 添加所有形状统一的位置默认值 [0, 5, 0]
- **JSX form:** 在"初始速度"与"颜色"之间新增"初始位置" section，含 X/Y/Z 三个 number input（三列 grid 布局，复用 velocity section 模式）
- **handleConfirm:** 构造 `position: [number, number, number]` 元组，作为最后一个参数传递给 `createSphereEntity`, `createBoxEntity`, `createCylinderEntity`, `createSlopeEntity`

### Gap 2: 属性面板关闭/重新打开

**Files:** `uiSlice.ts`, `App.tsx`, `PropertyPanel.tsx`

- **uiSlice.ts:** 新增 `propertyPanelCollapsed: boolean` (默认 `false`) 和 `togglePropertyPanel: () => void` action
- **App.tsx:** 条件渲染 `{!propertyPanelCollapsed && <PropertyPanel />}`；折叠时显示浮动 PanelRight 图标按钮（右下角 right:16px, top:80px），点击调用 `togglePropertyPanel()`
- **PropertyPanel.tsx:** X 按钮 onClick 同时执行 `selectEntity(null)` 和 `togglePropertyPanel()`（面板关闭而非仅取消选中）

### 测试基础设施

- **frontend/src/test/setup.ts:** 添加 `ResizeObserver` polyfill（jsdom 缺失，Radix UI 组件需要）
- **creation-position.test.tsx:** 4 个测试（组件渲染默认值、工厂 position 参数、schema 默认值、schema 自定义值）
- **uiSlice.test.ts:** 4 个测试（默认值 false、单次切换、来回切换、多次切换）

## Verification

### Automated

```
npx vitest run src/__tests__/creation-position.test.tsx --reporter=verbose  # 4 passed
npx vitest run src/store/__tests__/uiSlice.test.ts --reporter=verbose       # 4 passed
npx tsc --noEmit                                                            # No errors
```

### Success Criteria

- [x] creationSchema 包含 positionX/positionY/positionZ 字段，默认值 [0, 5, 0]
- [x] 创建对话框渲染"初始位置"section，含 X/Y/Z 三个数字输入框
- [x] handleConfirm 将 position 元组传递给所有 4 个工厂函数
- [x] uiSlice 包含 propertyPanelCollapsed 状态（默认 false）和 togglePropertyPanel action
- [x] App.tsx 对 PropertyPanel 进行条件渲染（collapsed 时渲染 PanelRight 重新打开按钮）
- [x] PropertyPanel X 按钮同时调用 selectEntity(null) 和 togglePropertyPanel()
- [x] 所有 8 测试通过，TypeScript 编译无错误

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing test infrastructure] ResizeObserver polyfill for jsdom**
- **Found during:** Task 1 GREEN
- **Issue:** Component tests using Radix UI Dialog fail with `ReferenceError: ResizeObserver is not defined` in jsdom environment
- **Fix:** Added ResizeObserver stub polyfill to `frontend/src/test/setup.ts` (observe/unobserve/disconnect as no-ops)
- **Files modified:** `frontend/src/test/setup.ts`
- **Commit:** 96389b7

## Self-Check: PASSED

- [x] `frontend/src/__tests__/creation-position.test.tsx` exists
- [x] `frontend/src/store/__tests__/uiSlice.test.ts` exists
- [x] Commit 7d506bc exists (RED creation-position)
- [x] Commit 96389b7 exists (GREEN creation-position)
- [x] Commit d0d1ab6 exists (RED uiSlice)
- [x] Commit b94368d exists (GREEN uiSlice close/reopen)
