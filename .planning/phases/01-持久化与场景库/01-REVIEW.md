---
phase: 01-持久化与场景库
reviewed: 2026-05-23T00:00:00Z
depth: deep
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
  - frontend/src/components/PresetSelector.tsx
  - frontend/src/components/SceneLoader.tsx
  - frontend/src/presets/double-spring.json
  - frontend/src/presets/free-fall-stack.json
  - frontend/src/presets/inclined-plane.json
  - frontend/src/presets/point-charge.json
  - frontend/src/presets/projectile.json
  - frontend/src/presets/spring-oscillator.json
  - frontend/src/components/App.tsx
  - frontend/src/components/MenuBar.tsx
  - frontend/src/components/Scene3D.tsx
  - frontend/src/components/Toolbar.tsx
findings:
  critical: 4
  warning: 9
  info: 6
  total: 19
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** deep
**Files Reviewed:** 20
**Status:** issues_found

## Summary

本次深度审查覆盖 Phase 01（持久化与场景库）的全部 20 个文件，包括序列化/反序列化引擎、Zod Schema 校验、Zustand 快照状态管理、React UI 组件（快照管理器、预设选择器、场景加载器）以及 6 个预设 JSON 文件。发现 4 个 Critical 级别缺陷、9 个 Warning 级别缺陷、6 个 Info 级别问题。

核心风险集中在：
1. **类型安全断裂**：`SerializedComponent` 与运行时 `Component` 接口在 `charge` 字段上存在结构性不一致，预设 JSON 中 `peReferenceY` 缺失导致默认值依赖隐式行为。
2. **安全与鲁棒性**：`PresetSelector` 的动态 `import()` 路径拼接存在被绕过的风险；`SceneLoader` 的模块级全局状态在并发场景下存在竞态条件。
3. **状态管理**：`snapshotSlice.ts` 的 `serializeEntities` 对组件做浅拷贝，若运行时组件包含嵌套对象/Map 则会导致持久化数据与预期不一致。
4. **测试覆盖**：`SnapshotManager.test.tsx` 仅做渲染层面断言，未覆盖交互逻辑（保存、加载、重命名、删除、覆盖确认）。

---

## Critical Issues

### CR-01: RigidBody `charge` 字段在序列化 schema 中为可选，但在运行时类型中为必填 — 类型不一致导致潜在运行时错误

**File:** `frontend/src/utils/sceneValidation.ts:18`, `frontend/src/ecs/types.ts:27`
**Issue:**
`SerializedRigidBodyComponent` 接口中 `charge?: number` 是可选的（line 18），Zod schema 中 `charge: z.number().default(0)`（line 153）。然而运行时 `RigidBodyComponent` 接口中 `charge: number` 是必填字段（types.ts:27）。当反序列化旧版本 JSON（无 charge 字段）时，Zod 会填充默认值 0，这看起来安全；但如果某个代码路径绕过 Zod 直接构造 `SerializedRigidBodyComponent` 并省略 `charge`，再经过 `deserializeScene` 的 `entity.components.set(key as ComponentType, comp as Component)`（sceneSerializer.ts:160）写入 Entity Map，此时 `comp` 实际上缺少 `charge`，后续任何读取 `rigidBody.charge` 的代码（如力场系统）都会得到 `undefined`，可能引发 NaN 传播或逻辑错误。

**Fix:**
在 `deserializeScene` 的 `buildEntity` 函数中，对 `rigidBody` 组件做防御性补齐：
```typescript
if (key === 'rigidBody' && (comp as any).charge === undefined) {
  (comp as any).charge = 0;
}
```
或者更彻底地，将 `RigidBodyComponent.charge` 改为可选并在所有消费者处做 `?? 0` 兜底。

---

### CR-02: `PresetSelector` 动态 `import()` 使用模板字符串拼接路径，可被 DOM 注入绕过 ALLOWED_PRESETS 白名单

**File:** `frontend/src/components/PresetSelector.tsx:106`
**Issue:**
```typescript
const presetModule = await import(`../presets/${presetId}.json`);
```
虽然 `presetId` 在进入该分支前经过 `ALLOWED_PRESETS.has(presetId)` 检查，但 `ALLOWED_PRESETS` 是本地常量集合，攻击者若能通过某种方式（如 XSS 或本地存储污染）调用 `handlePresetClick` 并传入非法 `presetId`，Webpack/Vite 的动态 import 仍可能尝试解析恶意路径。更严重的是，如果构建工具配置为允许动态 import 任意模块（如 `../presets/../../../../../etc/passwd`），则存在路径遍历风险。虽然现代 bundler 通常限制在构建时已知的路径内，但这属于构建层约定而非代码层保证。

