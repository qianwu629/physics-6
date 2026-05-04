# Phase 1: 持久化与场景库 - Research

**Researched:** 2026-05-04
**Domain:** 前端持久化 (JSON 序列化/反序列化、localStorage、文件下载/上传)、React UI 组件 (MenuBar、Drawer、Dialog)、Zustand 状态管理、Three.js 摄像机控制、Vitest 测试修复
**Confidence:** HIGH

## Summary

Phase 1 的核心技术域是**前端持久化层**——将 ECS 场景状态（实体、组件、约束、环境参数）序列化为 JSON，支持文件导出/导入、localStorage 快照槽位、以及内置预设场景库。所有功能均在前端完成，不依赖后端服务。

本阶段的关键技术决策已在前序 `/gsd-discuss-phase` 中全部锁定（9/9）。研究重点在于：验证锁定决策的技术可行性、识别标准实现模式、以及发现已知的测试基础设施缺陷（DEBT-04）。

**Primary recommendation:** 使用原生浏览器 API (`<a download>`、`<input type="file">`、localStorage) 完成全部持久化功能，Zustand `persist` 中间件管理快照状态，Zod 做 Schema 校验，shadcn/ui Sheet + DropdownMenu 构建 UI。不需要引入任何新的 npm 依赖。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 场景序列化/反序列化 | Browser / Client | — | 纯数据转换，无服务端参与；JSON 在浏览器内存中生成和消费 |
| 文件导出 (下载) | Browser / Client | — | `<a download>` 原生 API，完全客户端 |
| 文件导入 (上传) | Browser / Client | — | `<input type="file">` + FileReader，完全客户端 |
| 快照持久化 | Browser / Client | — | localStorage 是浏览器存储 API |
| 预设场景库 | Browser / Client | — | JSON 静态资源打包到前端 bundle |
| 加载确认/暂停/重置 | Browser / Client | — | Zustand store 状态变更 + React UI 反馈 |
| 摄像机自适应 | Browser / Client | — | Three.js OrbitControls + Box3 计算 bounding box |
| Schema 校验 | Browser / Client | — | Zod 在客户端运行 |
| 错误处理 (Modal/Toast/Banner) | Browser / Client | — | Sonner Toast + shadcn Dialog，纯 UI 层 |
| 测试修复 (DEBT-04) | Browser / Client | — | Vitest + jsdom 环境，补充 three.js mock |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **D-01-01 — JSON Schema 保存范围：最小集**
   - 只保存核心仿真数据（environment、entities、constraints），不保存可视化/UI/摄像机状态
   - Schema 结构含 `schemaVersion: "1.0"`、`savedAt`、以及 `simulation` 对象

2. **D-01-02 — schemaVersion 不匹配：尝试加载 + 警告**
   - 不直接拒绝，采用宽容加载模式：顶部黄色 banner 警告，未知字段忽略，缺失字段用默认值

3. **D-01-03 — 加载前确认 + 强制暂停 + 清空 trail**
   - 弹出确认对话框 → 暂停仿真 → 重置时间 → 清空轨迹 → 摄像机回到默认位置

4. **D-01-04 — 入口形态：顶部菜单栏 File 风格**
   - [文件 ▾] [视图 ▾] [帮助 ▾] 下拉菜单结构
   - 导出/导入直接暴露，快照/预设放二级入口

5. **D-01-05 — 快照面板：右侧滑出 Drawer**
   - 使用 Sheet 组件（side="right"），快照数据持久化到 localStorage，键名 `physis-snapshot-{slotIndex}`

6. **D-01-06 — 快照命名：用户输入 + 不允许重名 + 可重命名**
   - 名称正则：`^[\w\s\-\.一-龥]{1,30}$`
   - 覆盖前二次确认

7. **D-01-07 — 内置预设场景：5 个 v1.0 能力 + 第 6 个推迟**
   - 抛体运动、斜面滑块、自由落体堆叠、弹簧振子、双弹簧链
   - 点电荷力场示例 → Phase 3

8. **D-01-08 — 错误处理：分级响应**
   - JSON 语法错/文件 > 5MB → Modal 拒绝
   - schemaVersion 不匹配 → banner 警告 + 尽力加载
   - localStorage 配额满 → Toast 提示
   - 约束 entityId 引用失效 → 跳过 + 提示
   - 槽位损坏 → Modal 确认清除

9. **D-01-09 — DEBT-04 范围：修复 Scene3D 测试 + 补 Phase 4 验证文档**
   - 修复 `Scene3D.test.tsx` 9 个 baseline 失败（Vector3 mock 缺失）
   - 补回 `.planning/milestones/v1.0-phases/04-轨迹与矢量可视化/04-VERIFICATION.md`
   - 不做全面 mock 重写

### Claude's Discretion
无 — 所有决策均已锁定。

