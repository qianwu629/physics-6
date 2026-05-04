---
phase: 01-持久化与场景库
plan: 04
subsystem: 预设场景库
tags: [presets, scenes, JSON, UI, Dialog, lucide-react]
dependency_graph:
  requires:
    - "01-01 (sceneSerializer: deserializeScene)"
    - "01-03 (SceneLoader: loadSceneWithConfirm)"
  provides:
    - "5 built-in preset JSON scenes for 01-05 (MenuBar integration)"
    - "PresetSelector Dialog component"
  affects:
    - "frontend/src/presets/ (new directory)"
    - "frontend/src/components/PresetSelector.tsx (new)"
tech-stack:
  added: []
  patterns:
    - "JSON preset scenes follow D-01-01 Schema (minimal set, no trail/vector)"
    - "Dynamic Vite JSON import for preset loading"
    - "Dialog + card grid UI pattern (shadcn/ui)"
    - "DRY loading: deserializeScene + loadSceneWithConfirm shared flow"
key-files:
  created:
    - frontend/src/presets/projectile.json
    - frontend/src/presets/inclined-plane.json
    - frontend/src/presets/free-fall-stack.json
    - frontend/src/presets/spring-oscillator.json
    - frontend/src/presets/double-spring.json
    - frontend/src/components/PresetSelector.tsx
  modified: []
decisions:
  - "Preset JSON format follows D-01-01 Schema (minimal set, no trail/vector components)"
  - "5 presets delivered per D-01-07 (6th deferred to Phase 3 for ForceField dependency)"
  - "Preset loading shares deserializeScene + loadSceneWithConfirm flow (DRY with import/snapshot)"
metrics:
  duration: ~12 min
  completed_date: 2026-05-04
---

# Phase 01 Plan 04: 5 个内置预设场景 JSON + PresetSelector 选择器 UI

5 个内置预设场景 JSON 文件，涵盖抛体运动、斜面滑块、自由落体堆叠、弹簧振子、双弹簧链；配套 PresetSelector Dialog 卡片网格选择器，一键加载预建物理实验场景。

## Tasks Executed

| # | Name | Type | Commit | Files |
|---|------|------|--------|-------|
| 1 | 创建 5 个预设场景 JSON 文件 | auto | `08833c8` | projectile.json, inclined-plane.json, free-fall-stack.json, spring-oscillator.json, double-spring.json |
| 2 | 创建 PresetSelector 卡片选择器 | auto | `fb75f8e` | PresetSelector.tsx |

## Verification Results

### Task 1: 预设 JSON 文件

- projectile.json: 50 lines, schemaVersion=1.0, 1 entity, 0 trail/vector matches
- inclined-plane.json: 85 lines, schemaVersion=1.0, 2 entities, 0 trail/vector matches
- free-fall-stack.json: 190 lines, schemaVersion=1.0, 5 entities, 0 trail/vector matches
- spring-oscillator.json: 103 lines, schemaVersion=1.0, 2 entities + 1 constraint, 0 trail/vector matches
- double-spring.json: 259 lines, schemaVersion=1.0, 5 entities + 4 constraints, 8 entityAId/entityBId refs
- All 5 JSON files parse successfully via `JSON.parse()`

### Task 2: PresetSelector 组件

- File: 179 lines (>= 90)
- `Dialog`, `PresetSelectorProps`, `PresetSelector` function present
- 10 references to preset IDs (>= 5)
- `deserializeScene` and `loadSceneWithConfirm` imports present
- Dynamic JSON import from `../presets/` present
- `grid-cols-2 gap-3` 2-column grid layout present
- Keyboard accessibility: Enter/Space activation on cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing dependency] sonner toast not available; used alert() for dynamic import errors**

- **Found during:** Task 2
- **Issue:** The plan references `toast.error()` for dynamic import failure handling, but `sonner` is not installed in package.json (despite RESEARCH.md claiming it is "project-adopted").
- **Fix:** Used `alert()` instead of `toast.error()` for the try/catch error path, consistent with the plan's existing `alert()` usage for deserializeScene failure handling.
- **Files modified:** frontend/src/components/PresetSelector.tsx
- **Commit:** `fb75f8e`

### Planned but Not Yet Resolvable

The PresetSelector imports `deserializeScene` from `@/utils/sceneSerializer` and `loadSceneWithConfirm` from `@/components/SceneLoader`. Both files are being created by parallel plans (01-01 and 01-03 respectively) and will resolve upon branch merge.

## Known Stubs

None. All 5 preset JSON files contain complete, valid scene data with defined entity IDs, component parameters, and constraint references. The PresetSelector UI renders all 5 cards with icons, titles, descriptions, and click handlers wired through the complete loading pipeline.

## Threat Flags

None. All threats in the plan's threat model are `accept` disposition (T-04-01: presets are static build assets; T-04-02: 5 JSON files < 10KB total).

## Self-Check: PASSED

- [x] `.planning/phases/01-持久化与场景库/01-04-SUMMARY.md` created
- [x] `frontend/src/presets/projectile.json` exists
- [x] `frontend/src/presets/inclined-plane.json` exists
- [x] `frontend/src/presets/free-fall-stack.json` exists
- [x] `frontend/src/presets/spring-oscillator.json` exists
- [x] `frontend/src/presets/double-spring.json` exists
- [x] `frontend/src/components/PresetSelector.tsx` exists
- [x] Commit `08833c8` present in git log
- [x] Commit `fb75f8e` present in git log