**Fix:**
使用静态映射表替代动态模板字符串：
```typescript
const PRESET_MODULES: Record<string, () => Promise<any>> = {
  projectile: () => import('../presets/projectile.json'),
  'inclined-plane': () => import('../presets/inclined-plane.json'),
  // ...
};

const presetModule = await PRESET_MODULES[presetId]();
```
这样彻底消除运行时路径拼接。

---

### CR-03: `SceneLoader` 模块级全局状态 `_confirmResolver` 存在并发竞态条件

**File:** `frontend/src/components/SceneLoader.tsx:61-193`
**Issue:**
`showConfirmDialog` 使用模块级单例 `_confirmResolver` 存储 Promise resolve 函数。如果用户在第一个确认对话框未关闭时，另一个代码路径（如快捷键或自动保存触发）再次调用 `showConfirmDialog`，则第二个调用会直接返回 `Promise.resolve(false)`（line 184-186），但第一个对话框的 resolver 仍保留在内存中。当用户最终点击第一个对话框的按钮时，resolve 的却是已经被丢弃的旧 Promise，导致逻辑错乱。虽然当前 UI 上难以同时触发两个确认对话框，但这属于架构级缺陷。

**Fix:**
将确认对话框状态提升到 React 组件内部（如使用 Context 或全局 store），并为每个对话框请求分配唯一 ID，确保 resolve 的是当前活跃的请求。

---

### CR-04: `snapshotSlice.ts` 的 `serializeEntities` 对组件做浅引用拷贝，持久化数据可能包含不可序列化的运行时对象

**File:** `frontend/src/store/snapshotSlice.ts:68-81`
**Issue:**
```typescript
for (const [ctype, comp] of entity.components.entries()) {
  comps[ctype] = comp;
}
```
这里直接将 `comp`（运行时 Component 对象）赋值给 `comps[ctype]`，是浅引用拷贝。如果任何 Component 内部包含运行时生成的不可序列化对象（如 Three.js 的 Vector3、Rapier 的句柄、函数、Symbol、Date 对象、循环引用等），`zustand/persist` 调用 `JSON.stringify` 时会：
1. 静默丢失这些字段；或
2. 抛出异常导致整个 persist 失败；或
3. 产生无法反序列化的 JSON。

当前 `Component` 类型定义中字段均为原始值/数组，但 TypeScript 类型无法保证运行时不会混入额外属性。特别是 `createEntity` 工厂可能被扩展，或用户通过 `updateComponent` 传入包含嵌套对象的 partial data。

**Fix:**
在 `serializeEntities` 中对每个组件做深度结构化克隆，并过滤掉非 JSON 安全的值：
```typescript
function serializeComponent(comp: unknown): unknown {
  return JSON.parse(JSON.stringify(comp));
}
// 在循环中使用：
comps[ctype] = serializeComponent(comp);
```
或者使用 `structuredClone`（现代浏览器支持）并捕获异常。

---

## Warnings

### WR-01: `sceneValidation.ts` 的 `sanitizeWarning` 正则表达式范围错误，无法过滤所有控制字符

**File:** `frontend/src/utils/sceneValidation.ts:299-304`
**Issue:**
```typescript
return value.replace(/[-\x1f\x7f]/g, '');
```
正则表达式 `[-\x1f\x7f]` 中 `-` 被解释为字面量连字符（因为它在字符类开头），所以实际匹配的只有 `\x1f`（US）和 `\x7f`（DEL）。这漏掉了 `\x00-\x1e` 范围内的所有控制字符（如 `\x00` NUL、`\x0a` LF、`\x0d` CR 等）。如果恶意 JSON 包含这些字符，它们会原样进入警告消息并渲染到 DOM 中（虽然 React 默认会转义，但 banner 的 `truncate` 逻辑可能截断在多字节字符中间）。

**Fix:**
修正正则表达式为：
```typescript
return value.replace(/[\x00-\x1f\x7f]/g, '');
```
注意 `-` 应放在字符类中间作为范围操作符。

---

### WR-02: `deserializeScene` 的 `buildEntity` 在 `createEntity` 失败时返回 null，但后续约束引用检查未处理 null entity 的残留引用

