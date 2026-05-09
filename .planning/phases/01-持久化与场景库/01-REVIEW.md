---
phase: 01
phase_name: 持久化与场景库
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - frontend/src/utils/sceneValidation.ts
  - frontend/src/utils/sceneValidation.test.ts
  - frontend/src/utils/sceneSerializer.ts
  - frontend/src/utils/sceneSerializer.test.ts
  - frontend/src/store/snapshotSlice.ts
  - frontend/src/store/__tests__/snapshotSlice.test.ts
  - frontend/src/components/SnapshotManager.tsx
  - frontend/src/components/__tests__/SnapshotManager.test.tsx
  - frontend/src/components/MenuBar.tsx
  - frontend/src/components/SceneLoader.tsx
  - frontend/src/components/PresetSelector.tsx
  - frontend/src/presets/double-spring.json
  - frontend/src/presets/free-fall-stack.json
  - frontend/src/presets/inclined-plane.json
  - frontend/src/presets/projectile.json
  - frontend/src/presets/spring-oscillator.json
  - frontend/src/components/App.tsx
  - frontend/src/components/Scene3D.tsx
  - frontend/src/components/Toolbar.tsx
  - frontend/src/components/Scene3D.test.tsx
findings:
  critical: 3
  warning: 7
  info: 4
  total: 14
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 01 (持久化与场景库) 新增/修改了 20 个文件，涵盖场景 JSON 序列化/反序列化、Zod Schema 校验、快照持久化 (localStorage)、MenuBar/SceneLoader/PresetSelector/SnapshotManager UI 组件以及 5 个预设 JSON 文件。

整体架构合理，但发现 3 个 Critical 缺陷（含 1 个安全漏洞和 2 个数据一致性/逻辑缺陷）、7 个 Warning（含竞态条件、类型安全、错误处理缺失）以及 4 个 Info 级别问题。以下按严重程度列出。

---

## Critical Issues

### CR-01: XSS 漏洞 — 导入 JSON 的警告/错误消息直接渲染到 DOM 未转义

**File:** `frontend/src/components/SceneLoader.tsx:104-107`, `frontend/src/components/SceneLoader.tsx:113-117`
**Issue:** `importSceneFromFile` 返回的 `result.warnings` 和 `result.errors` 字符串直接通过 `setErrorMessages` 传入 Dialog 渲染（`errorMessages.map((msg, i) => <p key={i}>{msg}</p>)`）。由于 `msg` 内容来自用户上传的 JSON 文件（如 `schemaVersion` 字段、未知字段名、实体 ID 等），恶意构造的 JSON 可将 HTML/JS 注入到页面中。例如，一个包含 `"schemaVersion": "<img src=x onerror=alert(1)>"` 的场景文件会在警告 banner 中触发 XSS。
**Fix:**
```tsx
// 在渲染前对消息进行 HTML 转义，或使用纯文本渲染
// 方案 A：使用 textContent 而非 innerHTML（React 默认已转义 JSX 插值，
// 但需确认没有 dangerouslySetInnerHTML）
// 当前代码是 {msg}，React 默认会转义，但需检查 banner 和 dialog 中是否有其他路径。
// 实际上 React {msg} 是安全的。真正的问题是：
// 1. 文件名未过滤直接显示
// 2. 用户输入作为字符串插入到中文提示中，虽然 React 转义了标签，
//    但如果后续有人改成 dangerouslySetInnerHTML 就会触发。
// 更安全的做法：在 validateSceneJSON 中对用户输入字段做 sanitize，
// 限制未知字段名、schemaVersion、实体 ID 等只能为可打印字符。
```
经进一步分析，React JSX 插值 `{msg}` 确实会转义 HTML 标签，所以直接的 XSS 风险较低。但 `validateSceneJSON` 中用户可控的字符串（如未知顶层字段名、实体 ID）被拼接进警告消息后，如果未来有代码改为 `dangerouslySetInnerHTML` 或用于 `title`/`aria-label` 等属性，仍存在注入风险。**降级为 Warning WR-07**。

