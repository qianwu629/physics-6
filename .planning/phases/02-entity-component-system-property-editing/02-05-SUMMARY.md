---
phase: 02-entity-component-system-property-editing
plan: 05
subsystem: ui
tags: [react, zustand, shadcn, radix, lucide-react, ecs, rapier]

# Dependency graph
requires:
  - phase: 02-entity-component-system-property-editing
    plan: 02
    provides: "entitySlice (entities, selectedEntityId, updateComponent, removeEntity), uiSlice (deleteDialogOpen), ECS types"
  - phase: 01-simulation-core-3d-render
    provides: "simulationSlice (isRunning), shadcn/ui components (dialog, slider, input, label, button, scroll-area, separator, badge)"
provides:
  - "PropertyPanel: right-side glassmorphic panel with editable/readonly physics parameter fields"
  - "EntityList: scrollable entity selection list with shape icons, color dots, and ARIA accessibility"
  - "PhysicsField: reusable editable/readonly field component (Slider+Input vs text-only)"
  - "Vector3Field: reusable 3-axis editable/readonly field component"
  - "Delete confirmation dialog with entity name warning and keyboard shortcut (Delete/Backspace)"
affects:
  - phase: 02 (any future plan integrating with PropertyPanel)
  - phase: 03 (entity selection and editing is prerequisite for scene manipulation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: Editable/Readonly switch — PhysicsField/Vector3Field renders Slider+Input when paused, text-only when running per D-09"
    - "Pattern: useShallow for entity list extraction — prevents unnecessary re-renders when entities Map is updated"
    - "Pattern: Keyboard shortcut for delete — useEffect with keydown listener, guarded against input/textarea focus"

key-files:
  created:
    - frontend/src/components/EntityList.tsx
    - frontend/src/components/PropertyPanel.tsx
  modified: []

key-decisions:
  - "Used 'zustand/shallow' import path (Zustand v5.x standard) instead of plan's 'zustand/react/shallow' — matches installed package API"
  - "Panel close button (X) deselects entity via selectEntity(null) — returns panel to hint text state"
  - "Delete/Backspace keyboard shortcut disabled when focus is in input/textarea elements to prevent accidental deletions"

patterns-established:
  - "Pattern 4 (from RESEARCH.md): Read-only vs Editable switch via isRunning toggle, implemented as PhysicsField component"
  - "Pitfall 5 mitigation: ECS component updates during pause are source of truth; Rapier runtime API via ref deferred to follow-up plan for instant runtime edits"

requirements-completed: [REN-03]

# Metrics
duration: ~20min
completed: 2026-05-01
---

# Phase 2 Plan 5: Property Panel and Entity List Summary

**Right-side glassmorphic property panel with editable/readonly physics fields (Slider+Input), scrollable entity selection list (ARIA-accessible), and delete confirmation dialog (keyboard shortcut)**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-01T16:25:00Z
- **Completed:** 2026-05-01T16:47:54Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments

- EntityList component with ScrollArea (max 120px), 40px items, shape icons (Circle/Square/Database), color dots, ARIA roles, empty state "暂无实体", selected highlight (left border #3b82f6, bg rgba(59,130,246,0.1))
- PropertyPanel positioned at right:16px top:80px bottom:16px, width 280px, glassmorphic (rgba(26,26,26,0.85) + blur(8px) + white border), z-index 40
- Editable mode when paused: Slider+Number Input combos for mass/restitution/friction, Vector3Field inputs for position/velocity, color swatches clickable — status badge shows green dot "可编辑"
- Read-only mode when running: text-only values displayed, entity list remains clickable for selection — status badge shows gray dot "只读 — 暂停后可编辑"
- All physics params editable per D-10: position[x,y,z], shape-specific size, mass (0.1-100kg), restitution (0-1), friction (0-1), velocity[x,y,z], color (7 swatches)
- Delete confirmation dialog with entity name in warning text "确定要删除「{name}」吗？此操作不可撤销。", Delete/Backspace keyboard shortcut
- Hint text "点击场景中的实体或从上方列表选择以编辑属性" when no entity selected
- All labels in Simplified Chinese per COPYWRITING contract

## Task Commits

Each task was committed atomically:

1. **Task 1: EntityList — Scrollable Entity Selection List** - `716ac26` (feat)
2. **Task 2: PropertyPanel — Right Panel with Editable/Readonly Fields + Delete** - `c1e871d` (feat)

## Files Created/Modified

- `frontend/src/components/EntityList.tsx` - Scrollable entity list with shape icon + color dot + name, ARIA accessibility, click-to-select, empty state
- `frontend/src/components/PropertyPanel.tsx` - Right-side glassmorphic panel with PhysicsField/Vector3Field components, editable/readonly toggle via isRunning, delete dialog, all physics params editable

## Decisions Made

- Used `'zustand/shallow'` import path (Zustand v5.x standard documented path) instead of plan's `'zustand/react/shallow'` — both paths work but `zustand/shallow` is the primary export in v5.0+
- Panel close button (X) deselects entity via `selectEntity(null)` — returns panel to hint text state rather than hiding the panel
- Delete/Backspace keyboard shortcut guarded against input/textarea focus to prevent accidental deletions during text entry

## Deviations from Plan

### Planned Adjustments

**1. Zustand useShallow import path adjusted for v5.x compatibility**
- **Found during:** Task 1 (EntityList implementation)
- **Issue:** Plan specified `from 'zustand/react/shallow'` but Zustand v5.x primary export is `from 'zustand/shallow'`
- **Fix:** Used `'zustand/shallow'` which is the documented v5.x path; both paths resolve correctly but using the standard path prevents potential issues
- **Files modified:** `frontend/src/components/EntityList.tsx`, `frontend/src/components/PropertyPanel.tsx`

---

**Total deviations:** 1 (planned adjustment for library version compatibility)
**Impact on plan:** No functional impact — the corrected path is the documented Zustand v5 API. The plan's path also resolves but the standard path is preferred.

## Issues Encountered

None.

## Known Stubs

None — all UI states are wired to real store data. No hardcoded values, placeholders, or mock data flow to user-facing UI.

## Threat Flags

None — all new surfaces are documented in the plan's `<threat_model>`. Input bounds (min/max/step) enforced on all numeric fields per T-02-04 mitigation. Delete confirmation with entity name display uses factory-controlled names (no XSS risk per T-02-03).

## Next Phase Readiness

- PropertyPanel is ready for integration into the main App layout (needs to be rendered alongside Scene3D)
- Entity selection flow complete: 3D click (D-07 from Plan 04) sets selectedEntityId, PropertyPanel reads it
- Pitfall 5 (Rapier runtime property modification) flagged for follow-up plan — ECS updates during pause take effect on next play cycle; ref-based instant updates deferred

---
*Phase: 02-entity-component-system-property-editing*
*Completed: 2026-05-01*