**File:** `frontend/src/utils/sceneSerializer.ts:147-169, 186-207`
**Issue:**
`buildEntity` 在 catch 时返回 `null`，该 entity 不会被加入 `entitiesMap`。但如果一个约束实体引用了这个失败的实体 ID，约束引用检查（line 190-191）会发现目标不存在，从而删除约束实体并发出警告。这看起来是正确行为，但问题在于：如果失败的是普通实体（非约束），而约束引用了它，那么约束会被删除；但如果失败的是约束实体本身，且它引用了有效的普通实体，则不会有任何警告——约束只是静默消失。这种不对称的报错行为会让用户困惑。

**Fix:**
在 `buildEntity` 失败时，不仅返回 null，还应将该 entity ID 记录到一个 `failedEntityIds` 集合中。在约束引用检查阶段，若发现约束引用了失败实体，应给出明确警告："实体 X 创建失败，导致约束 Y 被跳过"。

---

### WR-03: `SnapshotManager` 的 `handleSave` 逻辑在 `targetSlot` 与 `emptyIndex` 冲突时行为不可预测

**File:** `frontend/src/components/SnapshotManager.tsx:96-134`
**Issue:**
```typescript
const emptyIndex = slots.findIndex((s) => s === null);
if (emptyIndex !== -1) {
  const slotToUse = targetSlot ?? emptyIndex;
  if (slots[slotToUse] !== null) {
    setConfirmDialog({ ... });
    return;
  }
  doSave(slotToUse);
}
```
当用户已经点击了某个空槽位（`targetSlot = 2`），但此时槽位 0 也是空的（`emptyIndex = 0`），代码会使用 `targetSlot ?? emptyIndex` 即 2，这是正确的。但如果用户点击的是已被占用的槽位 2（`targetSlot = 2`），同时槽位 0 为空（`emptyIndex = 0`），代码仍会进入 `if (emptyIndex !== -1)` 分支，然后 `slotToUse = 2`，发现 `slots[2] !== null`，弹出覆盖确认。这个逻辑虽然最终正确，但路径非常绕。更隐蔽的 bug 是：如果 `targetSlot` 指向一个已被占用的槽位，且 `emptyIndex !== -1`，用户期望保存到空槽位，但代码却要求覆盖——这不符合直觉。

**Fix:**
明确区分两种模式：
1. 快速保存（不指定槽位）→ 找第一个空槽位；
2. 覆盖保存（指定槽位）→ 无论是否为空都直接覆盖或确认。
当前 UI 的 "保存到此处" 按钮已经是指定槽位模式，但 `handleSave` 主流程仍混合了两种逻辑。

---

### WR-04: `SceneLoader.loadSceneWithConfirm` 在加载失败时仍返回 `true`

**File:** `frontend/src/components/SceneLoader.tsx:268-361`
**Issue:**
```typescript
export async function loadSceneWithConfirm(...): Promise<boolean> {
  const confirmed = await showConfirmDialog('加载将替换当前场景，继续？');
  if (!confirmed) return false;
  // ... 执行加载 ...
  return true;  // line 360
}
```
函数签名暗示返回 `boolean` 表示加载是否成功，但实际上无论 `store.addEntity` 是否成功（`addEntity` 在 `MAX_ENTITIES` 达到上限时返回 `false`），函数都返回 `true`。调用方（如 `App.tsx` 的 `onLoadSnapshot`）无法知道是否有实体因上限而被丢弃。

**Fix:**
收集 `addEntity` 的返回值，若有任何实体添加失败，返回 `false` 并在 banner 中提示：
```typescript
let allAdded = true;
for (const entity of nonConstraints) {
  const added = store.addEntity(entity);
  if (!added) allAdded = false;
  else addedEntityIds.add(entity.id);
}
return allAdded;
```

---

### WR-05: `App.tsx` 的 `onLoadSnapshot` 未处理 `deserializeScene` 失败的情况

**File:** `frontend/src/components/App.tsx:253-268`
**Issue:**
```typescript
const result = deserializeScene(sceneJSON);
if (result.success && result.data) {
  await loadSceneWithConfirm(result.data);
}
```
如果 `deserializeScene` 返回 `success: false`（如快照数据损坏），这段代码完全静默——不显示错误、不抛异常、不记录日志。用户点击加载后没有任何反馈。

**Fix:**
添加 else 分支处理失败：
```typescript
if (result.success && result.data) {
  await loadSceneWithConfirm(result.data);
} else {
  // 通过 banner 或 toast 显示错误
  result.errors.forEach(e => addWarning(e));
}
```

---

### WR-06: `PresetSelector` 的 `alert()` 使用阻塞式原生对话框，破坏 UX 且无法样式化