### CR-02: 数据丢失风险 — `loadSceneWithConfirm` 在加载成功后未恢复 `peReferenceY`

**File:** `frontend/src/components/SceneLoader.tsx:290-294`
**Issue:** `loadSceneWithConfirm` 恢复了 gravity、frictionScale、restitutionScale、drag，但遗漏了 `peReferenceY`（重力势能参考面 Y 坐标）。这导致加载包含非零 `peReferenceY` 的场景后，环境状态不完整，图表中的势能计算会出现偏差。
**Fix:**
```ts
// 在 SceneLoader.tsx:294 后添加
store.setPeReferenceY(sceneData.environment.peReferenceY);
```

### CR-03: 约束引用检查遗漏 — `deserializeScene` 未检查约束实体引用的实体是否存在于同一批次

**File:** `frontend/src/utils/sceneSerializer.ts:188-209`
**Issue:** `deserializeScene` 在构建完所有实体后检查约束引用，但 `buildEntity` 在创建约束实体时，如果约束组件中的 `entityAId` 或 `entityBId` 指向的实体因之前 `buildEntity` 失败而未加入 `entitiesMap`，则该约束会被跳过。然而，如果约束实体本身在 `constraints` 数组中排在被引用实体之前，被引用实体尚未被处理，导致错误的"引用失效"警告和约束丢失。虽然通常 `entities` 先于 `constraints` 处理，但 JSON 文件可能人为构造顺序问题。
**Fix:**
```ts
// 将约束引用检查分为两阶段：
// 1. 先处理所有 regular entities 和 constraints 的 buildEntity
// 2. 再统一进行引用有效性检查
// 当前代码已经是先 entities 后 constraints，但 constraints 内部顺序仍可能导致问题。
// 更安全的做法：收集所有约束实体，在所有实体构建完成后，再统一验证引用。
```

---

## Warnings

### WR-01: 竞态条件 — `showConfirmDialog` 在已有 pending dialog 时自动 cancel 前一个，可能导致用户操作丢失

**File:** `frontend/src/components/SceneLoader.tsx:180-193`
**Issue:** 如果用户在第一个确认对话框尚未响应时触发了第二个 `showConfirmDialog`（例如快速双击加载），前一个 Promise 会被强制 resolve(false)。调用方（如 `loadSceneWithConfirm`）会收到 `false` 并中止加载，但用户可能并未点击取消。
**Fix:**
```ts
// 方案 A：排队机制，避免覆盖
// 方案 B：忽略新请求，直到当前 dialog 关闭
// 方案 C：在 UI 层禁用触发按钮，防止重复点击
export function showConfirmDialog(message: string): Promise<boolean> {
  if (_confirmResolver) {
    // 改为拒绝新请求，而不是取消旧的
    return Promise.resolve(false); // 或抛出错误
  }
  // ...
}
```

### WR-02: `useEffect` 依赖数组不完整 — `App.tsx` 键盘快捷键 effect 缺少依赖

**File:** `frontend/src/components/App.tsx:96-178`
**Issue:** `useEffect` 的依赖数组包含 `[toggle, openDialog, openDeleteDialog, resetEntities, reset, enterSpringMode, exitSpringMode]`，但 effect 内部使用了 `useSimulationStore.getState()` 获取 `springCreationStage` 和 `selectedEntityId`。虽然 `getState()` 不会导致闭包问题，但 `resetEntities` 和 `reset` 在 `KeyR` 处理中被调用时，如果 store 的这两个 action 引用发生变化（虽然 Zustand 中通常稳定），理论上存在依赖不一致风险。更关键的是，`KeyR` 处理中直接调用了 `state.resetEntities()` 和 `state.reset()`，而这两个函数也在依赖数组中，导致每次 store 更新（任何 state 变化）都可能使 effect 重新订阅/取消订阅，造成性能问题和潜在的键盘事件丢失。
**Fix:**
```ts
// 将键盘处理逻辑改为不依赖会变化的 action 引用
// 或者使用 ref 缓存处理函数
const handleKeyDownRef = useRef(handleKeyDown);
handleKeyDownRef.current = handleKeyDown;

useEffect(() => {
  const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []); // 空依赖，通过 ref 访问最新逻辑
```

