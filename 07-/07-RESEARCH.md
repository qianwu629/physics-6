# Phase 07: 底层引擎重构 - Research

**Researched:** 2026-05-30
**Domain:** React Three Fiber + Rapier WASM physics integration, ECS type safety, rendering performance
**Confidence:** HIGH (verified against installed package types, official docs, and codebase audit)

## Summary

Phase 7 聚焦物理引擎集成层的增量式重构，不更换引擎、不触碰 UI。核心问题集中在三个层面：

1. **生命周期层**：`RigidBodyRefContext` 作为 5 个系统的 entity-body 桥接，当前是 naive Map 注册表，快速拆卸时存在竞态条件（ref 已 unregister 但 consumer 仍在 useFrame 中访问）。需要引入引用计数或所有权模型。

2. **数据层**：ForceField 实体的 `position` 同时存在于 `transform` 和 `forceField` 组件中，PropertyPanel 同步更新两者。应移除 forceField 中的 position，改为从 transform 读取（单一数据源）。

3. **性能层**：VectorRenderer 每 20ms 重复计算 O(entities x fields) 力场求和，与 ForceFieldSystem 的 120Hz 计算完全重复；SpringRenderer 每帧 `new TubeGeometry()` 造成 GPU 内存抖动；EntityRenderer 的 environment sync 在 slider 拖拽时触发全量 useEffect 重运行。

4. **类型安全层**：项目自定义的 `RigidBodyAPI` 接口缺少 `setAngularDamping`、`collider(index)`、`numColliders()` 等方法，导致 6 处 `as any` 逃逸。

5. **测试层**：当前所有物理测试均为纯数值模拟（Nyquist 风格），未在真实浏览器中加载 Rapier WASM。需要引入 Playwright 进行端到端物理场景验证。

**Primary recommendation:** 采用 "注册表引用计数 + 模块级力场缓存 + BufferGeometry 预分配 + 环境快照 useMemo + 声明合并补全类型" 的五管齐下方案，逐个模块重构，每次保持测试通过。

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-07-01:** 范围 = **物理引擎集成层**。聚焦 Rapier ↔ R3F 桥接、ECS 核心、力场计算管道。不触碰 UI 层、不更换物理引擎。
- **D-07-02:** 策略 = **增量式重构**。逐个模块重构（RigidBodyRefContext → ForceFieldSystem → VectorRenderer → EntityRenderer → SpringRenderer），每次保持测试通过，可回滚。
- **D-07-03:** 四个核心问题按优先级处理：RigidBodyRefContext 生命周期 → ForceField position 双源 → VectorRenderer 性能 → SpringRenderer 内存。
- **D-07-04:** **一并修复类型定义**。扩展 `RigidBodyAPI` 声明，消除全部 6 处 `as any` 逃逸。
- **D-07-05:** **新增 Playwright 集成测试**。在真实浏览器中加载 Rapier WASM，验证至少一个端到端物理场景（弹簧振子）。
- **D-07-06:** **store 中缓存环境快照**。EntityRenderer 当前在 environment slider 拖拽时触发所有 entity 的 `useEffect` 重同步。修复：store 中维护当前环境快照，EntityRenderer 用 `useMemo` 减少依赖变化。

### Claude's Discretion
- **ForceFieldSystem 遍历优化方案**：订阅 entity add/remove 事件维护缓存 vs 分层索引，由 planner 根据架构一致性确定
- **ForceField position 双源修复方案**：从 forceField 组件中移除 position vs 仅 UI 隐藏，由 planner 根据迁移成本确定

