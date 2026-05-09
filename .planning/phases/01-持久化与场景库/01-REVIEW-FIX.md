---
phase: 01
phase_name: 持久化与场景库
fixed_at: 2026-05-09T13:22:00Z
review_path: .planning/phases/01-持久化与场景库/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-09T13:22:00Z
**Source review:** .planning/phases/01-持久化与场景库/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (3 Critical + 6 Warning; Info issues excluded)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-02: 数据丢失风险 — `loadSceneWithConfirm` 遗漏 `peReferenceY`

**Files modified:** `frontend/src/components/SceneLoader.tsx`
**Commit:** d23e092
**Applied fix:** 在加载环境参数后添加 `store.setPeReferenceY(sceneData.environment.peReferenceY);`，确保重力势能参考面 Y 坐标在场景加载后被正确恢复。

### CR-03: 约束引用检查遗漏 — `deserializeScene` 处理顺序问题

**Files modified:** `frontend/src/utils/sceneSerializer.ts`
**Commit:** 965c2c2
**Applied fix:** 将 `entities` 和 `constraints` 的构建合并为统一的 `allSerializedEntities` 数组，先完成所有实体构建，再统一进行约束引用有效性检查。添加明确注释说明两阶段处理逻辑，避免约束实体排在被引用实体之前时误判为引用失效。

### WR-01: 竞态条件 — `showConfirmDialog` 覆盖 pending dialog

**Files modified:** `frontend/src/components/SceneLoader.tsx`
**Commit:** 8f2c019
**Applied fix:** 将 `showConfirmDialog` 中已有 pending dialog 时的行为从"强制 resolve(false) 前一个"改为"返回 `Promise.resolve(false)` 忽略新请求"，避免用户操作丢失。

### WR-02: `App.tsx` 键盘快捷键 `useEffect` 依赖问题

**Files modified:** `frontend/src/components/App.tsx`
**Commit:** 8bf9eeb
**Applied fix:** 使用 `useRef` 缓存键盘处理函数，`useEffect` 使用空依赖数组只订阅一次键盘事件。处理函数内部通过 `useSimulationStore.getState()` 直接获取最新状态，避免频繁重建订阅导致的性能问题和潜在事件丢失。

### WR-03: `SnapshotManager` `doSave` `useCallback` 依赖不完整

**Files modified:** `frontend/src/components/SnapshotManager.tsx`
**Commit:** cb1cc0e
**Applied fix:** 将 `setSaveName`, `setSaveError`, `setTargetSlot` 加入 `doSave` 的 `useCallback` 依赖数组，使依赖声明完整。

### WR-04: `PresetSelector` 动态导入路径白名单校验

**Files modified:** `frontend/src/components/PresetSelector.tsx`
**Commit:** e8b440d
**Applied fix:** 添加 `ALLOWED_PRESETS` 白名单集合（从 `PRESET_DEFINITIONS` 映射生成），在 `import()` 前校验 `presetId`，防止潜在的路径遍历风险。

### WR-05: `isVersionMismatch` 类型安全

**Files modified:** `frontend/src/utils/sceneValidation.ts`
**Commit:** 63e49e4
**Applied fix:** 在 `isVersionMismatch` 函数开头添加 `null`、非对象和数组输入检查，非对象输入视为版本不匹配（返回 `true`）。

### WR-06: `SnapshotManager` 槽位选择歧义

**Files modified:** `frontend/src/components/SnapshotManager.tsx`
**Commit:** 382dcb9
**Applied fix:** 当所有槽位已满且 `targetSlot === null`（用户未指定目标槽位）时，显示错误提示"所有槽位已满，请点击一个槽位进行覆盖"并返回，不再默认覆盖 slot 0。

### WR-07: 用户可控字符串长度限制

**Files modified:** `frontend/src/utils/sceneValidation.ts`
**Commit:** bda9e2b
**Applied fix:** 添加 `sanitizeWarning(value, maxLen = 100)` 辅助函数，对警告消息中的用户输入做截断（超过 100 字符加 `...` 后缀）和过滤控制字符。应用到 `schemaVersion`、未知顶层字段名、实体 ID 和未知组件类型名。

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-05-09T13:22:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