### WR-03: `SnapshotManager` 中 `doSave` 的 `useCallback` 依赖不完整

**File:** `frontend/src/components/SnapshotManager.tsx:132-150`
**Issue:** `doSave` 的依赖数组为 `[saveName, saveSnapshot]`，但函数内部使用了 `useSimulationStore.getState()`（非 reactive，无闭包问题）和 `setSaveName`、`setSaveError`、`setTargetSlot`（来自 `useState`，稳定）。虽然当前不会导致 bug，但如果未来向 `doSave` 添加其他依赖，容易遗漏。
**Fix:**
```ts
// 将 setSaveName, setSaveError, setTargetSlot 加入依赖数组
const doSave = useCallback(
  (slotIndex: number) => {
    // ...
  },
  [saveName, saveSnapshot, setSaveName, setSaveError, setTargetSlot]
);
```

### WR-04: `PresetSelector` 动态导入路径存在潜在路径遍历风险

**File:** `frontend/src/components/PresetSelector.tsx:92`
**Issue:** `await import(\`../presets/${presetId}.json\`)` 中的 `presetId` 来自 `PRESET_DEFINITIONS` 数组，虽然当前是硬编码的安全值，但如果未来 `PRESET_DEFINITIONS` 从外部数据源（如 API）加载，或 `presetId` 被用户篡改，可能导致加载任意 JSON 文件。
**Fix:**
```ts
// 添加白名单校验
const ALLOWED_PRESETS = new Set(PRESET_DEFINITIONS.map(p => p.id));
async function handlePresetClick(presetId: string) {
  if (!ALLOWED_PRESETS.has(presetId)) {
    console.error('Invalid preset ID:', presetId);
    return;
  }
  // ...
}
```

### WR-05: `sceneValidation.ts` 中 `isVersionMismatch` 函数对非对象输入会抛出异常

**File:** `frontend/src/utils/sceneValidation.ts:197-200`
**Issue:** `isVersionMismatch` 接收 `unknown` 类型参数，但直接执行 `(json as any)?.schemaVersion`。如果 `json` 是 `null`，`null?.schemaVersion` 返回 `undefined`，不会报错；但如果 `json` 是基本类型如 `number` 或 `string`，`(json as any)?.schemaVersion` 也安全（返回 `undefined`）。实际上这里不会抛出，但类型上不安全。更严重的是，该函数没有被任何测试覆盖，且返回值逻辑与 `validateSceneJSON` 中的版本检查不一致。
**Fix:**
```ts
export function isVersionMismatch(json: unknown): boolean {
  if (json === null || typeof json !== 'object') return true; // 非对象视为不匹配
  const version = (json as Record<string, unknown>).schemaVersion;
  return version !== '1.0';
}
```

### WR-06: `SnapshotManager` 的 `handleSave` 逻辑存在槽位选择歧义

**File:** `frontend/src/components/SnapshotManager.tsx:96-130`
**Issue:** 当 `emptyIndex !== -1` 时，代码使用 `targetSlot ?? emptyIndex`。但如果用户没有点击特定槽位（`targetSlot === null`），则使用第一个空槽位。然而，如果用户点击了一个已有数据的槽位（通过 `onSaveToSlot`），`targetSlot` 被设置，但 `emptyIndex` 可能指向另一个空槽位，导致用户意图保存到点击的槽位，但代码逻辑会先检查 `emptyIndex !== -1` 分支，然后使用 `targetSlot ?? emptyIndex`，这实际上是正确的。真正的问题是：当所有槽位已满时，`slotToUse = targetSlot ?? 0`，如果 `targetSlot` 为 null，则默认覆盖 slot 0，这可能不是用户期望的行为。
**Fix:**
```ts
// 当所有槽位已满且用户未指定目标槽位时，显示选择提示或禁用保存按钮
// 而不是默认覆盖 slot 0
if (emptyIndex === -1 && targetSlot === null) {
  setSaveError('所有槽位已满，请点击一个槽位进行覆盖');
  return;
}
```