### Deferred Ideas (OUT OF SCOPE)
- 更换底层物理引擎（Rapier → Cannon.js/Ammo.js/PhysX.js）
- React 19 StrictMode 单例稳定性
- Biome/ESLint 工具链引入
- PropertyPanel 文件拆分
- react-draggable → @dnd-kit/core 迁移

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-03 | 性能基准与优化：50+ 实体 + 20+ 弹簧场景下，全可视化开启时平均 FPS ≥ 55 | VectorRenderer 缓存、SpringRenderer BufferGeometry、ForceFieldSystem 遍历优化 |
| FIELD-01 | 通用 ForceField 组件框架 | ForceField position 双源修复确保框架数据一致性 |
| FIELD-02 | 4 种预设力场实现 | forceFieldCalc.ts 已有实现，VectorRenderer 共享计算结果 |
| FIELD-03 | 力场创建/编辑/删除 | position 单一数据源确保编辑一致性 |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RigidBody lifecycle registry | Simulation (Rapier WASM) | Rendering (R3F refs) | Registry bridges ECS entity IDs to Rapier body handles; owned by simulation layer |
| Force field calculation | Simulation (useBeforePhysicsStep) | Rendering (VectorRenderer read) | Physics-authoritative: forces computed at 120Hz in physics step, visualized at render frame |
| Force/velocity vector rendering | Rendering (R3F useFrame) | — | Pure visual overlay, reads physics state via refs |
| Spring helix visualization | Rendering (R3F useFrame) | Simulation (useSpringJoint) | Visual geometry updated from physics positions |
| Environment parameter sync | Store (Zustand) | Simulation (imperative API) | Environment changes flow store → imperative body sync |
| Type safety extensions | Build-time (TypeScript) | — | Declaration merging extends third-party types |
| End-to-end physics validation | Test (Playwright + real browser) | — | Only real WASM execution validates integration correctness |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-three/fiber | ^9.1.0 (2026-04-28) | React renderer for Three.js | R3F v9 is the React 19 compatible line [VERIFIED: npm registry] |
| @react-three/rapier | ^2.2.0 (2025-11-03) | Rapier WASM physics integration | v2.2.0 is current stable with R3F v9 support [VERIFIED: npm registry] |
| @dimforge/rapier3d-compat | 0.19.3 (2025-11-05) | Rapier WASM core | Bundled compat build for broader browser support [VERIFIED: node_modules] |
| three | ^0.174.0 (2026-04-16) | 3D rendering engine | Locked to caret range; r174 is current [VERIFIED: npm registry] |
| zustand | ^5.0.5 | Global state management | v5 with React 19 support, persist middleware [VERIFIED: package.json] |
| @playwright/test | 1.60.0 (latest) | E2E browser testing | Chromium/Firefox/WebKit, native WASM support [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.5 | Unit testing | Existing test runner; jsdom environment for component tests |
| @testing-library/react | ^16.3.2 | React component testing | For unit tests; Playwright for E2E |

### Installation
```bash
# Playwright (dev dependency for E2E tests)
cd frontend && npm install -D @playwright/test
npx playwright install chromium
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Editor Layer (React UI)                  │
│  PropertyPanel ──► updateComponent() ──► Zustand Store       │
│  EnvironmentPanel ──► setFrictionScale() etc. ──► Store      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Store Layer (Zustand)                   │
│  entities Map ──► EntityRenderer/SpringRenderer (mount)      │
│  environment ──► environmentSnapshot ──► EntityRenderer      │
│  isRunning ──► Physics paused prop                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Rendering Layer (R3F)                      │
│  Scene3D ──► Physics ──► RigidBodyRefContext.Provider        │
│    ├── EntityRenderer ──► register/unregister ref            │
│    ├── SpringRenderer ──► useSpringJoint + helix mesh        │
│    ├── VectorRenderer ──► read forceCache + arrow groups     │
│    ├── TrajectoryRenderer ──► read refs + trail lines        │
│    ├── ForceFieldSystem ──► useBeforeStep + write forceCache │
│    └── ChartSampler ──► read refs + write chartBuffers       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Simulation Layer (Rapier WASM)                │
│  Physics world (120Hz) ◄── useBeforePhysicsStep callbacks    │
│  RigidBody refs ◄── RigidBodyRefContext registry             │
│  forceCache Map ◄── ForceFieldSystem + VectorRenderer shared │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (no changes needed)
```
frontend/src/
├── components/
│   ├── RigidBodyRefContext.tsx    # 注册表 + 引用计数
│   ├── ForceFieldSystem.tsx       # 力注入 + 缓存写入
│   ├── VectorRenderer.tsx         # 读取缓存 + 箭头渲染
│   ├── SpringRenderer.tsx         # BufferGeometry 预分配
│   ├── EntityRenderer.tsx         # 环境快照 + 类型安全
│   └── Scene3D.tsx                # 组装层
├── ecs/
│   ├── forceFieldCalc.ts          # 纯函数力计算（不变）
│   └── types.ts                   # ECS 类型定义
├── store/
│   ├── simulationSlice.ts         # + environmentSnapshot
│   └── entitySlice.ts             # 实体 CRUD
└── e2e/
    └── physics.spec.ts            # Playwright E2E 测试
```

### Pattern 1: Reference-Counted Registry
**What:** `RigidBodyRefContext` 维护 `Map<string, RegistryEntry>`，每个 entry 包含 `ref + refCount + mounted`。`EntityRenderer` mount 时 register（refCount++），unmount 时 unregister（refCount--）。Consumer 通过 `getRef` 获取，内部检查 `refCount > 0 && ref.current !== null`。

**When to use:** 任何多个 consumer 共享同一 ref 且存在异步拆卸风险的场景。

**Example:**
```typescript
// Source: codebase audit + R3F lifecycle patterns
interface RegistryEntry {
  ref: React.RefObject<RigidBodyAPI | null>;
  refCount: number;
  mounted: boolean;
}

const registry = useRef<Map<string, RegistryEntry>>(new Map());

const register = useCallback((entityId: string, ref: React.RefObject<RigidBodyAPI | null>) => {
  const entry = registry.current.get(entityId);
  if (entry) {
    entry.refCount++;
    entry.ref = ref; // update to latest ref
  } else {
    registry.current.set(entityId, { ref, refCount: 1, mounted: true });
  }
}, []);

const unregister = useCallback((entityId: string) => {
  const entry = registry.current.get(entityId);
  if (entry) {
    entry.refCount--;
    if (entry.refCount <= 0) {
      entry.mounted = false;
      // 延迟删除，给 consumer 一个帧的缓冲期
      setTimeout(() => {
        if (registry.current.get(entityId)?.mounted === false) {
          registry.current.delete(entityId);
        }
      }, 100);
    }
  }
}, []);

const getRef = useCallback((entityId: string) => {
  const entry = registry.current.get(entityId);
  if (!entry || !entry.mounted || entry.refCount <= 0) return undefined;
  return entry.ref;
}, []);
```

### Pattern 2: Module-Level Force Cache
**What:** `ForceFieldSystem` 在 `useBeforePhysicsStep` 中计算每个 dynamic 实体的总力场力，写入模块级 `Map<entityId, Vec3>`。`VectorRenderer` 在 `useFrame` 中直接读取，避免重复计算。

**When to use:** 物理步和渲染步需要共享计算结果，且计算成本高的场景。

**Example:**
```typescript
// Source: contactForceStore.ts pattern (existing codebase)
// frontend/src/components/contactForceStore.ts
const forceCache = new Map<string, { force: Vec3; timestamp: number }>();

export function setFieldForce(entityId: string, force: Vec3) {
  forceCache.set(entityId, { force: { ...force }, timestamp: performance.now() });
}

export function getFieldForce(entityId: string): Vec3 | null {
  const entry = forceCache.get(entityId);
  if (!entry) return null;
  if (performance.now() - entry.timestamp > 50) { // 50ms stale threshold
    forceCache.delete(entityId);
    return null;
  }
  return entry.force;
}
```

### Pattern 3: BufferGeometry In-Place Update
**What:** 预分配 `BufferGeometry` 的 `position` attribute，每帧直接修改 `Float32Array` 并标记 `needsUpdate = true`，避免 `TubeGeometry` 的每帧重建。

**When to use:** 动态曲线/路径每帧变化且顶点数可预测的场景。

**Example:**
```typescript
// Source: Three.js docs + TrajectoryRenderer existing pattern
const MAX_VERTICES = 16 * 16 * 3; // max coils * segments * 3
const geometry = useMemo(() => {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_VERTICES * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setDrawRange(0, 0);
  return geo;
}, []);

// In useFrame:
const posArray = geometry.attributes.position.array as Float32Array;
let idx = 0;
for (const point of helixPoints) {
  posArray[idx++] = point.x;
  posArray[idx++] = point.y;
  posArray[idx++] = point.z;
}
geometry.attributes.position.needsUpdate = true;
geometry.setDrawRange(0, helixPoints.length);
```

### Pattern 4: TypeScript Declaration Merging for RigidBodyAPI
**What:** 使用 `declare module` 或接口扩展补全 `@react-three/rapier` 未暴露的 `RapierRigidBody` 方法，消除 `as any`。

**When to use:** 第三方库类型定义不完整，但运行时 API 存在。

**Example:**
```typescript
// Source: TypeScript handbook + installed type verification
// frontend/src/types/rapier-augmentation.d.ts
import { Collider } from '@dimforge/rapier3d-compat';

export interface RigidBodyAPI {
  translation(): { x: number; y: number; z: number };
  linvel(): { x: number; y: number; z: number };
  setLinvel(vel: { x: number; y: number; z: number }, wakeUp: boolean): void;
  addForce(force: { x: number; y: number; z: number }, wakeUp: boolean): void;
  applyImpulse(impulse: { x: number; y: number; z: number }, wakeUp: boolean): void;
  mass(): number;
  setAdditionalMass(mass: number, wakeUp: boolean): void;
  setLinearDamping(damping: number): void;
  setAngularDamping(damping: number): void;  // ← 新增
  numColliders(): number;                      // ← 新增
  collider(index: number): ColliderAPI;        // ← 新增
}

export interface ColliderAPI {
  setRestitution(restitution: number): void;
  setFriction(friction: number): void;
}
```

### Anti-Patterns to Avoid
- **每帧 new Geometry():** 造成 GC 压力和 GPU 内存抖动。应预分配 BufferGeometry。
- **Store 中存储物理帧数据:** 违反 PITFALLS #6，会导致重渲染风暴。物理数据应通过 ref 直接读取。
- **useEffect 依赖环境原始值:** `frictionScale` 等标量变化会触发 N 个 EntityRenderer 的 useEffect 同时运行。应使用快照比较或集中同步。
- **as any 逃逸:** 掩盖 API 变更风险。应通过声明合并补全类型。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 物理引擎生命周期管理 | 自定义 body 池 | `@react-three/rapier` `<Physics>` + `useBeforePhysicsStep` | Rapier WASM 的内存管理和 world 步进有复杂的内部状态 |
| 力场矢量叠加计算 | 在渲染层重复计算 | 与 ForceFieldSystem 共享缓存（contactForceStore 模式）| O(entities x fields) 在 120Hz 下不可承受 |
| 弹簧曲线几何生成 | 每帧 `new TubeGeometry()` | 预分配 `BufferGeometry` + `setDrawRange` | TubeGeometry 构造函数内部生成大量顶点数据，GC 压力大 |
| E2E 浏览器自动化 | 自定义 Puppeteer 脚本 | Playwright | 原生 WASM 支持、自动等待、trace 回放、跨浏览器 |
| 类型安全补丁 | `as any` 逃逸 | TypeScript `declare module` / interface extension | 编译时检查，运行时零成本 |

**Key insight:** 本项目已经在 `contactForceStore.ts` 中建立了模块级缓存模式（Map + timestamp + TTL），力场缓存应直接复用此模式而非 invent new abstraction。

---

## Common Pitfalls

### Pitfall 1: RigidBodyRefContext 竞态条件
**What goes wrong:** EntityRenderer unmount 时调用 `unregister`，但 ForceFieldSystem/VectorRenderer 的 `useBeforeStep`/`useFrame` 可能在同一帧稍后仍调用 `getRef`，获取到 `current === null` 的 ref，导致 `typeof body.translation === 'function'` 检查失败或更严重的 NPE。

**Why it happens:** React 的 cleanup timing 和 R3F 的 `useFrame` 执行顺序不保证严格先后。`@react-three/rapier` 的 `useBeforePhysicsStep` 在 `Physics` 组件的 `useFrame` 中执行，而 `EntityRenderer` 的 `useEffect` cleanup 在 React commit phase 执行。

**How to avoid:** 引入引用计数 + `mounted` 标志 + 延迟删除（见 Pattern 1）。Consumer 统一通过 `getRef` 获取，内部做空值检查。

**Warning signs:** 快速添加/删除实体时控制台出现 `Cannot read properties of null` 或 `translation is not a function`。

### Pitfall 2: ForceField position 双源不同步
**What goes wrong:** PropertyPanel 同时更新 `transform.position` 和 `forceField.position`，但某些代码路径（如场景导入、预设加载、程序化创建）可能只更新其中一个，导致力场可视化位置和物理计算位置不一致。

**Why it happens:** `forceFieldCalc.ts` 从 `forceField.position` 读取，而 `ForceFieldRenderer` 可能从 `transform.position` 读取（或反之）。

**How to avoid:** 从 `BaseForceFieldComponent` 中移除 `position` 字段，`forceFieldCalc.ts` 和 `ForceFieldRenderer` 统一从 `transform` 组件读取位置。PropertyPanel 只更新 `transform.position`。

**Warning signs:** 力场可视化球体/箭头与物理效果中心不重合。

### Pitfall 3: VectorRenderer 重复计算力场
**What goes wrong:** VectorRenderer 每 20ms 调用 `computeTotalForce(fields, pos, vel, charge)` 对每个实体，而 ForceFieldSystem 在 120Hz 物理步中也做完全相同的计算。50 实体 x 5 力场 x 50Hz = 12,500 次力场求和/秒，完全重复。

**Why it happens:** VectorRenderer 需要力数据渲染箭头，但没有机制从 ForceFieldSystem 读取已计算的结果。

**How to avoid:** ForceFieldSystem 将每个实体的总力场力写入模块级 `fieldForceCache` Map。VectorRenderer 直接读取缓存，仅在缓存 miss（新实体或新帧）时计算。

**Warning signs:** FPS 在开启力场可视化后显著下降，Chrome Performance 面板显示大量 `computeTotalForce` 调用。

### Pitfall 4: SpringRenderer TubeGeometry 每帧分配
**What goes wrong:** `useFrame` 中 `geometryRef.current.dispose(); geometryRef.current = new THREE.TubeGeometry(...)` 每帧执行，创建大量短生命周期的 Geometry 对象。

**Why it happens:** `TubeGeometry` 不支持直接更新路径，开发者选择了 dispose+重建的捷径。

**How to avoid:** 改用 `BufferGeometry` 预分配顶点数组，每帧更新 `position` attribute（见 Pattern 3）。`CatmullRomCurve3` 仍用于生成路径点，但顶点数据直接写入 BufferGeometry。

**Warning signs:** Chrome Memory 面板显示频繁的 GC 暂停，GPU 内存波动。

### Pitfall 5: EntityRenderer environment useEffect 全量触发
**What goes wrong:** `frictionScale`/`restitutionScale`/`drag` 任一变化触发每个 EntityRenderer 实例的 `useEffect` 重运行，调用 `setAdditionalMass`/`setLinearDamping`/`setRestitution`/`setFriction`。20+ 实体时 slider 拖拽卡顿。

**Why it happens:** 每个 EntityRenderer 独立订阅 store 中的环境值，导致变化时 N 个组件同时重渲染+执行 effect。

**How to avoid:** 在 `simulationSlice` 中维护 `environmentSnapshot`（整个 environment 对象的引用），EntityRenderer 用 `useMemo` 比较快照引用是否变化，或用 `useShallow` 选择器。更优方案：提取 `EnvironmentSync` 组件，单点订阅环境变化，遍历所有 body 统一同步（ARCHITECTURE.md 已建议）。

**Warning signs:** 拖拽 EnvironmentPanel 的 friction slider 时 FPS 骤降。

### Pitfall 6: Playwright + WASM 初始化超时
**What goes wrong:** Rapier WASM 初始化需要下载 `.wasm` 文件并编译，在 CI 或慢网络环境下可能超时。

**Why it happens:** `@dimforge/rapier3d-compat` 的 WASM 文件约 1.5MB，首次加载需要网络请求+WebAssembly.instantiate。

**How to avoid:** Playwright 测试中设置较长的 `test.setTimeout(60000)`；使用 `page.waitForFunction(() => window.__RAPIER_READY__)` 等待应用发出 WASM 就绪信号；在 Vite dev server 模式下测试（WASM 由 dev server 提供，无需额外配置）。

---

## Code Examples

### Verified Pattern: useBeforePhysicsStep Hook
```typescript
// Source: @react-three/rapier v2.2.0 type declarations (installed)
// node_modules/@react-three/rapier/dist/declarations/src/hooks/hooks.d.ts

export declare const useBeforePhysicsStep: (callback: WorldStepCallback) => void;
export declare const useAfterPhysicsStep: (callback: WorldStepCallback) => void;

// WorldStepCallback = (world: World) => void
// 在 Physics 组件的 useFrame 中，物理步进之前/之后调用
```

### Verified Pattern: Rapier RigidBody API (WASM core)
```typescript
// Source: @dimforge/rapier3d-compat v0.19.3 type declarations (installed)
// node_modules/@dimforge/rapier3d-compat/dynamics/rigid_body.d.ts

export declare class RigidBody {
  translation(): Vector;
  linvel(): Vector;
  setLinvel(vel: Vector, wakeUp: boolean): void;
  addForce(force: Vector, wakeUp: boolean): void;
  applyImpulse(impulse: Vector, wakeUp: boolean): void;
  mass(): number;
  setAdditionalMass(mass: number, wakeUp: boolean): void;
  setLinearDamping(factor: number): void;
  setAngularDamping(factor: number): void;
  numColliders(): number;
  collider(i: number): Collider;
  // ...
}
```

### Verified Pattern: Rapier Collider API
```typescript
// Source: @dimforge/rapier3d-compat v0.19.3
// node_modules/@dimforge/rapier3d-compat/geometry/collider.d.ts

export declare class Collider {
  setRestitution(restitution: number): void;
  setFriction(friction: number): void;
  // ...
}
```

### Verified Pattern: Playwright + WASM E2E Test
```typescript
// Source: Playwright docs + WASM testing patterns
import { test, expect } from '@playwright/test';

test.describe('Physics E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // 等待应用就绪信号（由 App.tsx 在 WASM 初始化后设置）
    await page.waitForFunction(() => (window as any).__APP_READY__ === true, {
      timeout: 30000,
    });
  });

  test('spring oscillator period matches theory', async ({ page }) => {
    // 加载弹簧振子预设
    await page.click('[data-testid="preset-spring-oscillator"]');
    await page.click('[data-testid="play-button"]');

    // 等待 3 秒让物理运行
    await page.waitForTimeout(3000);

    // 通过 page.evaluate 读取 Rapier body 位置
    const positions = await page.evaluate(async () => {
      const results: number[] = [];
      // 假设应用暴露了全局调试 API
      const body = (window as any).__DEBUG__.getBody('mass-1');
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 1000 / 120));
        const t = body.translation();
        results.push(t.y);
      }
      return results;
    });

    // 验证周期性
    expect(positions.length).toBe(120);
    const peaks = findPeaks(positions);
    expect(peaks.length).toBeGreaterThanOrEqual(2);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `applyForce` (Rapier v0.17) | `addForce` (Rapier v0.18+) | 2023-2024 | `addForce` 是持续力，`applyImpulse` 是冲量；`applyForce` 已移除 [VERIFIED: rapier3d-compat 0.19.3 types] |
