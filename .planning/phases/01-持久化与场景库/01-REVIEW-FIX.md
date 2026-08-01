---
phase: 01
phase_name: 持久化与场景库
fixed_at: 2026-05-24T00:40:00Z
review_path: .planning/phases/01-持久化与场景库/01-REVIEW.md
iteration: 2
findings_in_scope: 13
fixed: 10
skipped: 3
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-24T00:40:00Z
**Source review:** .planning/phases/01-持久化与场景库/01-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 13 (4 Critical + 9 Warning; Info excluded except IN-04/IN-05)
- Fixed: 10
- Skipped: 3

## Fixed Issues

### CR-01: RigidBody `charge` 字段在序列化 schema 中为可选，但在运行时类型中为必填

**Files modified:** `frontend/src/utils/sceneSerializer.ts`
**Commit:** 6db41f7
**Applied fix:** 在 `buildEntity` 函数中，对 `rigidBody` 组件做防御性补齐：若 `charge === undefined`，则设为 `0`。

### CR-02: `PresetSelector` 动态 `import()` 使用模板字符串拼接路径

**Files modified:** `frontend/src/components/PresetSelector.tsx`
**Commit:** 7cbd8bc
**Applied fix:** 使用静态映射表 `PRESET_MODULES` 替代动态模板字符串，彻底消除运行时路径拼接风险。

### CR-03: `SceneLoader` 模块级全局状态 `_confirmResolver` 存在并发竞态条件

**Files modified:** `frontend/src/components/SceneLoader.tsx`
**Commit:** 9e7188f
**Applied fix:** 将单例 `_confirmResolver` 替换为 `ConfirmRequest` 对象（含唯一 ID），新请求覆盖旧请求，避免 resolver 错乱。

### WR-01: `sanitizeWarning` 正则表达式范围错误

**Files modified:** `frontend/src/utils/sceneValidation.ts`
**Commit:** 34cc056
**Applied fix:** 修正正则表达式为 `/[\x00-\x1f\x7f]/g`，正确过滤所有控制字符。

### WR-02: `buildEntity` 返回 null 时约束引用检查不对称

**Files modified:** `frontend/src/utils/sceneSerializer.ts`
**Commit:** 0034027
**Applied fix:** 新增 `failedEntityIds` 集合记录创建失败的实体 ID，约束引用检查时若引用失败实体则给出明确警告。

### WR-04: `SceneLoader.loadSceneWithConfirm` 在加载失败时仍返回 `true`

**Files modified:** `frontend/src/components/SceneLoader.tsx`
**Commit:** deb901e
**Applied fix:** 收集 `addEntity` 返回值，若有任何实体添加失败则返回 `false`。

### WR-05: `App.tsx` 的 `onLoadSnapshot` 未处理 `deserializeScene` 失败

**Files modified:** `frontend/src/components/App.tsx`
**Commit:** d80f84f
**Applied fix:** 添加 else 分支，在反序列化失败时通过 `useSceneBanner` 显示错误警告。

### WR-06: `PresetSelector` 的 `alert()` 使用阻塞式原生对话框

**Files modified:** `frontend/src/components/PresetSelector.tsx`
**Commit:** fbed9e1
**Applied fix:** 将 `alert()` 替换为 `sonner` 的 `toast.error()`，避免阻塞主线程。

### WR-07: `MAX_FILE_SIZE` 按字符串长度计算，与字节大小不一致

**Files modified:** `frontend/src/utils/sceneSerializer.ts`
**Commit:** 36cf586
**Applied fix:** 使用 `new TextEncoder().encode(jsonString).length` 计算实际字节数。

### WR-09: `SceneSchema` lenient 未检查 transform 组件存在性

**Files modified:** `frontend/src/utils/sceneValidation.ts`
**Commit:** edaf71c
**Applied fix:** 在 `validateSceneJSON` 的 per-entity 验证阶段，检查每个实体是否包含 `transform` 组件，缺少则跳过并发出警告。

### IN-04: 预设 JSON 文件缺少 `peReferenceY` 字段

**Files modified:** `frontend/src/presets/double-spring.json`, `frontend/src/presets/free-fall-stack.json`, `frontend/src/presets/inclined-plane.json`, `frontend/src/presets/projectile.json`, `frontend/src/presets/spring-oscillator.json`
**Commit:** 2baa7b3
**Applied fix:** 为所有 5 个预设文件的 `environment` 对象显式添加 `"peReferenceY": 0`。

### IN-05: `MenuBar.tsx` 导入错误处理对话框未显示 warnings

**Files modified:** `frontend/src/components/MenuBar.tsx`
**Commit:** 58854ac
**Applied fix:** 在错误对话框中增加 `resultWarnings` 状态，导入失败时同时渲染 errors 和 warnings。

## Skipped Issues

### CR-04: `snapshotSlice.ts` 的 `serializeEntities` 对组件做浅引用拷贝

**File:** `frontend/src/store/snapshotSlice.ts:68-81`
**Reason:** 文件已删除（snapshotSlice.ts 在代码重构中被移除），无需修复。
**Original issue:** `serializeEntities` 浅拷贝可能导致不可序列化运行时对象进入持久化数据。

### WR-03: `SnapshotManager` 的 `handleSave` 逻辑在 `targetSlot` 与 `emptyIndex` 冲突时行为不可预测

**File:** `frontend/src/components/SnapshotManager.tsx:96-134`
**Reason:** 文件已删除（SnapshotManager.tsx 在代码重构中被移除），无需修复。
**Original issue:** 保存逻辑混合了快速保存和覆盖保存两种模式，路径绕且不符合直觉。

### WR-08: `SnapshotManager` 的 `NAME_REGEX` 允许中文字符但范围不完整

**File:** `frontend/src/components/SnapshotManager.tsx:28`
**Reason:** 文件已删除（SnapshotManager.tsx 在代码重构中被移除），无需修复。
**Original issue:** `NAME_REGEX` 中 `一-鿿` 范围不完整，遗漏 CJK 扩展区和全角标点；未做 NFC 规范化。

---

_Fixed: 2026-05-24T00:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
