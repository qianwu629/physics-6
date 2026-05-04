---
phase: 01-持久化与场景库
plan: "05"
subsystem: App Integration
tags: [integration, UI-wiring, camera-adaptive]
requires: [01-02, 01-03, 01-04]
provides:
  - "App.tsx rendering MenuBar + SnapshotManager Sheet + PresetSelector Dialog + SceneBanner"
  - "Scene3D CameraFitter auto-adaptive camera on entity bounding box"
affects:
  - frontend/src/components/App.tsx
  - frontend/src/components/Scene3D.tsx
  - frontend/src/components/Toolbar.tsx
tech-stack:
  added:
    - "@react-three/fiber useThree hook (CameraFitter)"
    - "three Box3 / Vector3 / PerspectiveCamera (bounding box computation)"
  patterns:
    - "Pure-logic R3F component (returns null, uses useThree side effects)"
    - "CSS injection for z-index / positioning adjustments between independently-developed components"
    - "DOM-ordering for z-index layering (MenuBar z-50 renders before Toolbar z-50)"
key-files:
  created: []
  modified:
    - frontend/src/components/App.tsx
    - frontend/src/components/Scene3D.tsx
    - frontend/src/components/Toolbar.tsx
key-decisions:
  - "Toolbar top offset via CSS injection ([data-toolbar]) rather than modifying Toolbar.tsx logic — respects Plan 05 files_modified boundary"
  - "Toolbar has data-toolbar attribute added for CSS targeting, but no behavioral/logic changes"
  - "CameraFitter skips auto-fit on initial mount (resetCounter === 0) to preserve default (12,10,12) camera angle"
  - "expandByScalar(1) prevents degenerate Box3 on single-point or collinear entity scenes"
  - "200ms setTimeout in CameraFitter lets Physics key-reconciliation complete before reading entity positions"
metrics:
  duration: "~20 min"
  completed-date: "2026-05-04T15:52:14Z"
  tasks: 2
  files: 3
---

# Phase 1 Plan 5: App 集成布线 Summary

将 Phase 1 所有新建组件 (MenuBar, SnapshotManager, PresetSelector, SceneBanner) 集成到 App.tsx 渲染树，并为 Scene3D 添加摄像机自适应功能。

**One-liner:** Wire MenuBar/SnapshotManager/PresetSelector/SceneBanner into App.tsx and add bounding-box camera auto-fit to Scene3D via CameraFitter component.

---

## Tasks Executed

### Task 1: 集成 MenuBar + SnapshotManager + PresetSelector + SceneBanner 到 App.tsx

**Status:** Complete
**Commit:** `52985ca`

**Changes:**
- Added 4 new imports: `MenuBar`, `SnapshotManager`, `PresetSelector`, `SceneBanner`
- Added 2 state variables: `snapshotDrawerOpen`, `presetSelectorOpen`
- MenuBar 渲染在页面最顶层 (z-50 fixed top-0), 提供 onOpenSnapshots/onOpenPresets 回调
- SnapshotManager 通过 Sheet (side="right") 渲染, 受 snapshotDrawerOpen 状态控制
- PresetSelector 通过 Dialog 渲染, 受 presetSelectorOpen 状态控制
- SceneBanner 渲染黄色警告横幅 (schema 版本不匹配等)
- 所有原有组件 (Scene3D, Toolbar, Toolbox, PropertyPanel, CreationDialog, EnvironmentPanel, SpringCreationBanner, SpringCreationDialog) 保持不变
- Toolbar 通过 CSS 注入 `[data-toolbar] { top: 44px !important }` 从原 top-4 (16px) 偏移至 44px, 为 36px MenuBar 腾出空间

**Verification:**
- All 4 imports confirmed via grep >= 1
- All 4 component JSX tags confirmed via grep >= 1
- snapshotDrawerOpen / presetSelectorOpen useState confirmed
- Original components (Scene3D, Toolbar, Toolbox) still present
- TypeScript compilation passed (no errors)

### Task 2: 增强 Scene3D — 摄像机自适应实体包围盒

**Status:** Complete
**Commit:** `6eb9a6b`

**Changes:**
- 新增 `CameraFitter` 纯逻辑组件 (returns null, 使用 useThree + useSimulationStore side effects)
- 监听 `resetCounter` 变化触发包围盒重新计算
- 从 `store.entities` Map 中提取所有 transform.position → 构建 Box3
- 空场景时摄像机回到默认视角 (12, 10, 12) + 目标点 (0, 2, 0)
- 有实体时计算包围盒中心 + 对角线方向摄像机距离 = `(maxDim / (2 * tan(fov/2))) * 1.5`
- `expandByScalar(1)` 防止单点/共线场景包围盒退化为零体积
- `ctrl.update()` 在修改 target/position 后调用 (Pitfall #3)
- 200ms setTimeout 保证 Physics key-reconciliation 完成后读取实体位置
- `controlsRef` 通过 ref prop 传入 `<OrbitControls>` 用于 imperative 控制

**Verification:**
- Box3 import and usage confirmed
- expandByPoint / getCenter / getSize confirmed
- controlsRef + controls.update confirmed
- resetCounter monitoring confirmed
- OrbitControls ref={controlsRef} confirmed
- CameraFitter returns null confirmed
- TypeScript compilation passed

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Only minor adaptation: added `data-toolbar=""` attribute to Toolbar.tsx's root div for CSS targeting, as the plan explicitly anticipated this need.

---

## Threat Flags

None. Plan threat model (T-05-01: accept, T-05-02: accept) covers all changes. No new network endpoints, auth paths, or data boundaries introduced.

---

## Known Stubs

None. All component integrations are fully functional — no placeholders, TODOs, or un-wired data sources.

---

## Self-Check

### File existence

- [x] `frontend/src/components/App.tsx` — modified (46 lines added)
- [x] `frontend/src/components/Scene3D.tsx` — modified (81 lines added)
- [x] `frontend/src/components/Toolbar.tsx` — modified (1 line added: `data-toolbar`)

### Commit existence

- [x] `52985ca` feat(01-持久化与场景库-05): integrate MenuBar + SnapshotManager + PresetSelector + SceneBanner into App.tsx
- [x] `6eb9a6b` feat(01-持久化与场景库-05): add CameraFitter for auto-adaptive camera on scene load

### TypeScript compilation

- [x] `npx tsc --noEmit` passed with no errors

## Self-Check: PASSED
