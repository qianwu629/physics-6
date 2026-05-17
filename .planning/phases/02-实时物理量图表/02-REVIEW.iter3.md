---
phase: 02-实时物理量图表
reviewed: 2026-05-17T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - frontend/src/components/PropertyPanel.tsx
  - frontend/src/components/EnvironmentPanel.tsx
  - frontend/src/components/Toolbar.tsx
  - frontend/src/components/App.tsx
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 02: Code Review Report (Iter 3)

**Reviewed:** 2026-05-17
**Depth:** quick
**Files Reviewed:** 4
**Status:** issues_found

## Summary

对 Phase 02-05 UI 集成文件（将图表面板组件接入现有 UI）进行快速模式匹配审查。审查了 4 个组件文件：`PropertyPanel.tsx`、`EnvironmentPanel.tsx`、`Toolbar.tsx`、`App.tsx`。

未发现安全漏洞（无硬编码密钥、无 eval/innerHTML、无空 catch 块、无调试残留）。发现 3 个 Warning 级别问题和 1 个 Info 级别问题：一个未使用的导入、一段死代码、一个边界条件导致空字符串显示的 fallback 缺陷、以及一个未使用的变量解构。

## Warnings

### WR-01: 未使用的导入 DEFAULT_ENVIRONMENT

**File:** `frontend/src/components/EnvironmentPanel.tsx:3`
**Issue:** `DEFAULT_ENVIRONMENT` 从 `../store/simulationSlice` 导入但在此组件中从未使用。这是死导入，增加了不必要的模块依赖。
**Fix:**
```typescript
// 删除第 3 行:
// import { DEFAULT_ENVIRONMENT } from '../store/simulationSlice';
```

---

### WR-02: 死代码 — PropertyPanel 中的 handleDeleteConfirm 未被使用

**File:** `frontend/src/components/PropertyPanel.tsx:313-317`
**Issue:** `PropertyPanel` 组件内部定义了 `handleDeleteConfirm` 回调（第 313-317 行），但从未被调用或传递给子组件。实际的删除逻辑由独立的 `DeleteConfirmDialog` memo 组件（第 815-818 行）中的同名函数处理。这段代码是死代码，会造成维护混淆。
**Fix:** 删除第 313-317 行的 `handleDeleteConfirm` 定义。

---

### WR-03: entityAName/entityBName 空字符串 fallback 缺陷

**File:** `frontend/src/components/PropertyPanel.tsx:239-246`
**Issue:** 当 `constraint` 已定义但 `entityAId` 是空字符串 `''` 时，表达式 `!constraint?.entityAId` 为 `true`（因为 `!'' === true`），随后 `'' ?? '?'` 返回 `''`（空字符串），导致 UI 显示空白而非预期的 `'?'` 占位符。虽然在实际运行中 entityId 不太可能是空字符串，但该逻辑在类型层面（`string`）存在缺陷。
**Fix:**
```typescript
// 将第 240 行和第 244 行改为:
const entityAName = useSimulationStore((s) => {
    if (!constraint?.entityAId) return '?';  // 直接返回 '?' 而非使用 ?? 
    return s.entities.get(constraint.entityAId)?.name ?? constraint.entityAId;
});
const entityBName = useSimulationStore((s) => {
    if (!constraint?.entityBId) return '?';
    return s.entities.get(constraint.entityBId)?.name ?? constraint.entityBId;
});
```

## Info

### IN-01: 未使用的解构变量 selectedEntityId

**File:** `frontend/src/components/App.tsx:63`
**Issue:** `selectedEntityId` 从 store 解构但从未在 JSX 或组件的回调闭包中使用。它在键盘事件处理器中通过 `useSimulationStore.getState().selectedEntityId` 以命令式方式访问。该解构变量是多余的。
**Fix:** 移除第 63 行 `const selectedEntityId = useSimulationStore((s) => s.selectedEntityId);`。

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