**File:** `frontend/src/components/PresetSelector.tsx:113, 126`
**Issue:**
代码在预设加载失败时调用 `alert()`。原生 `alert` 会阻塞主线程，在 3D 渲染场景下可能导致帧率骤降甚至 WebGL 上下文丢失。同时无法与应用暗色主题保持一致。

**Fix:**
使用应用内 toast 系统（如 `sonner`）替代 `alert`：
```typescript
import { toast } from 'sonner';
toast.error(`预设加载失败: ${result.errors.join(', ')}`);
```

---

### WR-07: `sceneSerializer.ts` 的 `MAX_FILE_SIZE` 按字符串长度计算，与字节大小不一致

**File:** `frontend/src/utils/sceneSerializer.ts:37, 240`
**Issue:**
```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
if (jsonString.length > MAX_FILE_SIZE) { ... }
```
JavaScript 字符串的 `.length` 返回 UTF-16 码元数量，而非字节数。对于纯 ASCII JSON，`length` 约等于字节数；但对于包含大量中文或其他多字节字符的 JSON，`length` 会显著小于实际字节数。这意味着一个实际大小为 8MB 的全中文 JSON 可能通过检查，导致内存压力。

**Fix:**
使用 `Blob` 或 `TextEncoder` 计算实际字节数：
```typescript
const byteSize = new TextEncoder().encode(jsonString).length;
if (byteSize > MAX_FILE_SIZE) { ... }
```

---

### WR-08: `SnapshotManager` 的 `NAME_REGEX` 允许中文字符但范围不完整，且未做 NFC 规范化

**File:** `frontend/src/components/SnapshotManager.tsx:28`
**Issue:**
```typescript
const NAME_REGEX = /^[\w\s\-\.一-鿿]{1,30}$/;
```
`一-鿿`（U+4E00-U+9FFF）覆盖了常用 CJK 统一表意文字，但遗漏了：
- CJK 扩展 A（U+3400-U+4DBF）
- CJK 扩展 B-F（U+20000 以上，如一些生僻字和方言用字）
- 全角标点符号（如 `。`、`，`、`「」`）

此外，未做 Unicode NFC 规范化，导致用户输入的 `é`（U+0065 U+0301，组合字符）与 `é`（U+00E9，预组合字符）被视为不同字符串，可能绕过重复名检查。

**Fix:**
1. 扩展正则或使用 Unicode property escapes（若目标浏览器支持）：`/^[\p{L}\p{N}\s\-_.]{1,30}$/u`
2. 在验证前做 NFC 规范化：`name.normalize('NFC')`

---

### WR-09: `sceneValidation.ts` 的 `SceneSchema` 对 `entities` 和 `constraints` 使用 lenient schema，但 `EntitySchema`（严格模式）未被 `validateSceneJSON` 调用

**File:** `frontend/src/utils/sceneValidation.ts:251-279, 313-374`
**Issue:**
`EntitySchema`（line 258-264）定义了严格的实体校验规则（要求 transform 组件、组件类型必须在 discriminated union 内），但 `validateSceneJSON` 内部使用的是 `_SceneEntitySchema`（line 251-254），它接受 `z.record(z.string(), z.any())`。这意味着：
- 一个实体可以完全没有 `transform` 组件而通过校验；
- 组件类型可以是任意字符串（虽然后续会被过滤）；
- `EntitySchema` 被导出但从未在核心校验流程中使用，成为死代码。

虽然 `deserializeScene` 后续会过滤未知组件，但缺少 `transform` 的实体仍会被创建，导致 `EntityRenderer` 的防御性检查（`if (!transform) return null`）触发，实体静默不渲染，用户看不到但实体存在于 ECS 中。

**Fix:**
在 `validateSceneJSON` 的 per-entity 验证阶段（line 359-371），增加对 `transform` 组件存在性的检查：
```typescript
if (!entity.components || !('transform' in entity.components)) {
  warnings.push(`实体 "${sanitizeWarning(entity.id)}" 缺少 transform 组件，已跳过`);
  // 标记该实体为无效，后续 deserializeScene 应跳过它
}
```

---

## Info

### IN-01: `SnapshotManager.test.tsx` 测试覆盖严重不足，未覆盖任何交互逻辑

**File:** `frontend/src/components/__tests__/SnapshotManager.test.tsx`
**Issue:**
现有 6 个测试用例仅验证：
1. Sheet 标题渲染
2. 输入框占位符
3. 空槽位显示
4. 保存后槽位名称显示
5. 实体计数显示
6. 保存按钮文本