### Deferred Ideas (OUT OF SCOPE)
- 自动保存 / 历史版本
- 云端同步
- 场景分享链接
- 摄像机/UI 状态持久化
- 点电荷力场预设（Phase 3 依赖）
- 全面 mock 体系重写
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERSIST-01 | 用户可以将当前场景导出为 JSON 文件下载到本地 | 原生 `<a download>` API + JSON.stringify；无需额外库 [VERIFIED: MDN] |
| PERSIST-02 | 用户可以从本地选择 JSON 文件加载到场景中，原场景被替换；加载后处于暂停状态 | `<input type="file" accept=".json">` + FileReader；Zustand store 批量更新 [VERIFIED: MDN] |
| PERSIST-03 | 用户可以将场景保存到浏览器 localStorage（命名快照，至少 5 个槽位），并从快照列表恢复 | Zustand `persist` 中间件支持 `partialize`、`version`、`migrate`、`onRehydrateStorage` [VERIFIED: Context7 /pmndrs/zustand] |
| PERSIST-04 | 系统提供至少 6 个内置预设场景，可一键加载 | 5 个预设 JSON 文件打包到 `src/presets/*.json`，共享导入加载器；第 6 个推迟到 Phase 3 [CITED: D-01-07] |
| DEBT-04 | 修复 Scene3D.test.tsx 9 个 baseline 失败用例，补回 Phase 4 VERIFICATION.md | Root cause: `vi.mock('three')` 缺少 Vector3/Quaternion/Euler 导出；VectorRenderer.tsx 在模块级实例化 `new Vector3(0,1,0)` [VERIFIED: 代码库分析] |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.12 (installed: 5.0.5) | 全局状态管理 | 项目已采用；`persist` 中间件内置，支持 localStorage、partialize、version、migrate [VERIFIED: Context7 /pmndrs/zustand] |
| three | 0.184.0 (installed: 0.174.0) | 3D 引擎 | 项目已采用；Box3/Vector3/PerspectiveCamera 用于摄像机自适应 [VERIFIED: Context7 /mrdoob/three.js] |
| zod | 4.4.3 (installed: 4.4.1) | Schema 校验 | 项目已采用；用于 JSON 导入时的结构验证 [VERIFIED: package.json] |
| sonner | 2.0.7 | Toast 通知 | 项目已采用；用于配额满等轻量错误提示 [VERIFIED: package.json] |
| radix-ui | 1.4.3 | Headless UI 基元 | 项目已采用；DropdownMenu、Sheet、Dialog 均基于此 [VERIFIED: package.json] |
| @react-three/fiber | 9.6.1 (installed: 9.1.0) | React Three.js 渲染器 | 项目已采用；提供 Canvas 和 useThree hook [VERIFIED: package.json] |
| @react-three/drei | 10.7.7 (installed: 10.7.0) | R3F 辅助组件 | 项目已采用；OrbitControls 用于摄像机控制 [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.487.0 | 图标库 | MenuBar、快照面板、预设选择器中的图标 [VERIFIED: package.json] |
| tailwindcss | 4.1.0 | CSS 工具类 | UI 样式（已配置 Vite 插件） [VERIFIED: package.json] |
| vitest | 4.1.5 | 测试框架 | DEBT-04 修复；jsdom 环境 [VERIFIED: package.json] |
| @testing-library/react | 16.3.2 | React 测试工具 | 组件渲染测试 [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist | localStorage 原生 API | Zustand persist 提供类型安全、版本迁移、partialize，与 store 架构一致；原生 API 需手动处理序列化和同步 |
| `<a download>` | FileSaver.js | FileSaver.js 对旧版浏览器兼容更好，但现代浏览器均支持 `<a download>`，无需额外依赖 [VERIFIED: caniuse.com] |
| Zod | JSON Schema + ajv | Zod 已在项目中使用，类型推断更自然；ajv 需要额外学习成本和运行时体积 |

**Installation:** 无需安装新依赖。所有需要的库已在 `package.json` 中。

**Version verification:**
- zustand: 5.0.12 (registry) vs 5.0.5 (installed) — 差距较小，persist API 无变化 [VERIFIED: npm registry]
- three: 0.184.0 (registry) vs 0.174.0 (installed) — OrbitControls/Box3 API 稳定 [VERIFIED: npm registry]
- zod: 4.4.3 (registry) vs 4.4.1 (installed) — 兼容 [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Interaction                           │
│  [MenuBar] ──► [DropdownMenu] ──► Export / Import / Snapshots / Presets│
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────┐    ┌──────────┐    ┌──────────────┐
            │  Export  │    │  Import  │    │  Snapshot    │
            │  Handler │    │  Handler │    │  Manager     │
            └────┬─────┘    └────┬─────┘    └──────┬───────┘
                 │               │                  │
                 ▼               ▼                  ▼
            ┌──────────┐    ┌──────────┐    ┌──────────────┐
            │ JSON     │    │ File     │    │ localStorage │
            │ Download │    │ Reader   │    │ (5 slots)    │
            │ <a dl>   │    │ + Zod    │    │              │
            └──────────┘    └────┬─────┘    └──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌────────┐  ┌──────────┐  ┌──────────┐
              │ Confirm│  │ Schema   │  │ Load into│
              │ Dialog │  │ Validate │  │ Store    │
              └────────┘  └──────────┘  └──────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌────────┐  ┌──────────┐  ┌──────────┐
              │ Pause  │  │ Reset    │  │ Camera   │
              │ sim    │  │ trails   │  │ fit      │
              └────────┘  └──────────┘  └──────────┘
```

### Recommended Project Structure

```
frontend/src/
├── components/
│   ├── ui/                    # shadcn/ui 组件 (已存在)
│   │   ├── dropdown-menu.tsx  # MenuBar 下拉菜单
│   │   ├── sheet.tsx          # 快照 Drawer
│   │   ├── dialog.tsx         # 确认/错误弹窗
│   │   └── sonner.tsx         # Toast 通知
│   ├── MenuBar.tsx            # [NEW] 顶部菜单栏
│   ├── SnapshotManager.tsx    # [NEW] 快照管理面板 (内嵌于 Sheet)
│   ├── PresetSelector.tsx     # [NEW] 预设场景选择器 (Dialog)
│   ├── SceneLoader.tsx        # [NEW] 导入/加载逻辑封装
│   └── App.tsx                # [MODIFY] 添加 MenuBar
├── store/
│   ├── index.ts               # [MODIFY] 整合 snapshot slice
│   ├── simulationSlice.ts     # [MODIFY] 添加 loadScene action
│   ├── entitySlice.ts         # [MODIFY] 添加批量实体加载
│   └── snapshotSlice.ts       # [NEW] 快照状态 + persist 中间件
├── ecs/
│   ├── types.ts               # [MODIFY] 添加序列化辅助类型
│   ├── Entity.ts              # [MODIFY] 添加从 JSON 反序列化工厂
│   └── TrajectoryBuffer.ts    # [MODIFY] 添加 clear() (已存在)
├── presets/
│   ├── projectile.json        # [NEW] 抛体运动
│   ├── inclined-plane.json    # [NEW] 斜面滑块
│   ├── free-fall-stack.json   # [NEW] 自由落体堆叠
│   ├── spring-oscillator.json # [NEW] 弹簧振子
│   └── double-spring.json     # [NEW] 双弹簧链
├── utils/
│   └── sceneSerializer.ts     # [NEW] 序列化/反序列化核心逻辑
│   └── sceneValidation.ts     # [NEW] Zod Schema + 校验函数
└── components/__tests__/
    └── Scene3D.test.tsx       # [MODIFY] 补充 three.js mock
```

### Pattern 1: Zustand Persist for Snapshots
**What:** 使用 Zustand `persist` 中间件将快照状态自动同步到 localStorage，支持版本控制和状态迁移。
**When to use:** 任何需要跨会话持久化的客户端状态。
**Example:**
```typescript
// Source: Context7 /pmndrs/zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Snapshot {
  name: string;
  createdAt: string;
  data: SceneData;
}

interface SnapshotSlice {
  slots: (Snapshot | null)[];
  saveSnapshot: (slotIndex: number, name: string, data: SceneData) => void;
  loadSnapshot: (slotIndex: number) => Snapshot | null;
  renameSnapshot: (slotIndex: number, newName: string) => void;
  deleteSnapshot: (slotIndex: number) => void;
}

export const useSnapshotStore = create<SnapshotSlice>()(
  persist(
    (set, get) => ({
      slots: Array(5).fill(null),
      saveSnapshot: (slotIndex, name, data) => {
        set((state) => {
          const next = [...state.slots];
          next[slotIndex] = { name, createdAt: new Date().toISOString(), data };
          return { slots: next };
        });
      },
      // ... other actions
    }),
    {
      name: 'physis-snapshots',
      partialize: (state) => ({ slots: state.slots }),
      version: 1,
      migrate: (persistedState: any, version) => {
        if (version === 0) {
          // 迁移逻辑
        }
        return persistedState;
      },
    }
  )
);
```

### Pattern 2: 宽容 JSON 加载 (Graceful Degradation)
**What:** 遇到 schemaVersion 不匹配或未知字段时，不阻断加载流程，而是记录警告并尽力恢复。
**When to use:** 用户可能跨版本共享场景文件的场景。
**Example:**
```typescript
// Source: D-01-02 决策 + Zod safeParse 模式
import { z } from 'zod';

const SceneSchema = z.object({
  schemaVersion: z.string(),
  savedAt: z.string().datetime().optional(),
  simulation: z.object({
    environment: z.object({
      gravity: z.tuple([z.number(), z.number(), z.number()]),
      frictionScale: z.number().default(1.0),
      restitutionScale: z.number().default(1.0),
      drag: z.number().default(0.1),
    }).default({ gravity: [0, -9.81, 0], frictionScale: 1, restitutionScale: 1, drag: 0.1 }),
    entities: z.array(EntitySchema).default([]),
    constraints: z.array(ConstraintSchema).default([]),
  }),
});

function loadSceneWithGrace(json: unknown): { success: boolean; data?: SceneData; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. 检查 schemaVersion
  const version = (json as any)?.schemaVersion;
  if (version !== '1.0') {
    warnings.push(`schemaVersion 不匹配: 期望 "1.0"，得到 "${version}"，将尽力加载`);
  }

  // 2. Zod 安全解析
  const result = SceneSchema.safeParse(json);
  if (!result.success) {
    // 过滤掉未知字段相关的错误，只报告结构性错误
    const structuralErrors = result.error.issues.filter(i => i.code !== 'unrecognized_keys');
    if (structuralErrors.length > 0) {
      errors.push(...structuralErrors.map(e => e.message));
      return { success: false, warnings, errors };
    }
  }

  // 3. 过滤未知字段
  const knownKeys = ['schemaVersion', 'savedAt', 'simulation'];
  const unknownKeys = Object.keys(json as object).filter(k => !knownKeys.includes(k));
  if (unknownKeys.length > 0) {
    warnings.push(`忽略未知字段: ${unknownKeys.join(', ')}`);
  }

  return { success: true, data: result.data, warnings, errors };
}
```

### Pattern 3: 加载流程包装器
**What:** 统一封装加载前确认、暂停、清空轨迹、自适应摄像机的完整流程。
**When to use:** 导入文件、加载快照、加载预设三个入口共享同一流程。
**Example:**
```typescript
// Source: D-01-03 决策
async function loadSceneWithConfirm(sceneData: SceneData): Promise<boolean> {
  // 1. 确认对话框
  const confirmed = await showConfirmDialog('加载将替换当前场景，继续？');
  if (!confirmed) return false;

  // 2. 暂停 + 重置
  const store = useSimulationStore.getState();
  store.pause();
  store.reset(); // 递增 resetCounter

  // 3. 清空轨迹
  trajectoryBuffer.clear();

  // 4. 反序列化到 store
  store.resetEntities();
  for (const entity of sceneData.simulation.entities) {
    store.addEntity(deserializeEntity(entity));
  }

  // 5. 设置环境参数
  store.setGravity(sceneData.simulation.environment.gravity);
  // ... 其他环境参数

  // 6. 摄像机自适应 (通过 ref 或事件触发)
  // 在 Scene3D 中监听 resetCounter 变化，自动调用 fitCameraToScene()

  return true;
}
```

### Pattern 4: 摄像机自适应 Bounding Box
**What:** 根据场景中所有实体的位置计算包围盒，调整摄像机位置和 OrbitControls target。
**When to use:** 加载新场景后，让用户一眼看到完整场景。
**Example:**
```typescript
// Source: Context7 /mrdoob/three.js (Box3 + OrbitControls)
import { Box3, Vector3, PerspectiveCamera } from 'three';
import { OrbitControls } from '@react-three/drei';

function fitCameraToScene(camera: PerspectiveCamera, controls: OrbitControls, entityPositions: Vector3[]) {
  const box = new Box3();
  
  // 如果没有实体，使用默认视角
  if (entityPositions.length === 0) {
    camera.position.set(12, 10, 12);
    controls.target.set(0, 2, 0);
    controls.update();
    return;
  }

  // 从实体位置构建包围盒
  for (const pos of entityPositions) {
    box.expandByPoint(pos);
  }

  const center = new Vector3();
  box.getCenter(center);
  const size = new Vector3();
  box.getSize(size);

  // 计算合适的摄像机距离
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) * 1.5; // 1.5x 边距

  camera.position.set(
    center.x + cameraDistance,
    center.y + cameraDistance * 0.8,
    center.z + cameraDistance
  );
  controls.target.copy(center);
  controls.update();
}
```

### Anti-Patterns to Avoid
- **在 persist 中序列化 Map 不加处理：** Zustand persist 默认使用 JSON.stringify，Map 会被序列化为 `{}`。必须使用 `partialize` 将 Map 转换为 Array 或普通对象，或在 `storage` 中提供自定义 replacer/reviver。[CITED: Context7 /pmndrs/zustand]
- **在加载流程中直接修改 store 的 entities Map：** 必须通过 Zustand 的 `set` 函数触发不可变更新，否则 React 不会重新渲染。[CITED: 项目代码库 entitySlice.ts]
- **忽略 FileReader 的异步错误：** 文件读取可能因权限、编码等问题失败，必须用 try/catch 包裹并给用户反馈。[ASSUMED]
- **在模块级实例化 three.js 对象而不在测试中 mock：** VectorRenderer.tsx 的 `const DEFAULT_UP = new Vector3(0, 1, 0)` 在导入时即执行，如果测试 mock 不完整会导致所有依赖该模块的测试失败。[VERIFIED: 代码库分析]
- **使用 localStorage 存储大文件而不检查配额：** 5MB 是常见限制，需捕获 `QuotaExceededError` 并引导用户清理。[ASSUMED]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 状态持久化到 localStorage | 手写 localStorage.getItem/setItem + JSON.parse/stringify | Zustand `persist` 中间件 | 内置版本控制、迁移、partialize、hydration 状态追踪；类型安全 [VERIFIED: Context7] |
| JSON Schema 校验 | 手写递归校验函数 | Zod | 类型推断、详细错误信息、默认值、安全解析模式；已在项目中使用 [VERIFIED: package.json] |
| 文件下载 | 手写 Blob + URL.createObjectURL + 清理 | 原生 `<a download>` | 现代浏览器均支持，代码量极少，无需库 [VERIFIED: MDN] |
| 下拉菜单 UI | 手写 CSS + 键盘导航 | radix-ui DropdownMenu (shadcn/ui 封装) | 已集成到项目；完整的 ARIA 支持、键盘导航、焦点管理 [VERIFIED: 代码库] |
| 侧滑抽屉 UI | 手写 CSS transform + 遮罩 | radix-ui Sheet (shadcn/ui 封装) | 已集成到项目；动画、焦点陷阱、滚动锁定、无障碍 [VERIFIED: 代码库] |
| Toast 通知 | 手写定时器 + DOM 操作 | Sonner | 已集成到项目；堆叠、自动关闭、进度条、主题适配 [VERIFIED: 代码库] |
| 确认对话框 | 手写 alert/confirm | shadcn/ui Dialog | 已集成到项目；可定制样式、不阻塞主线程、支持复杂内容 [VERIFIED: 代码库] |

**Key insight:** Phase 1 的所有 UI 和持久化需求，项目现有技术栈已 100% 覆盖。不需要引入任何新库。唯一需要"手写"的是业务逻辑层（序列化/反序列化、加载流程协调、预设数据构造）。

---

## Runtime State Inventory

本阶段涉及**字符串/标识符变更**：`physis-scene-{timestamp}.json` 导出文件名、`physis-snapshot-{slotIndex}` localStorage 键名。经审计，无以下运行时状态需要迁移：

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — 当前无 localStorage 使用（persist 中间件尚未配置） | 无需迁移 |
| Live service config | None — 无外部服务配置 | 无需迁移 |
| OS-registered state | None — 无 OS 级注册 | 无需迁移 |
| Secrets/env vars | None — 无相关密钥 | 无需迁移 |
| Build artifacts | None — 无预设目录或快照相关构建产物 | 无需迁移 |

**说明：** Phase 1 是新增功能阶段，不涉及重命名或重构现有运行时状态。localStorage 键名 `physis-snapshot-{slotIndex}` 是全新的。

---

## Common Pitfalls

### Pitfall 1: Zustand Persist 中 Map 的序列化丢失
**What goes wrong:** `entities` 是 `Map<string, Entity>`，直接 persist 会导致 JSON 序列化为 `{}`，反序列化后丢失所有实体数据。
**Why it happens:** JSON.stringify 不支持 Map 类型。
**How to avoid:** 在 `partialize` 中将 Map 转为 Array：`entities: Array.from(state.entities.entries())`。反序列化时在 `onRehydrateStorage` 或初始化逻辑中转回 Map。或者，快照 slice 单独 persist，不包含 entities Map（推荐：快照数据结构与运行时 store 分离）。
**Warning signs:** 刷新页面后快照数据消失或变为空对象。

### Pitfall 2: 模块级 three.js 对象实例化导致测试失败
**What goes wrong:** `VectorRenderer.tsx` 第 20 行 `const DEFAULT_UP = new Vector3(0, 1, 0)` 在模块加载时执行。如果测试中的 `vi.mock('three')` 未导出 Vector3 构造函数，导入 VectorRenderer 会立即抛出错误。
**Why it happens:** Vitest 的模块 mock 在导入时生效，但模块级代码在导入阶段执行，早于测试体。
**How to avoid:** 补充 mock 导出：在 `Scene3D.test.tsx` 的 `vi.mock('three', ...)` 中添加 `Vector3: vi.fn((x,y,z) => ({x,y,z}))`、`Quaternion: vi.fn()`、`Euler: vi.fn()`。同时需要 mock `CylinderGeometry`、`ConeGeometry`、`MeshBasicMaterial`、`Mesh`。
**Warning signs:** 测试失败信息为 `[vitest] No "Vector3" export is defined on the "three" mock`。

### Pitfall 3: 加载场景后 OrbitControls 未更新
**What goes wrong:** 通过 ref 修改 `camera.position` 和 `controls.target` 后，场景摄像机未变化。
**Why it happens:** OrbitControls 内部有状态缓存，直接修改 target 后需要调用 `controls.update()` 才能生效。
**How to avoid:** 修改 target 和 position 后，始终调用 `controls.update()`。在 R3F 中，通过 `useThree()` 获取 camera 和 controls ref，或使用 `@react-three/drei` 的 `useFrame` 在下一帧更新。
**Warning signs:** 加载场景后摄像机位置未变，或场景"消失"（摄像机指向错误方向）。

### Pitfall 4: localStorage 配额超限静默失败
**What goes wrong:** 快照保存时无错误提示，但刷新页面后数据丢失。
**Why it happens:** `localStorage.setItem` 在配额超限时抛出 `QuotaExceededError`，但如果不捕获，错误会静默吞没。
**How to avoid:** 所有 localStorage 写操作包裹 try/catch，捕获 `QuotaExceededError` 时显示 Sonner Toast 提示用户删除旧快照。
**Warning signs:** 保存快照后刷新页面，槽位显示为空或旧数据。

### Pitfall 5: 导入 JSON 时执行恶意代码
**What goes wrong:** 用户上传的 JSON 可能包含 `__proto__`、`constructor` 等污染字段，或利用 reviver 函数执行代码。
**Why it happens:** `JSON.parse` 本身安全，但后续的对象遍历或赋值可能触发原型链污染。
**How to avoid：**
1. 限制文件大小 < 5MB（D-01-08）
2. 使用 Zod 校验，只提取已知字段
3. 不使用 `JSON.parse(text, reviver)` 的 reviver 函数执行动态逻辑
4. 对象创建时使用 `Object.create(null)` 或仅赋值到已知字段
**Warning signs：** 异常大的 JSON 文件、包含非仿真相关字段的文件。

### Pitfall 6: 加载流程中遗漏轨迹清空
**What goes wrong：** 加载新场景后，旧场景的轨迹线仍然显示在画面上。
**Why it happens：** TrajectoryBuffer 是独立于 Zustand store 的类实例，resetCounter 变化不会自动清空它。
**How to avoid：** 在 `loadSceneWithConfirm` 中显式调用 `trajectoryBuffer.clear()`，并确保所有加载入口（导入、快照、预设）都走同一包装函数。
**Warning signs：** 加载新场景后，画面上出现不属于当前实体的轨迹线。

---

## Code Examples

### 1. Scene3D.test.tsx 补充 three.js mock
```typescript
// Source: 代码库分析 + Context7 /mrdoob/three.js
// 修复 DEBT-04：补充 Vector3/Quaternion/Euler/Geometry/Material/Mesh mock

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    ACESFilmicToneMapping: 4,
    Vector3: vi.fn((x = 0, y = 0, z = 0) => ({ x, y, z, clone: vi.fn(function() { return this; }), normalize: vi.fn(function() { return this; }), length: vi.fn(() => 1) })),
    Quaternion: vi.fn(() => ({ setFromUnitVectors: vi.fn(function() { return this; }), copy: vi.fn() })),
    Euler: vi.fn((x = 0, y = 0, z = 0, order = 'XYZ') => ({ x, y, z, order })),
    CylinderGeometry: vi.fn(function() { this.type = 'CylinderGeometry'; }),
    ConeGeometry: vi.fn(function() { this.type = 'ConeGeometry'; }),
    MeshBasicMaterial: vi.fn(function() { this.type = 'MeshBasicMaterial'; }),
    Mesh: vi.fn(function() { this.type = 'Mesh'; this.add = vi.fn(); this.removeFromParent = vi.fn(); }),
    Group: vi.fn(function() { this.type = 'Group'; this.add = vi.fn(); this.removeFromParent = vi.fn(); }),
  };
});
```

### 2. Zustand Persist 快照 Slice
```typescript
// Source: Context7 /pmndrs/zustand + 项目代码模式
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Snapshot {
  name: string;
  createdAt: string;
  entityCount: number;
  data: {
    environment: EnvironmentState;
    entities: Array<[string, Entity]>; // Map 转 Array
    constraints: Array<[string, Entity]>;
  };
}