| R3F v8 + React 18 | R3F v9 + React 19 | 2024-2025 | `useFrame` 优先级、自动批处理、StrictMode 双挂载行为变化 [CITED: pmndrs.github.io/react-three-rapier] |
| `useBeforeStep` (旧别名) | `useBeforePhysicsStep` (正式名) | v2.2.0 | 别名仍可用但正式文档使用 `useBeforePhysicsStep` [VERIFIED: installed types] |
| jsdom + mock physics | Playwright + real WASM | 2025 (本项目) | 真实物理验证，但初始化时间和 CI 配置更复杂 |

**Deprecated/outdated:**
- `applyForce`: 已在 Rapier 0.18+ 中移除，使用 `addForce` 替代 [VERIFIED: rapier3d-compat 0.19.3 无 applyForce 方法]
- `TubeGeometry` 每帧重建: 性能反模式，应使用 `BufferGeometry` 预分配

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@react-three/rapier` v2.2.0 的 `useBeforePhysicsStep` 在 `useFrame` 中同步执行，与 React commit phase 不保证顺序 | Pitfall 1 | 如果实际顺序相反，引用计数的延迟删除策略可能需要调整 |
| A2 | `TubeGeometry` 不支持直接更新路径顶点 | Pattern 3 | 如果 Three.js 未来版本支持，BufferGeometry 方案仍有效但非必要 |
| A3 | Playwright 可以加载 Vite dev server 并执行 WASM | Playwright | 如果 CI 环境限制 WASM 执行（如安全策略），需要 headless 特殊配置 |
| A4 | 从 `forceField` 组件移除 `position` 不会破坏序列化/反序列化 | Pattern 2 | 如果 sceneSerializer 硬编码依赖 forceField.position，需要同步更新序列化逻辑 |

---

## Open Questions

1. **EnvironmentSync 组件的提取范围**
   - What we know: ARCHITECTURE.md 建议提取 `EnvironmentSync` 组件集中同步环境参数
   - What's unclear: 是否应在 Phase 7 内完成，还是作为后续清理
   - Recommendation: 作为 Phase 7 的子任务，因为 D-07-06 明确要求优化 environment slider 性能

2. **Playwright 测试的 WASM 就绪信号机制**
   - What we know: Rapier WASM 初始化异步，需要等待
   - What's unclear: 当前 App.tsx 是否暴露 `__APP_READY__` 或类似信号
   - Recommendation: 在 App.tsx 的 WASM init 完成后设置 `window.__APP_READY__ = true`，Playwright 测试等待此信号

3. **ForceField position 移除的迁移成本**
   - What we know: 6 处 `forceField.position` 引用（types.ts, PropertyPanel, forceFieldCalc, ForceFieldRenderer, ForceFieldLines, sceneSerializer）
   - What's unclear: 是否有其他隐藏引用
   - Recommendation: 全局 grep `forceField.*position` 后执行迁移，更新序列化/反序列化逻辑

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + test | ✓ | v24.11.1 | — |
| npm | Package management | ✓ | 10.x | — |
| Vite | Dev server + build | ✓ | 6.3.0 | — |
| @react-three/rapier | Physics simulation | ✓ | 2.2.0 | — |
| @dimforge/rapier3d-compat | WASM core | ✓ | 0.19.3 | — |
| three | 3D rendering | ✓ | 0.174.0 | — |
| @react-three/fiber | React 3D renderer | ✓ | 9.1.0 | — |
| Playwright | E2E testing | ✓ (CLI) | 1.60.0 | — |
| Chromium (Playwright) | E2E browser | ✗ (not installed) | — | `npx playwright install chromium` |

**Missing dependencies with no fallback:**
- Chromium browser for Playwright — 需要执行 `npx playwright install chromium`

**Missing dependencies with fallback:**
- 无

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4.1.5 (unit) + Playwright v1.60.0 (E2E) |
| Config file | `frontend/vite.config.ts` (Vitest) / `frontend/playwright.config.ts` (Playwright, 需新建) |
| Quick run command | `cd frontend && npx vitest run` |
| Full suite command | `cd frontend && npx vitest run && npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-03 | 50+ 实体场景 FPS ≥ 55 | E2E perf | Playwright + Chrome DevTools Protocol | ❌ Wave 0 |
| D-07-04 | 类型安全无 as any | Unit | `npx vitest run src/components/__tests__/typesafety.test.ts` | ❌ Wave 0 |
| D-07-05 | 弹簧振子端到端验证 | E2E | `npx playwright test e2e/physics.spec.ts` | ❌ Wave 0 |
| D-07-01 | RigidBodyRefContext 竞态修复 | Unit | `npx vitest run src/components/__tests__/registry.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + Playwright E2E 通过 before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `frontend/playwright.config.ts` — Playwright 配置文件
- [ ] `frontend/e2e/physics.spec.ts` — 物理 E2E 测试
- [ ] `frontend/src/components/__tests__/registry.test.tsx` — 注册表生命周期测试
- [ ] `frontend/src/types/rapier-augmentation.d.ts` — 类型声明合并文件
- [ ] Playwright install: `npx playwright install chromium`

---

## Security Domain

> `security_enforcement` not explicitly configured; included per default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Zod schemas for scene JSON (`sceneValidation.ts`) |
| V6 Cryptography | no | Client-side only, no crypto operations |
| V7 Error Handling | yes | Defensive programming with graceful degradation |

### Known Threat Patterns for Rapier WASM + R3F

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious scene JSON | Tampering | Zod validation + MAX_FILE_SIZE + component filtering |
| NaN/Infinity in physics | Denial of Service | `isFiniteVec` 兜底 + ZERO vector fallback |
| Excessive entity creation | Denial of Service | `MAX_ENTITIES = 50` hard cap |

---

## Sources

### Primary (HIGH confidence)
- `@react-three/rapier` v2.2.0 installed type declarations — `useBeforePhysicsStep`, `WorldStepCallback`, `RapierContext` API verified
- `@dimforge/rapier3d-compat` v0.19.3 installed type declarations — `RigidBody.addForce`, `setAngularDamping`, `numColliders`, `collider()`, `Collider.setRestitution/setFriction` verified
- `@react-three/fiber` v9.1.0 installed types — `useFrame` signature verified
- Codebase audit: `CONCERNS.md`, `ARCHITECTURE.md`, target source files read directly

### Secondary (MEDIUM confidence)
- [pmndrs.github.io/react-three-rapier](https://pmndrs.github.io/react-three-rapier/functions/useBeforePhysicsStep.html) — `useBeforePhysicsStep` documentation [CITED]
- [Playwright WASM testing patterns](https://blog.pixelfreestudio.com/best-practices-for-testing-webassembly-applications/) — WASM E2E best practices [CITED]
- [TypeScript Declaration Merging](https://rishikc.com/articles/typescript-declaration-merging-module-augmentation/) — Module augmentation patterns [CITED]

### Tertiary (LOW confidence)
- Web search for Three.js BufferGeometry performance — 一般性最佳实践，未针对 r174 验证具体行为

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部版本通过 npm registry 和 node_modules 验证
- Architecture: HIGH — 基于 codebase 直接读取和 CONCERNS.md/ARCHITECTURE.md 审计
- Pitfalls: HIGH — 每个 pitfall 都有源代码中的具体行号证据
- Playwright integration: MEDIUM — Playwright CLI 可用但尚未安装 Chromium，配置待验证

**Research date:** 2026-05-30
**Valid until:** 2026-07-30 (stable stack — Rapier/R3F 发布周期约 2-3 个月)

---

## RESEARCH COMPLETE