缺少对以下关键交互的测试：
- 点击保存按钮后的验证逻辑（空名、非法字符、重名）
- 覆盖确认对话框的触发与确认/取消
- 加载快照按钮点击
- 重命名交互（双击、输入、Enter、Escape、失焦提交）
- 删除确认对话框
- 槽位点击 "保存到此处" 的覆盖逻辑

**Fix:**
补充交互测试，使用 `@testing-library/user-event` 模拟用户操作，覆盖上述场景。

---

### IN-02: `snapshotSlice.test.ts` 未测试 `loadSnapshot` 返回的 `SnapshotData` 中组件是否为深拷贝

**File:** `frontend/src/store/__tests__/snapshotSlice.test.ts`
**Issue:**
Test 4 验证 `loadSnapshot` 返回完整 Snapshot，但未验证 `data.entities[0].components` 是否与 store 中的原始组件解耦。如果 `serializeEntities` 做浅拷贝，修改返回的 snapshot 数据可能意外影响当前场景状态。

**Fix:**
添加测试：
```typescript
it('loadSnapshot returns deep-copied data', () => {
  // save then load
  const loaded = useSnapshotStore.getState().loadSnapshot(0);
  loaded!.data.entities[0].components.transform.position[0] = 999;
  // verify original store entity is not mutated
});
```

---

### IN-03: `sceneSerializer.test.ts` 的 roundtrip 测试未覆盖 forceField 实体

**File:** `frontend/src/utils/sceneSerializer.test.ts:206-237`
**Issue:**
Test 10 的往返测试仅包含 sphere、box 和 spring 实体，未包含 Phase 3 新增的 forceField 实体。forceField 组件在 `EntityRenderer` 中被特殊处理（返回 null），其序列化/反序列化路径与其他实体不同，应单独验证往返一致性。

**Fix:**
在 roundtrip 测试场景中添加 forceField 实体，验证序列化后 `forceField` 组件字段完整保留，反序列化后 `components.has('forceField')` 为 true。

---

### IN-04: 预设 JSON 文件 `free-fall-stack.json`、`inclined-plane.json`、`projectile.json`、`spring-oscillator.json`、`double-spring.json` 缺少 `peReferenceY` 字段

**File:** 上述 5 个预设 JSON 文件
**Issue:**
`EnvironmentState` 接口包含 `peReferenceY: number`（sceneValidation.ts:110），且 Zod schema 有默认值 `0`（line 137）。但 5 个预设文件中 `environment` 对象缺少该字段，仅 `point-charge.json` 包含。虽然 Zod `.default()` 会填充，但这意味着预设文件与最新 schema 不完全一致，未来若移除默认值会导致加载失败。

**Fix:**
为所有预设 JSON 的 `environment` 对象显式添加 `"peReferenceY": 0`。

---

### IN-05: `MenuBar.tsx` 的导入错误处理对话框未显示 warnings

**File:** `frontend/src/components/MenuBar.tsx:98-121`
**Issue:**
当 `importSceneFromFile` 返回 `success: false` 但带有 warnings 时，代码将 errors 显示在错误对话框中，但 warnings 仅通过 `addWarning` 添加到 banner。如果 banner 被用户关闭或尚未挂载，warnings 会丢失。更合理的做法是在错误对话框中同时列出 warnings。

**Fix:**
在错误对话框内容中同时渲染 warnings：
```tsx
{result.warnings.length > 0 && (
  <div className="text-sm text-yellow-500 space-y-1 py-2">
    {result.warnings.map((w, i) => <p key={`w-${i}`}>{w}</p>)}
  </div>
)}
```

---

### IN-06: `Scene3D.tsx` 的 `CameraFitter` 在 `resetCounter === 0` 时跳过，但首次加载预设后 `resetCounter` 可能仍为 0

**File:** `frontend/src/components/Scene3D.tsx:96-150`
**Issue:**
`CameraFitter` 的设计意图是 "首次挂载保留默认视角"，但 `loadSceneWithConfirm` 会调用 `store.reset()`（line 293），这会递增 `resetCounter`。然而如果用户通过其他路径加载场景（如直接反序列化而不走 `loadSceneWithConfirm`），`resetCounter` 可能不递增，导致 `CameraFitter` 不触发，摄像机不自适应。

这不是当前代码路径的问题（所有加载都走 `loadSceneWithConfirm`），但如果未来添加新入口（如 URL 参数加载），会引入不一致。

**Fix:**
在 `loadSceneWithConfirm` 的文档注释中明确说明："调用方必须确保 `resetCounter` 已递增，否则 CameraFitter 不会触发"。或者将摄像机自适应逻辑与 `resetCounter` 解耦，改为监听 `entities` Map 的变化。

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