export const useSnapshotStore = create<{
  slots: (Snapshot | null)[];
  saveSnapshot: (slotIndex: number, name: string, store: SimulationStore) => void;
  loadSnapshot: (slotIndex: number) => Snapshot | null;
  renameSnapshot: (slotIndex: number, newName: string) => void;
  deleteSnapshot: (slotIndex: number) => void;
}>()(
  persist(
    (set, get) => ({
      slots: Array(5).fill(null),
      saveSnapshot: (slotIndex, name, store) => {
        const snapshot: Snapshot = {
          name,
          createdAt: new Date().toISOString(),
          entityCount: store.entities.size,
          data: {
            environment: store.environment,
            entities: Array.from(store.entities.entries()),
            constraints: [], // 约束实体已包含在 entities 中
          },
        };
        set((state) => {
          const next = [...state.slots];
          next[slotIndex] = snapshot;
          return { slots: next };
        });
      },
      loadSnapshot: (slotIndex) => get().slots[slotIndex],
      renameSnapshot: (slotIndex, newName) => {
        set((state) => {
          const slot = state.slots[slotIndex];
          if (!slot) return state;
          const next = [...state.slots];
          next[slotIndex] = { ...slot, name: newName };
          return { slots: next };
        });
      },
      deleteSnapshot: (slotIndex) => {
        set((state) => {
          const next = [...state.slots];
          next[slotIndex] = null;
          return { slots: next };
        });
      },
    }),
    {
      name: 'physis-snapshots',
      partialize: (state) => ({ slots: state.slots }),
    }
  )
);
```

### 3. 文件导出 (下载)
```typescript
// Source: MDN + D-01-04 决策
function exportScene(sceneData: SceneData): void {
  const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `physis-scene-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### 4. 文件导入 (上传)
```typescript
// Source: MDN + D-01-04 决策
function importSceneFromFile(file: File): Promise<SceneData> {
  return new Promise((resolve, reject) => {
    // 文件大小检查 (D-01-08)
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('文件大小超过 5MB 限制'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        resolve(json);
      } catch (err) {
        reject(new Error('JSON 解析失败：' + (err as Error).message));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
```

### 5. 预设场景数据结构
```typescript
// Source: D-01-07 决策 + Entity.ts 工厂函数
// presets/projectile.json
{
  "schemaVersion": "1.0",
  "savedAt": "2026-05-04T00:00:00Z",
  "simulation": {
    "environment": {
      "gravity": [0, -9.81, 0],
      "frictionScale": 1.0,
      "restitutionScale": 1.0,
      "drag": 0.1
    },
    "entities": [
      {
        "id": "sphere-1",
        "name": "球体-1",
        "components": {
          "transform": { "type": "transform", "position": [0, 5, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] },
          "rigidBody": { "type": "rigidBody", "kind": "dynamic", "mass": 1, "restitution": 0.5, "friction": 0.3 },
          "collider": { "type": "collider", "shape": "sphere", "params": { "radius": 0.5 } },
          "material": { "type": "material", "color": "#3b82f6", "roughness": 0.6, "metalness": 0.1 },
          "velocity": { "type": "velocity", "linearVelocity": [5, 8, 0], "angularVelocity": [0, 0, 0] },
          "trail": { "type": "trail", "visible": true },
          "vector": { "type": "vector", "showVelocity": true, "showForces": true }
        }
      }
    ],
    "constraints": []
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux + redux-persist | Zustand + persist middleware | v1.0 Phase 1 | 更少的样板代码，内置 TypeScript 支持，与 React 19 兼容 [VERIFIED: 项目历史] |
| shadcn/ui v3 (class-variance-authority + tailwind-merge) | shadcn/ui v4 (radix-nova, Tailwind v4) | v1.0 Phase 1 | CSS @layer 架构，@import 顺序敏感 [VERIFIED: STATE.md] |
| @react-three/fiber v8 + @react-three/drei v9 | @react-three/fiber v9 + @react-three/drei v10 | v1.0 Phase 1 | React 19 兼容，peer dep 调整 [VERIFIED: STATE.md] |
| 硬编码 INITIAL_SCENE_OBJECTS | ECS 驱动空场景 | v1.0 Phase 2 | 场景完全由用户/数据驱动，支持序列化 [VERIFIED: 代码库] |

**Deprecated/outdated:**
- 无 — 项目技术栈均为当前稳定版本。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 现代浏览器均支持 `<a download>` 和 `<input type="file">` API | Standard Stack | 如果用户仍在使用 IE11，文件下载/上传会失败；但项目目标用户为教育/物理实验场景，现代浏览器假设合理 |
| A2 | localStorage 配额 >= 5MB（5 槽位 x ~200KB） | Runtime State Inventory | 如果浏览器处于隐私模式或配额被其他应用占满，快照保存会失败；D-01-08 已规划 QuotaExceededError 处理 |
| A3 | 预设场景 JSON 的 schemaVersion 与导出/导入共用同一份 "1.0" | Pattern 5 | 如果后续 schema 演进，预设文件需要同步更新；CI 中应增加预设 JSON 语法校验 |
| A4 | `vi.mock('three', ...)` 中补充 Vector3/Quaternion/Euler/CylinderGeometry/ConeGeometry/MeshBasicMaterial/Mesh/Group 的 mock 即可修复 9 个测试失败 | Common Pitfalls #2 | 如果 VectorRenderer 还依赖其他 three.js 导出，可能需要补充更多 mock；但代码审查显示仅使用这些类 |

---

## Open Questions (RESOLVED)

1. **摄像机自适应的具体触发时机** → RESOLVED by 01-05 T2
   - Decision: 在 Scene3D 中添加 `useEffect(() => { fitCamera(); }, [resetCounter])`，保持加载逻辑与渲染逻辑解耦
   
2. **预设场景的 JSON 序列化格式** → RESOLVED by 01-01 T1
   - Decision: 使用对象格式 `Record<ComponentType, Component>`（键为 ComponentType），与 Map 语义更接近，反序列化时 `new Map(Object.entries(components))`

3. **快照数据与运行时 store 的实体数据是否共享同一序列化函数** → RESOLVED by 01-02 T1
   - Decision: 快照也遵循 D-01-01 最小集原则，不保存 trail/vector visible 状态；反序列化时默认附加 trail/vector 组件（如 Entity.ts 工厂函数所做）

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建 + 测试 | 是 | (隐含) | — |
| npm | 包管理 | 是 | (隐含) | — |
| Vite | 构建工具 | 是 | 6.3.0 | — |
| Vitest | 测试运行 | 是 | 4.1.5 | — |
| jsdom | 测试环境 | 是 | 29.1.1 | — |
| 浏览器 localStorage | 快照持久化 | 是 | — | 无 — 核心功能依赖 |
| 浏览器 File API | 导入/导出 | 是 | — | 无 — 核心功能依赖 |

**Missing dependencies with no fallback:** 无。

**Missing dependencies with fallback:** 无。

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + jsdom 29.1.1 + @testing-library/react 16.3.2 |
| Config file | `vite.config.ts` (test 字段) |
| Quick run command | `npx vitest run src/components/Scene3D.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERSIST-01 | 导出场景下载合法 JSON | unit | `npx vitest run src/utils/sceneSerializer.test.ts` | 否 — Wave 0 需创建 |
| PERSIST-02 | 导入 JSON 正确加载场景 | unit | `npx vitest run src/utils/sceneValidation.test.ts` | 否 — Wave 0 需创建 |
| PERSIST-02 | 加载前确认对话框弹出 | integration | `npx vitest run src/components/SceneLoader.test.tsx` | 否 — Wave 0 需创建 |
| PERSIST-03 | 快照保存到 localStorage | unit | `npx vitest run src/store/snapshotSlice.test.ts` | 否 — Wave 0 需创建 |
| PERSIST-03 | 快照从 localStorage 恢复 | unit | `npx vitest run src/store/snapshotSlice.test.ts` | 否 — Wave 0 需创建 |
| PERSIST-04 | 预设场景 JSON 语法有效 | unit | `npx vitest run src/presets/presets.test.ts` | 否 — Wave 0 需创建 |
| DEBT-04 | Scene3D.test.tsx 全部通过 | unit | `npx vitest run src/components/Scene3D.test.tsx` | 是 — 需修复 |
| DEBT-04 | Phase 4 VERIFICATION.md 存在 | manual | 文件系统检查 | 否 — 需创建 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/sceneSerializer.test.ts` — 序列化/反序列化单元测试
- [ ] `src/utils/sceneValidation.test.ts` — Zod Schema 校验测试
- [ ] `src/store/snapshotSlice.test.ts` — 快照 CRUD + persist 测试
- [ ] `src/presets/presets.test.ts` — 预设 JSON 有效性测试
- [ ] `src/components/MenuBar.test.tsx` — MenuBar 渲染 + 交互测试
- [ ] `src/components/SnapshotManager.test.tsx` — 快照面板交互测试
- [ ] `src/components/Scene3D.test.tsx` — 修复 9 个失败用例（DEBT-04）
- [ ] `.planning/milestones/v1.0-phases/04-轨迹与矢量可视化/04-VERIFICATION.md` — 补写验证文档

*(如果无 gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 否 | 无用户认证 |
| V3 Session Management | 否 | 无服务端会话 |
| V4 Access Control | 否 | 纯客户端应用 |
| V5 Input Validation | 是 | Zod Schema 校验 + 文件大小限制 (< 5MB) + 仅解析已知字段 |
| V6 Cryptography | 否 | 无加密需求 |
| V7 Error Handling | 是 | 分级错误响应 (Modal/Toast/Banner)，不暴露内部堆栈 |
| V12 File Upload | 是 | 限制文件类型 (.json)、文件大小 (< 5MB)、客户端解析不执行 |

### Known Threat Patterns for 前端持久化栈

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 原型链污染 (Prototype Pollution via JSON) | Tampering | 使用 Zod 校验后只提取已知字段，不直接展开用户输入对象 |
| 大文件 DoS | Denial of Service | 文件大小限制 5MB，FileReader 在客户端处理 |
| 恶意 JSON 执行 | Execution | 仅使用 JSON.parse，不执行任何代码；Zod 过滤未知字段 |
| localStorage XSS | Tampering | 数据仅用于场景恢复，不插入 DOM；如有需要，使用 textContent 而非 innerHTML |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/pmndrs/zustand` — persist middleware API (partialize, version, migrate, onRehydrateStorage, skipHydration, createJSONStorage, StateStorage)
- Context7 `/mrdoob/three.js` — Vector3, Quaternion, Euler, Box3 (setFromObject, getCenter, getSize), PerspectiveCamera, OrbitControls (reset, saveState), Mesh, CylinderGeometry, ConeGeometry, MeshBasicMaterial
- 代码库 `frontend/package.json` — 依赖版本确认
- 代码库 `frontend/src/components/Scene3D.test.tsx` — 测试失败根因分析
- 代码库 `frontend/src/components/VectorRenderer.tsx` — 模块级 Vector3 实例化确认
- 代码库 `frontend/src/store/entitySlice.ts` — Map 不可变更新模式
- 代码库 `frontend/src/ecs/TrajectoryBuffer.ts` — clear() 方法确认
- 代码库 `frontend/src/ecs/types.ts` — 组件类型定义
- 代码库 `frontend/src/ecs/Entity.ts` — 实体工厂函数

### Secondary (MEDIUM confidence)
- MDN Web Docs — `<a download>` API, `<input type="file">` API, FileReader API, localStorage API
- D-01-01 至 D-01-09 锁定决策 — 来自 `.planning/phases/01-持久化与场景库/01-CONTEXT.md`

### Tertiary (LOW confidence)
- 无 — 所有关键声明均有 Context7 或代码库验证。

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有库版本经 npm registry 验证，API 经 Context7 验证
- Architecture: HIGH — 基于已锁定的 9 个决策和现有代码库结构
- Pitfalls: HIGH — DEBT-04 根因已通过测试输出和代码审查确认；Map 序列化问题有 Context7 文档支持

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (Zustand/Three.js 为稳定库，30 天有效期合理)