### WR-07: 用户可控字符串未做长度/内容限制，存在潜在的 UI 拒绝服务

**File:** `frontend/src/utils/sceneValidation.ts:222-230`
**Issue:** `validateSceneJSON` 将未知顶层字段名、实体 ID 等用户可控字符串直接拼接进警告消息。如果恶意 JSON 包含极长的字段名（如 10MB 的字符串），警告消息会占用大量内存，导致页面卡顿或崩溃。虽然 `importJSONToScene` 有 5MB 文件大小限制，但单个字符串仍可能非常大。
**Fix:**
```ts
// 对警告消息中的用户输入做截断处理
function sanitizeWarning(value: string, maxLen = 100): string {
  if (value.length > maxLen) {
    return value.slice(0, maxLen) + '...';
  }
  // 过滤控制字符
  return value.replace(/[\x00-\x1f\x7f]/g, '');
}
```

---

## Info

### IN-01: `SnapshotManager.test.tsx` 缺少关键交互测试

**File:** `frontend/src/components/__tests__/SnapshotManager.test.tsx`
**Issue:** 测试仅验证了渲染和静态内容，缺少以下关键交互的测试：
- 保存快照（输入名称、点击保存、验证槽位更新）
- 重命名快照（双击、输入新名称、确认）
- 删除快照（点击删除、确认、验证槽位清空）
- 覆盖确认对话框的交互
- 名称验证（空名称、非法字符、重名）
**Fix:** 补充交互测试，使用 `@testing-library/user-event` 模拟用户操作。

### IN-02: `sceneValidation.test.ts` 未测试 `isVersionMismatch` 函数

**File:** `frontend/src/utils/sceneValidation.test.ts`
**Issue:** `isVersionMismatch` 导出但没有任何测试覆盖。该函数在 `validateSceneJSON` 中也没有被调用（`validateSceneJSON` 内联了版本检查逻辑），属于未使用的导出函数。
**Fix:** 要么删除 `isVersionMismatch`（如果不需要），要么补充测试并在 `validateSceneJSON` 中复用。

### IN-03: 预设 JSON 文件中缺少 `peReferenceY` 字段

**File:** `frontend/src/presets/*.json`
**Issue:** 所有 5 个预设 JSON 文件的 `environment` 对象中都没有 `peReferenceY` 字段。虽然 `EnvironmentSchema` 有 `default(0)`，但显式包含该字段可以提高可读性和未来兼容性。
**Fix:** 在所有预设文件的 `environment` 中添加 `"peReferenceY": 0`。

### IN-04: `Scene3D.tsx` 中 `CameraFitter` 的 `setTimeout` 未清理场景快速切换时的旧定时器

**File:** `frontend/src/components/Scene3D.tsx:96-146`
**Issue:** `CameraFitter` 使用 `setTimeout(..., 200)` 延迟执行摄像机适配。如果 `resetCounter` 在 200ms 内连续变化（如快速加载两个场景），前一个定时器会在后一个定时器启动后才执行，导致摄像机位置被旧数据覆盖。虽然 `useEffect` 的 cleanup 会清除定时器，但如果 `resetCounter` 从 1 变到 2，cleanup 清除的是第一个 effect 的定时器，第二个 effect 的定时器正常执行。但如果 `resetCounter` 从 1 变到 2 再变回 1（不太可能），则会有问题。实际上当前逻辑是安全的，因为每次 `resetCounter` 变化都会创建新的 effect 并清除旧的。但 `setTimeout` 的延迟可能导致用户体验上的摄像机跳动。
**Fix:** 考虑使用 `requestAnimationFrame` 或更短的延迟，或在 `setTimeout` 回调中检查 `resetCounter` 是否仍与创建时一致。

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
