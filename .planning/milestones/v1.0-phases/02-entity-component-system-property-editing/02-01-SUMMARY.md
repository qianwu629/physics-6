---
phase: 02-entity-component-system-property-editing
plan: 01
subsystem: ECS Component Architecture + shadcn/ui Foundation
tags: [ecs, types, entity-factory, shadcn-ui, component-library, tdd]
requires: []
provides: [shadcn-components, ecs-types, ecs-entity-factory]
affects: [frontend/src/ecs/, frontend/src/components/ui/, frontend/src/index.css]
tech-stack:
  added: [react-hook-form, zod, @hookform/resolvers, tw-animate-css]
  patterns: [ECS Entity-Component data model, Entity factory with shape-specific creators, TDD RED-GREEN cycle]
key-files:
  created:
    - frontend/src/ecs/types.ts
    - frontend/src/ecs/Entity.ts
    - frontend/src/ecs/components/Transform.ts
    - frontend/src/ecs/components/RigidBody.ts
    - frontend/src/ecs/components/Collider.ts
    - frontend/src/ecs/components/Velocity.ts
    - frontend/src/ecs/components/Material.ts
    - frontend/src/ecs/__tests__/types.test.ts
    - frontend/src/ecs/__tests__/Entity.test.ts
    - frontend/components.json
    - frontend/src/components/ui/button.tsx
    - frontend/src/components/ui/dialog.tsx
    - frontend/src/components/ui/slider.tsx
    - frontend/src/components/ui/input.tsx
    - frontend/src/components/ui/label.tsx
    - frontend/src/components/ui/tooltip.tsx
    - frontend/src/components/ui/scroll-area.tsx
    - frontend/src/components/ui/separator.tsx
    - frontend/src/components/ui/badge.tsx
  modified:
    - frontend/tsconfig.json
    - frontend/src/index.css
    - frontend/src/lib/utils.ts
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - Shadcn v4 uses radix-nova preset (equivalent to New York style in v3); baseColor neutral preserved
  - Added compilerOptions.baseUrl and paths to root tsconfig.json for shadcn CLI import alias detection
  - Replaced `satisfies` keyword with `as` casts in Entity.ts for tsc -b build compatibility
  - Component files use both `import type` (for internal use) and `export type` (for re-export)
duration: 1244
completed: 2026-05-01
---

# Phase 2 Plan 1: ECS Component Architecture + shadcn/ui Foundation

**One-liner:** Established the ECS component type system (5 components + Entity factory) and the shadcn/ui component library (9 components + form deps) as the Phase 2 foundation.

## Tasks Summary

| Task | Name | Type | Status | Commit |
|------|------|------|--------|--------|
| 1 | shadcn/ui Init + Component Install + Form Dependencies | auto | PASS | 1e20aab |
| 2 | ECS Component Interfaces — 5 Component Type Definitions | auto (tdd) | PASS | f8e4fa0 (RED), db8b5eb (GREEN) |
| 3 | ECS Entity Manager + Factory Functions + Unit Tests | auto (tdd) | PASS | 768984f (RED), 50f5c1a (GREEN) |

## Verification Results

| Criterion | Status | Detail |
|-----------|--------|--------|
| shadcn/ui initialized | PASS | Radix+Nova preset, baseColor=neutral, cssVariables enabled |
| 9 shadcn components installed | PASS | button, dialog, slider, input, label, tooltip, scroll-area, separator, badge |
| Form dependencies installed | PASS | react-hook-form, zod, @hookform/resolvers in package.json |
| 5 ECS Component interfaces | PASS | Transform, RigidBody, Collider, Velocity, Material in types.ts |
| 4 shape-specific factory functions | PASS | createSphereEntity, createBoxEntity, createCylinderEntity, createSlopeEntity |
| Entity.test.ts 9 tests pass | PASS | All tests: creation, component integrity, counter behavior, independence |
| TypeScript compilation | PASS | Zero errors with tsc --noEmit |
| Application build | PASS | Builds in ~3.59s |
| cn() function preserved | PASS | utils.ts still exports cn() after shadcn init |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root tsconfig.json lacked paths for shadcn CLI**
- **Found during:** Task 1
- **Issue:** shadcn init requires import alias (`@/*`) in tsconfig.json, but the project uses project references with paths only in tsconfig.app.json
- **Fix:** Added `compilerOptions.baseUrl` and `paths` to the root tsconfig.json
- **Files modified:** frontend/tsconfig.json
- **Commit:** 1e20aab

