---
phase: 02-entity-component-system-property-editing
plan: 02
subsystem: store
tags: [zustand, entitySlice, uiSlice, ECS, immutable, unit-tests]
requires:
  - "02-01 (ECS types, Entity factory)"
provides:
  - "zustand entitySlice (entities Map + CRUD)"
  - "zustand uiSlice (toolbox/dialog state)"
  - "combined store (simulation + entity + ui)"
  - "entitySlice unit tests (9 tests)"
affects:
  - "所有 UI 面板 (Toolbox, CreationDialog, PropertyPanel)"
  - "Scene3D 实体渲染"
tech-stack:
  added:
    - zustand ^5.0.5 (existing, now used with Map state)
    - vitest ^4.1.5 (existing, 9 new store tests)
  patterns:
    - "Zustand Slice Pattern (StateCreator<Slice, [], [], Slice>)"
    - "Immutable Map updates via new Map() for reference change detection"
    - "Cross-slice state assignment (entitySlice sets objectCount on SimulationSlice)"
key-files:
  created:
    - frontend/src/ecs/types.ts
    - frontend/src/ecs/Entity.ts
    - frontend/src/store/entitySlice.ts
    - frontend/src/store/uiSlice.ts
    - frontend/src/store/__tests__/entitySlice.test.ts
  modified:
    - frontend/src/store/index.ts
decisions:
  - "addEntity returns boolean: false = rejected at MAX_ENTITIES; callers check return value"
  - "updateComponent uses { ...comp, ...data } partial update pattern — PropertyPanel sends individual field changes"
  - "objectCount derived from entities.size on every add/remove/reset — consistency guarantee"
  - "ECS types created as Rule 3 fix (plan 02-01 dependency not yet executed)"
metrics:
  duration: 7m50s
  completed_date: "2026-05-01T16:18:46Z"
---

# Phase 2 Plan 2: Zustand Store — Entity & UI Slices Summary

在 Zustand 中新增 entitySlice（实体 Map 集合 + CRUD）和 uiSlice（UI 面板状态），并在 index.ts 中与现有 simulationSlice 合并为统一 store。提供 Phase 2 所有交互的状态源。

## One-Liner

Zustand store with immutable Map-based entity CRUD (MAX_ENTITIES=50 guard) and UI state management for toolbox/dialog panels — 61 tests pass, zero TypeScript errors.

## Tasks Executed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Entity Slice: entities Map + CRUD + MAX_ENTITIES guard | `aecf6c1` | Complete |
| 2 | UI Slice + Store Integration | `42e7003` | Complete |
| 3 | Entity Slice Unit Tests (9 tests, TDD) | `0e3a900` | Complete |

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation (`npx tsc --noEmit`) | Zero errors |
| entitySlice test (`vitest run src/store/__tests__/entitySlice.test.ts`) | 9/9 passed |
| Full test suite (`vitest run`) | 61/61 passed (4 files) |
| No direct Map mutation (`grep state.entities.set\|delete`) | 0 matches |
| MAX_ENTITIES export (`grep "export const MAX_ENTITIES"`) | Found: 50 |
| createEntitySlice export | Confirmed |
| UI Slice exports (UiSlice, ShapeType, createUiSlice) | Confirmed |
| Store combination (SimulationSlice & EntitySlice & UiSlice) | Confirmed |

## Deviations from Plan

### Rule 3 — Blocking Issues Fixed

**1. [Rule 3 - Missing dependencies] Created ECS foundation types (ecs/types.ts, ecs/Entity.ts)**
- Found during: Execution start
- Issue: Plan 02-02 depends_on 02-01 (ECS types, Entity factory), but 02-01 had not been executed. Files `frontend/src/ecs/types.ts` and `frontend/src/ecs/Entity.ts` did not exist.
- Fix: Created minimal ECS types (Component interfaces, Entity, ComponentType union, Component union) and Entity factory functions (createSphereEntity, createBoxEntity, createCylinderEntity, createSlopeEntity, resetEntityCounter) as defined in the plan's interfaces section. Plan 02-01 will overwrite/augment when it executes.
- Files created: `frontend/src/ecs/types.ts`, `frontend/src/ecs/Entity.ts`

### Rule 1 — Bug Fixes

**2. [Rule 1 - Bug] Fixed entity ID collision in MAX_ENTITIES test**
- Found during: Task 3 (TDD RED phase)
- Issue: Plan's test code called `resetEntityCounter()` inside the MAX_ENTITIES fill loop, causing all 50 entities to have the same ID (`entity-1`). The Map only kept the last entity (size stayed at 1).
- Fix: Removed `resetEntityCounter()` from inside the loop. The `beforeEach` already calls it once per test.
- Files modified: `frontend/src/store/__tests__/entitySlice.test.ts`

**3. [Rule 1 - Bug] Fixed entity ID collision in selection-clearing test**
- Found during: Task 3 (TDD RED phase)
- Issue: Plan's test called `resetEntityCounter()` between creating e1 and e2, causing both to have the same ID. Removing e2 also removed the only entity, clearing selection for e1.
- Fix: Removed `resetEntityCounter()` call between entity creations.
- Files modified: `frontend/src/store/__tests__/entitySlice.test.ts`

### TDD Deviation

- The implementation (entitySlice.ts) was created in Task 1 before Task 3's TDD tests, per the plan's task ordering. This is a plan-level design choice, not an execution error. Tests were written against the existing implementation and all 9 pass.

## Threat Model Compliance

| Threat | Disposition | Implementation |
|--------|------------|----------------|
| T-02-02 (DoS via entity creation) | mitigate | `MAX_ENTITIES=50` hard cap in `addEntity`, returns `false` |
| T-02-03 (Entity name tampering) | accept | Entity names are controlled strings from factory functions; no user-supplied HTML |

No new threat surfaces introduced beyond plan's threat model.

## Known Stubs

None.

## Self-Check

- `frontend/src/store/entitySlice.ts` exists and has correct exports
- `frontend/src/store/uiSlice.ts` exists and has correct exports
- `frontend/src/store/index.ts` combines all 3 slices
- `frontend/src/store/__tests__/entitySlice.test.ts` exists, 9 tests pass
- `frontend/src/ecs/types.ts` and `frontend/src/ecs/Entity.ts` exist (Rule 3 fix)
- All commits verified in git log
- No modifications to shared orchestrator artifacts (STATE.md, ROADMAP.md)
