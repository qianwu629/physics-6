---
phase: 01-持久化与场景库
plan: 03
subsystem: 持久化UI入口
tags: [menu-bar, scene-loader, serialization, export, import, banner, confirm-dialog]
dependency_graph:
  requires:
    - 01-01 (sceneSerializer / sceneValidation 接口)
  provides:
    - MenuBar UI 组件
    - SceneLoader 统一加载流程
    - SceneBanner 警告提示
    - ConfirmDialog 确认对话框
  affects:
    - App.tsx (集成点，Plan 05)
tech_stack:
  added:
    - sceneSerializer.ts (serializeScene / deserializeScene)
  patterns:
    - Module-level state for cross-component communication (banner, confirm dialog)
    - D-01-03 unified load flow (confirm -> pause -> resetEntities -> reset -> load)
    - D-01-02 tolerant schema loading with banner warnings
    - D-01-08 tiered error handling (Modal for hard errors, Banner for warnings)
key_files:
  created:
    - frontend/src/utils/sceneSerializer.ts (212 lines)
    - frontend/src/components/SceneLoader.tsx (354 lines)
    - frontend/src/components/MenuBar.tsx (333 lines)
  modified: []
decisions:
  - "Module-level state used for SceneBanner warnings and ConfirmDialog (global singleton pattern) — avoids Zustand overhead for purely transient UI state"
  - "Camera reset via resetCounter increment triggers Physics remount in Scene3D — avoids direct OrbitControls ref manipulation (deferred to Plan 05 for bounding-box fit)"
  - "FPS toggle in MenuBar [视图] left disabled as placeholder — plan explicitly marks it as '预留，暂不实现功能'"
metrics:
  duration: "~18 min"
  completed_date: "2026-05-04"
  tasks: 2
  files: 3
---

# Phase 01 Plan 03: MenuBar + SceneLoader 统一加载流程 Summary

MenuBar 顶部菜单栏提供 [文件]/[视图]/[帮助] 三级下拉菜单作为持久化操作入口；SceneLoader 封装 D-01-03 完整加载流程（确认弹窗 -> 暂停仿真 -> 清空实体 -> 重置轨迹/相机 -> 加载场景数据 -> 环境参数设置），通过模块级状态管理实现 SceneBanner 警告提示和 ConfirmDialog 确认对话框。sceneSerializer 桥接运行时 Entity Map 与 JSON SceneData 的双向转换。

## Tasks Completed

| # | Task | Type | Commit | Key Files |
|---|------|------|--------|-----------|
| 1 | SceneLoader 统一加载流程 | auto | `98ca015` | `SceneLoader.tsx` |
| 2 | MenuBar 顶部菜单栏 | auto | `066464e` | `MenuBar.tsx` |

## Commits

| Hash | Message |
|------|---------|
| `d29f921` | fix(01-持久化与场景库-01-03): create sceneSerializer.ts with serializeScene/deserializeScene |
| `98ca015` | feat(01-持久化与场景库-01-03): create SceneLoader with unified load flow + banner |
| `066464e` | feat(01-持久化与场景库-01-03): create MenuBar with [文件][视图][帮助] dropdown menus |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing Dependency] sceneSerializer.ts 不存在**

- **Found during:** Task 1 执行前检查依赖
- **Issue:** Plan 01-03 依赖 01-01 产出的 `sceneSerializer.ts`（`serializeScene` / `deserializeScene`），但该文件在当前分支不存在
- **Fix:** 创建 `frontend/src/utils/sceneSerializer.ts`，实现完整的序列化/反序列化函数链：
  - `serializeScene()` — Entity Map + Environment -> SceneData，排除 trail/vector 组件（D-01-01）
  - `deserializeScene()` — JSON -> Entity Map + Environment，含约束引用失效检查（D-01-08）
  - `exportSceneToJSON()` / `importJSONToScene()` — 便捷包装函数
- **Files created:** `frontend/src/utils/sceneSerializer.ts`
- **Commit:** `d29f921`

## Known Stubs

| File | Line | Description | Resolution Plan |
|------|------|-------------|-----------------|
| `MenuBar.tsx` | 204-210 | [视图] > "显示 FPS" CheckboxItem 为 disabled 占位 | Plan 明确标记为"预留，暂不实现功能"，FPS 显示屏已存在于 simulationSlice，UI toggle 留待后续计划 |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | `MenuBar.tsx:147` | `<input type="file" accept=".json">` 接受任意 .json 文件 — 已在 `importSceneFromFile` 中通过 5MB 限制 + Zod 校验缓解 |
| threat_flag: information-disclosure | `MenuBar.tsx:293-310` | "关于 Physis" Dialog 暴露技术栈信息（React + Three.js + Rapier）— 客户端应用正常行为，接受风险 |

## Self-Check: PASSED

- [x] `frontend/src/utils/sceneSerializer.ts` — EXISTS
- [x] `frontend/src/components/SceneLoader.tsx` — EXISTS
- [x] `frontend/src/components/MenuBar.tsx` — EXISTS
- [x] Commit `d29f921` — EXISTS in git log
- [x] Commit `98ca015` — EXISTS in git log
- [x] Commit `066464e` — EXISTS in git log