**2. [Rule 1 - Bug] `export type` re-exports don't provide types for internal use**
- **Found during:** Task 3 (build verification)
- **Issue:** Component files used `export type { X } from '../types'` which makes types available to importers but not within the file itself. Internal references like `Omit<MaterialComponent, 'type'>` failed.
- **Fix:** Added `import type { X } from '../types'` alongside `export type { X }` in all 5 component files
- **Files modified:** Transform.ts, RigidBody.ts, Collider.ts, Velocity.ts, Material.ts
- **Commit:** 50f5c1a

**3. [Rule 1 - Bug] `satisfies` keyword incompatible with `tsc -b` build**
- **Found during:** Task 3 (build verification)
- **Issue:** The `satisfies` keyword in Entity.ts array elements caused excess property check errors during `tsc -b` build. TypeScript reported properties like `position` don't exist on `Component`.
- **Fix:** Replaced all `} satisfies XComponent,` with `} as XComponent,` in Entity.ts
- **Files modified:** frontend/src/ecs/Entity.ts
- **Commit:** 50f5c1a

**4. [Rule 1 - Bug] Unused type imports in test files**
- **Found during:** Task 3 (build verification)
- **Issue:** types.test.ts imported `AnyComponent`, `RigidBodyKind`, `ColliderShape`, `ColliderParams` which were never used; Entity.test.ts had unused `t2` variable
- **Fix:** Removed unused imports and variables
- **Files modified:** types.test.ts, Entity.test.ts
- **Commit:** 50f5c1a

### Shadcn v4 Version Difference

The plan specified `style: "new-york"` and `baseColor: "neutral"` for shadcn init. Shadcn CLI v4.6.0 uses a preset system where `"radix-nova"` is the equivalent of the old New York style with Neutral base color. The `components.json` correctly records `"baseColor": "neutral"` and `"style": "radix-nova"`.

## TDD Gate Compliance

| Phase | Commit | Gate |
|-------|--------|------|
| Task 2 RED | f8e4fa0 | `test(02-01): add ECS type validation tests` |
| Task 2 GREEN | db8b5eb | `feat(02-01): implement ECS component type definitions` |
| Task 3 RED | 768984f | `test(02-01): add Entity factory unit tests` |
| Task 3 GREEN | 50f5c1a | `feat(02-01): implement ECS Entity factory` |

All TDD gates present and in correct sequence. RED commits precede GREEN commits for both TDD tasks.

## Known Stubs

None. All files contain complete working implementations with no placeholder data, TODO markers, or unwired components.

## Threat Flags

None. All created files are within the plan's defined threat model scope (ECS data layer + UI component library). No new network endpoints, auth paths, or file access patterns introduced.

## Files Created/Modified

**Created (19 files):**
- `frontend/src/ecs/types.ts` — Entity interface, ComponentType, 5 Component interfaces, AnyComponent union
- `frontend/src/ecs/Entity.ts` — createEntity, 4 shape factories, global counter, resetEntityCounter
- `frontend/src/ecs/components/Transform.ts` — DEFAULT_TRANSFORM with position/rotation/scale
- `frontend/src/ecs/components/RigidBody.ts` — DEFAULT_RIGID_BODY with kind/mass/restitution/friction
- `frontend/src/ecs/components/Collider.ts` — Default params for sphere/cuboid/cylinder shapes
- `frontend/src/ecs/components/Velocity.ts` — DEFAULT_VELOCITY
- `frontend/src/ecs/components/Material.ts` — DEFAULT_COLORS palette + DEFAULT_MATERIAL
- `frontend/src/ecs/__tests__/types.test.ts` — 7 type shape validation tests
- `frontend/src/ecs/__tests__/Entity.test.ts` — 9 entity factory unit tests
- `frontend/components.json` — shadcn configuration
- `frontend/src/components/ui/button.tsx` — shadcn Button
- `frontend/src/components/ui/dialog.tsx` — shadcn Dialog (Radix-based modal)
- `frontend/src/components/ui/slider.tsx` — shadcn Slider
- `frontend/src/components/ui/input.tsx` — shadcn Input
- `frontend/src/components/ui/label.tsx` — shadcn Label
- `frontend/src/components/ui/tooltip.tsx` — shadcn Tooltip
- `frontend/src/components/ui/scroll-area.tsx` — shadcn ScrollArea
- `frontend/src/components/ui/separator.tsx` — shadcn Separator
- `frontend/src/components/ui/badge.tsx` — shadcn Badge

**Modified (5 files):**
- `frontend/tsconfig.json` — Added compilerOptions for shadcn alias detection
- `frontend/src/index.css` — shadcn-injected CSS custom properties, dark mode, @theme inline
- `frontend/src/lib/utils.ts` — shadcn updated import style (functionally identical)
- `frontend/package.json` — Added react-hook-form, zod, @hookform/resolvers
- `frontend/package-lock.json` — Updated lockfile
