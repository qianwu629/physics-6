---
phase: 02-entity-component-system-property-editing
plan: 04
subsystem: entity-creation-ui
tags: [toolbox, creation-dialog, zod-validation, react-hook-form, glassmorphic, zh-CN]
requires: [02-02]
provides: [D-04-toolbox, D-05-creation-dialog]
affects: [App.tsx, entitySlice.ts, uiSlice.ts]
tech-stack:
  added: [zod, react-hook-form, @hookform/resolvers]
  patterns: [shadcn Dialog+Form+Slider, glassmorphic panels, ECS factory integration]
key-files:
  created:
    - frontend/src/components/Toolbox.tsx
    - frontend/src/components/CreationDialog.tsx
  modified:
    - frontend/src/components/App.tsx
    - frontend/src/store/entitySlice.ts
decisions:
  - "Toolbox uses native title attribute for tooltips (not shadcn Tooltip wrapper), per UI-SPEC Interaction States spec which says title suffices for hover tooltips"
  - "CreationDialog uses Controller from react-hook-form for Slider integration, as shadcn Slider does not support standard ref/onChange patterns"
  - "Zod schema uses .optional() for shape-specific size fields — only the fields relevant to the selected shape are validated"
  - "Shape selector resets ALL form values (including shape) via reset() when switching shapes, ensuring stale size values from previous shape are cleared"
metrics:
  duration: ~12 min
  completed_date: 2026-05-02
---

# Phase 02 Plan 04: 工具箱与创建对话框 Summary

**One-liner:** Left-side floating glassmorphic toolbox with shape palette + modal creation dialog with zod/rhf validation, creating ECS entities at (0,5,0) via factory functions.

## Tasks Executed

| # | Task | Type | Commit | Files |
|---|------|------|--------|-------|
| 1 | Toolbox — Left Floating Shape Palette | auto | 36f7e92 | frontend/src/components/Toolbox.tsx |
| 2 | CreationDialog — Modal Entity Creation Form | auto | f6f5e00 | frontend/src/components/CreationDialog.tsx |
| - | Integration + TS fixes (Rule 2) | devfix | 2940a80 | Toolbox.tsx, CreationDialog.tsx, App.tsx, entitySlice.ts |

## Verification Results

### Automated Checks

| Check | Result |
|-------|--------|
| TypeScript (tsc --noEmit) | PASS (0 errors in plan files) |
| Toolbox export + state wiring | PASS |
| CreationDialog zod schema + useForm + zodResolver | PASS |
| Chinese labels/errors (COPYWRITING contract) | PASS |
| Glassmorphic styling (rgba + backdrop-filter) | PASS |
| addEntity integration | PASS |
| Vite build | PASS (plan files only; pre-existing api.ts/test errors unrelated) |

### Threat Model Mitigations Verified

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-01 (DoS via bad params) | Zod schema: positive(), min(0).max(1), regex color validation | Implemented |
| T-02-02 (DoS via too many entities) | MAX_ENTITIES=50 enforced in entitySlice; inline error shown | Implemented |
| T-02-04 (Tampering inputs) | Slider min/max bounds + zod validation on color/restitution/mass | Implemented |

## Success Criteria Met

- [x] Toolbox renders at `left:16px, top:50%` with 4 shape buttons, collapsible
- [x] Click toolbox button → CreationDialog opens with pre-selected shape
- [x] CreationDialog form: shape selector, dynamic size inputs, mass/restitution/friction sliders, velocity inputs, color palette
- [x] Zod validation: negative radius rejected, mass<=0 rejected, restitution>1 rejected
- [x] Confirm creates entity via ECS factory + addEntity, entity spawns at (0,5,0)
- [x] MAX_ENTITIES=50 cap enforced — error shown if full
- [x] Escape/overlay/Cancel closes dialog cleanly
- [x] All user-facing text in Simplified Chinese per COPYWRITING contract
- [x] Glassmorphic panel style consistent with Toolbar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Toolbox and CreationDialog not mounted in App.tsx**
- **Found during:** Post-task verification (build)
- **Issue:** Components created but not rendered anywhere — would never appear in the UI
- **Fix:** Added Toolbox and CreationDialog imports and mount points in App.tsx render tree
- **Files modified:** frontend/src/components/App.tsx
- **Commit:** 2940a80

**2. [Rule 1 - Bug] TypeScript errors in plan files**
- **Found during:** Task 2 commit / TypeScript check
- **Issue:** (a) unused `cn` import in Toolbox.tsx, (b) unused `setValue` destructuring in CreationDialog, (c) unused `unit` parameter in renderNumberField, (d) handleSubmit type mismatch with react-hook-form v5, (e) unused `state` param in entitySlice resetEntities
- **Fix:** Removed unused imports/variables, renamed handleSubmit to rhfHandleSubmit, removed unused param, cleaned up entitySlice
- **Files modified:** Toolbox.tsx, CreationDialog.tsx, entitySlice.ts
- **Commit:** 2940a80

### Pre-existing Issues (Out of Scope)

- `frontend/src/store/api.ts`: Multiple TS errors (missing modules, unused imports) — this is an untracked file (`??` in git status), not introduced by this plan
- `frontend/src/store/__tests__/entitySlice.test.ts`: Type errors on `mass`/`restitution` properties — pre-existing test file, not modified by this plan

## Decided (Not Done)

- Toolbox uses native `title` attribute for tooltips rather than shadcn Tooltip wrapper — UI-SPEC explicitly states "title attribute achieves this without additional JS overhead"
- Slide handling uses `Controller` from react-hook-form (not `register`) because shadcn Slider's `onValueChange` callback pattern is incompatible with `register`'s ref-based approach

## Known Stubs

None — all components are fully wired to the store and ECS factory functions.

## Threat Flags

None — all threat surface is documented in the plan's threat model and all mitigations are implemented.

## Self-Check: PASSED

- [x] Toolbox.tsx exists at frontend/src/components/Toolbox.tsx
- [x] CreationDialog.tsx exists at frontend/src/components/CreationDialog.tsx
- [x] Commits verified: 36f7e92, f6f5e00, 2940a80
- [x] App.tsx imports and renders both new components
- [x] TypeScript 0 errors in plan files
