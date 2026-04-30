# Architecture Research

**Domain:** Web 3D 物理模拟平台（组件化、经典力学）
**Researched:** 2026-04-30
**Confidence:** HIGH

## Standard Architecture

现代 Web 物理模拟系统已形成共识架构。核心理念：**物理拥有真相，渲染只是镜子**。以下各层从数据核心向外展开。

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            表示层 (Presentation Layer)                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │   场景编辑器 UI       │  │   3D 视口 (Three.js)   │  │  面板 & HUD       │   │
│  │  (拖拽搭建场景)       │  │  (rendering-only)     │  │  (参数调节面板)   │   │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘   │
│             │                         │                        │             │
├─────────────┴─────────────────────────┴────────────────────────┴────────────┤
│                            状态管理层 (State Layer)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Zustand Store (UI & 交互状态)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │   │
│  │  │ sceneStore   │  │  simStore   │  │  uiStore    │                   │   │
│  │  │ (场景定义)   │  │ (仿真状态)   │  │ (编辑/选择)  │                   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                            仿 真 核 心  (Simulation Core)                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        PhysicsWorld  (权威状态)                        │   │
│  │                                                                       │   │
│  │   ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │   │
│  │   │  Scene Graph     │    │  Solver Loop     │    │  Domain       │  │   │
│  │   │  (实体 + 力/约束) │    │  (固定步长, Worker)│    │  Plugins      │  │   │
│  │   └────────┬─────────┘    └────────┬─────────┘    └───────┬───────┘  │   │
│  │            │                       │                       │          │   │
│  │   ┌────────┴───────────────────────┴───────────────────────┴───────┐  │   │
│  │   │              Rapier WASM (碰撞检测 + 刚体动力学)                 │  │   │
│  │   └────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                            通信层 (Communication Layer)                      │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────┐   │
│  │         REST API              │    │        WebSocket Stream          │   │
│  │  (场景CRUD, 仿真生命周期)      │    │   (实时状态推送, delta同步)       │   │
│  └──────────────────────────────┘    └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心组件职责

| 组件 | 职责 | 实现方式 |
|------|------|----------|
| **PhysicsWorld** | 管理所有刚体、碰撞体、力场、约束；持有物理权威状态 | 封装 Rapier `World`，提供场景图 API |
| **Scene Graph** | 以 DAG 结构组织所有物理实体及其关系（父子、约束连接） | 自定义 `EntityNode` + `Component` 数据容器 |
| **Solver Loop** | 固定时间步长的物理步进，含累加器限制 | `requestAnimationFrame` + 累加器 + Worker 可选 |
| **Transform Bridge** | 单向同步：物理世界 → Three.js Object3D 变换 | 每帧批量 `Float32Array` 拷贝 |
| **Zustand Store** | 管理 UI 状态、场景定义 JSON、仿真生命周期、用户选择 | 现有 `api.ts` 骨架的完整实现 |
| **Scene Editor** | 拖拽搭建场景，参数化配置物体属性 | React 组件 + DnD kit + 属性面板 |
| **3D Viewport** | 渲染 Three.js 场景，只读——不持有物理逻辑 | `THREE.Scene` + `WebGLRenderer` |
| **Domain Plugin** | 每个物理领域（力学/光学/电磁）定义自己的组件类型和系统 | 注册式架构，实现 `PhysicsDomain` 接口 |

---

## Recommended Project Structure

```
frontend/src/
├── simulation/                    # 仿真核心——平台无关的物理层
│   ├── world/                     # 场景图与物理世界管理
│   │   ├── PhysicsWorld.ts        # Rapier 封装，单例管理
│   │   ├── SceneGraph.ts          # DAG 场景图结构
│   │   └── EntityNode.ts          # 实体节点定义
│   ├── components/                # 物理组件定义 (ECS 数据层)
│   │   ├── RigidBody.ts           # 质量、类型(动态/静态/运动学)
│   │   ├── Collider.ts            # 形状(球/盒/三角网格)、碰撞参数
│   │   ├── Transform.ts           # 位置、旋转、缩放
│   │   ├── Force.ts               # 施加力（重力、弹力、摩擦力）
│   │   └── Constraint.ts          # 关节约束（铰链、弹簧、滑轨）
│   ├── systems/                   # ECS 系统——操作组件的数据
│   │   ├── PhysicsSystem.ts       # 调用 world.step()
│   │   ├── ForceSystem.ts         # 应用用户定义的力场
│   │   ├── ConstraintSystem.ts    # 管理关节/约束更新
│   │   └── SyncSystem.ts          # 同步物理状态到 Three.js
│   ├── loop/                      # 仿真循环
│   │   ├── SimulationLoop.ts      # 固定时间步长 + 累加器
│   │   └── Interpolator.ts        # 物理状态插值
│   ├── domains/                   # 物理领域插件
│   │   ├── IDomainPlugin.ts       # 领域接口定义
│   │   ├── mechanics/             # 经典力学领域
│   │   │   ├── MechanicsPlugin.ts # 注册力学组件类型
│   │   │   ├── GravityField.ts    # 重力场
│   │   │   └── SpringForce.ts     # 弹簧力
│   │   └── (future: optics/ electromagnetics/ thermodynamics/)
│   └── worker/                    # Web Worker 物理计算
│       ├── physics.worker.ts      # Worker 入口
│       └── workerBridge.ts        # 主线程 ↔ Worker 通信桥
│
├── rendering/                     # 渲染层——纯视觉，不接触物理逻辑
│   ├── Scene3D.ts                 # Three.js 场景初始化
│   ├── RenderLoop.ts              # requestAnimationFrame 渲染循环
│   ├── objects/                   # 可渲染对象工厂
│   │   ├── BallRenderer.ts        # 球体网格
│   │   ├── BoxRenderer.ts         # 方块网格
│   │   └── SpringRenderer.ts      # 弹簧线条
│   ├── materials/                 # 材质定义
│   └── debug/                     # 调试可视化（法线、碰撞体线框）
│
├── store/                         # Zustand 状态管理
│   ├── index.ts                   # Store 创建 & 类型定义
│   ├── api.ts                     # 现有 API actions (REST + WebSocket)
│   ├── sceneStore.ts              # 场景定义状态（实体列表、参数）
│   ├── simStore.ts                # 仿真运行时状态（运行/暂停/进度）
│   └── uiStore.ts                 # UI 状态（选中物体、面板开关）
│
├── editor/                        # 场景编辑器
│   ├── EditorCanvas.tsx           # 编辑器画布（拖拽区域）
│   ├── Toolbox.tsx                # 组件工具箱（球体/方块/弹簧等）
│   ├── PropertyPanel.tsx          # 物体属性面板
│   └── SceneHierarchy.tsx         # 场景层级树
│
├── api/                           # 后端通信
│   ├── client.ts                  # HTTP 客户端
│   ├── scenes.ts                  # 场景 CRUD API
│   ├── simulations.ts             # 仿真生命周期 API
│   └── websocket.ts              # WebSocket 管理（已有骨架）
│
├── types/                         # 共享类型定义
│   ├── scene.ts                   # 场景相关类型
│   ├── physics.ts                 # 物理原语类型
│   └── simulation.ts              # 仿真相关类型
│
└── App.tsx                        # 应用根组件
```

### 结构原则

- **`simulation/`** 是纯逻辑层——零依赖 React、零依赖 Three.js。可以无头运行（测试、批量模拟）、可以在 Worker 中运行。这是平台的核心。
- **`rendering/`** 只读——从 `simulation/` 读取状态做视觉呈现，绝不修改物理数据。
- **`store/`** 桥接 UI 和 simulation——Zustand 持有场景定义（JSON→反序列化为 physics world），UI actions 通过 store actions 触发仿真变更。
- **`editor/`** 是 React UI 层——纯交互，通过 store actions 间接操作仿真核心。
- **`domains/`** 目录直接体现"可扩展性"架构决策——每个未来物理领域只需新增一个子目录并实现 `IDomainPlugin`。

---

## Architectural Patterns

### Pattern 1: Entity-Component 场景图（Composite Pattern）

**What:** 场景图由实体节点（Entity Node）组成，每个节点可附加任意数量的物理组件（RigidBody、Collider、Force、Constraint）。实体之间形成 DAG 结构——子实体继承父实体的坐标系，约束边连接两个实体。

**When to use:** 这是整个平台的核心约束——用户自由组合基础原语，不允许模板模式。ECS 变体完美契合这一需求。

**Trade-offs:** ECS 在 TypeScript 中不会像 C++ 那样通过数据布局优化获得极致缓存性能，但灵活性收益远超这个代价。Web 物理模拟的瓶颈在 WASM 碰撞检测，不在 ECS 迭代。

**Example:**
```typescript
// 实体定义——只是一个 ID 和组件容器
interface EntityNode {
  id: string;
  name: string;
  parentId: string | null;         // 场景图父子关系
  components: Map<string, Component>; // 组件的实际数据
}

// 组件定义——纯数据，无行为
interface RigidBodyComponent {
  type: 'component:rigid_body';
  kind: 'dynamic' | 'static' | 'kinematic';
  mass: number;
  restitution: number;
  friction: number;
  linearDamping: number;
}

interface ColliderComponent {
  type: 'component:collider';
  shape: 'sphere' | 'box' | 'slope' | 'trimesh';
  params: ColliderParams;  // 半径 / 半尺寸 / 顶点等
}

interface ForceFieldComponent {
  type: 'component:force_field';
  kind: 'gravity' | 'spring' | 'drag' | 'custom';
  params: ForceParams;
}

interface ConstraintComponent {
  type: 'component:constraint';
  kind: 'revolute' | 'prismatic' | 'spring' | 'fixed';
  targetEntityId: string;  // 连接的目标实体
  params: ConstraintParams;
}

// 用户自由组合示例：
// "在斜面上放一个球，给球施加初速度"
const ball = createEntity('ball-1', {
  rigidBody: { kind: 'dynamic', mass: 1.0, restitution: 0.8 },
  collider: { shape: 'sphere', params: { radius: 0.5 } },
  transform: { position: [2, 3, 0], rotation: [0,0,0,1] },
});
const slope = createEntity('slope-1', {
  rigidBody: { kind: 'static' },
  collider: { shape: 'slope', params: { angle: Math.PI/6, width: 4 } },
  transform: { position: [0, 0, 0] },
});

// 这个组合由用户任意定义，没有预设的"斜面模板"
```

---

### Pattern 2: 固定时间步长 + 状态插值（Simulation Loop）

**What:** 物理引擎以固定频率步进（推荐 120Hz），渲染循环以显示器刷新率运行。累加器收集帧时间差，当累积量超过固定步长时执行一个物理子步。渲染时用 `alpha = accumulator / fixedDt` 在前一个与当前物理状态之间插值。

**When to use:** 始终使用——这是物理模拟正确性的基石。绝不要在 `requestAnimationFrame` 中直接以可变 dt 调用 `world.step()`。

**Trade-offs:** CPU 开销略高于可变步长（多步进），但换来跨设备确定性。`MAX_STEPS` 限制防止"死亡螺旋"。

**Example:**
```typescript
export class SimulationLoop {
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 120;   // 120Hz 物理
  private readonly MAX_STEPS = 10;        // 防止死亡螺旋
  private prevState: PhysicsSnapshot | null = null;
  private currState: PhysicsSnapshot | null = null;
  private worker: PhysicsWorker | null = null;  // 可选

  constructor(
    private world: PhysicsWorld,
    private syncSystem: SyncSystem,
    useWorker = false,
  ) {
    if (useWorker) {
      this.worker = new PhysicsWorker();
    }
  }

  start() {
    let lastTime = performance.now();

    const tick = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;

      // 1. 限制 dt 防止切标签后爆炸
      const clampedDt = Math.min(deltaMs / 1000, 1 / 10);
      this.accumulator += clampedDt;

      // 2. 固定步长物理步进
      let steps = 0;
      while (this.accumulator >= this.FIXED_DT && steps < this.MAX_STEPS) {
        this.world.step(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
        steps++;
      }

      // 3. 插值因子
      const alpha = this.accumulator / this.FIXED_DT;

      // 4. 捕获当前物理快照
      this.prevState = this.currState;
      this.currState = this.world.snapshot();

      // 5. 同步到渲染层（带插值）
      if (this.prevState && this.currState) {
        this.syncSystem.sync(this.prevState, this.currState, alpha);
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
```

---

### Pattern 3: 物理与渲染单向依赖（Physics Bridge）

**What:** 物理世界是权威状态持有者，渲染层通过 `SyncSystem` 单向读取物理变换并应用到 Three.js 对象。绝不反向写入（渲染层不修改物理状态）。这是游戏引擎和 Web 物理模拟的事实标准。

**When to use:** 始终使用——保证物理可重现，支持无头运行，方便测试。

**Trade-offs:** 没有——这是物理模拟架构的最基本原则。

**Example:**
```typescript
// SyncSystem —— 每帧从物理世界同步到 Three.js
export class SyncSystem {
  private objectMap = new Map<string, THREE.Object3D>();

  register(entityId: string, threeObject: THREE.Object3D): void {
    this.objectMap.set(entityId, threeObject);
  }

  sync(
    prev: PhysicsSnapshot,
    curr: PhysicsSnapshot,
    alpha: number
  ): void {
    for (const [entityId, obj] of this.objectMap) {
      const prevState = prev.getTransform(entityId);
      const currState = curr.getTransform(entityId);
      if (!prevState || !currState) continue;

      // 线性插值位置
      obj.position.set(
        prevState.x + (currState.x - prevState.x) * alpha,
        prevState.y + (currState.y - prevState.y) * alpha,
        prevState.z + (currState.z - prevState.z) * alpha,
      );

      // 球面插值旋转
      obj.quaternion.slerpQuaternions(
        prevState.quat, currState.quat, alpha
      );
    }
  }
}

// 物理快照 —— 高效传输的扁平数据结构
interface PhysicsSnapshot {
  transforms: Float32Array;  // 每实体: [x,y,z, qx,qy,qz,qw]
  entityIds: string[];       // 对应实体 ID
}
```

---

### Pattern 4: 领域插件架构（Strategy Pattern 变体）

**What:** 每个物理领域（力学、光学、电磁、热力学）实现 `IDomainPlugin` 接口，向核心框架注册自己的组件类型、系统、求解器。核心框架提供场景图、渲染循环、状态管理——领域插件只关注领域特定的物理逻辑。

**When to use:** 从第一天就采用——避免日后从单一领域重构为多领域的巨大成本。每个领域的新组件类型只需实现接口。

**Trade-offs:** 增加了前期接口设计成本（需要预见多领域的共性抽象），但避免了日后重写。对于高中物理场景（力学→光学→电磁→热力学），每个领域差异大但都共享场景图、渲染、状态管理——接口抽象是合理的。

**Example:**
```typescript
// 领域插件接口 —— 每个物理领域实现此接口
interface IDomainPlugin {
  id: string;                            // 'mechanics', 'optics', 'electromagnetics'
  name: string;                          // 显示名
  componentTypes: ComponentType[];       // 本领域提供的组件类型
  systems: SystemFactory[];              // 本领域的 ECS System
  initialize(world: PhysicsWorld): void; // 初始化领域特定配置
  getToolboxItems(): ToolboxItem[];      // 编辑器工具箱中的条目
}

// 力学领域插件
class MechanicsPlugin implements IDomainPlugin {
  id = 'mechanics';
  name = '经典力学';
  componentTypes = ['rigid_body', 'collider', 'force_field', 'constraint'];
  systems = [ForceSystem, ConstraintSystem];

  initialize(world: PhysicsWorld) {
    // 设置默认重力场、全局碰撞参数
    world.setGravity({ x: 0, y: -9.81, z: 0 });
  }

  getToolboxItems() {
    return [
      { type: 'sphere', label: '球体', defaultMass: 1.0 },
      { type: 'box', label: '方块', defaultMass: 1.0 },
      { type: 'slope', label: '斜面', defaultMass: 0 },
      { type: 'spring', label: '弹簧', defaultStiffness: 10 },
    ];
  }
}

// 未来光学领域插件
class OpticsPlugin implements IDomainPlugin {
  id = 'optics';
  name = '光学';
  componentTypes = ['light_source', 'mirror', 'lens', 'ray_trace_target'];
  systems = [RayTraceSystem, RefractionSystem];
  // 力学使用 Rapier，光学使用自定义光线追踪求解器
}

// 核心框架注册所有可用领域
const physicsEngine = new PhysicsEngine();
physicsEngine.registerDomain(new MechanicsPlugin());
// 未来:
// physicsEngine.registerDomain(new OpticsPlugin());
// physicsEngine.registerDomain(new ElectromagneticsPlugin());
```

---

## Data Flow

### 场景搭建流程

```
用户拖拽组件到画布
    ↓
EditorCanvas 触发 action
    ↓
sceneStore.addEntity({ type: 'sphere', position: [2,3,0], mass: 1.0 })
    ↓
PhysicsWorld.createEntity() → Rapier World.createRigidBody() + createCollider()
    ↓
SyncSystem.register(entityId, threeMesh)
    ↓
3D Viewport 出现新的球体网格
```

### 仿真运行流程

```
用户点击"开始仿真"
    ↓
simStore.startSimulation()
    ↓
SimulationLoop.start()
    ↓
┌─ 每 1/120 秒 ─────────────────────────────────┐
│ PhysicsWorld.step(dt)                           │
│   ├── ForceSystem.apply()    施加力场           │
│   ├── ConstraintSystem.update() 更新约束        │
│   └── Rapier.world.step()    碰撞检测 + 积分    │
│ PhysicsWorld.snapshot()     捕获变换快照        │
├─ 每帧 (rAF) ───────────────────────────────────┤
│ SyncSystem.sync(prev, curr, alpha)              │
│   └── THREE.Object3D.position/rotation 更新      │
│ Renderer.render(scene, camera)                  │
│ (可选) WebSocket → 后端推送状态                  │
└────────────────────────────────────────────────┘
```

### 状态管理数据流

```
Zustand Store (单 Store 多 Slice 模式)
│
├── sceneStore (持久化层)
│   └── 场景定义 → JSON 序列化/反序列化
│       └── 保存到后端 → 从后端加载
│
├── simStore (运行时层)
│   ├── simulationStatus: idle | running | paused
│   ├── simulationTime: number
│   └── simulationProgress: 0..1
│
├── uiStore (交互层)
│   ├── selectedEntityId: string | null
│   ├── editorMode: 'select' | 'place' | 'connect'
│   └── panels: { toolbox: true, properties: true }
│
└── api.ts (后端集成层)
    ├── REST: 场景 CRUD, 仿真生命周期
    └── WebSocket: 实时状态推送 (已有骨架)
```

### 关键通信流

1. **场景搭建 (编辑模式):** Editor UI → Zustand action → sceneStore 更新 + PhysicsWorld 同步创建/修改 → SyncSystem 注册渲染对象 → Three.js 更新视图

2. **仿真运行 (运行模式):** SimulationLoop (固定步长) → PhysicsWorld.step() → snapshot → SyncSystem.sync() → Three.js 渲染 → (可选) WebSocket 推送快照到后端

3. **实时参数调节 (运行时):** PropertyPanel 滑块拖动 → Zustand action → PhysicsWorld 直接修改刚体属性 (mass/damping/restitution) → 下次 step 生效

4. **场景持久化:** PhysicsWorld.serialize() → JSON → Zustand sceneStore → REST API → 后端存储 → 反过来加载时反序列化重建 World

---

## Architecture Decisions

### 决策: ECS 变体而非完整 ECS 框架

**选择:** 自建轻量 ECS（Entity + Component 数据容器 + System 函数），不使用 bitecs / @javelin/ecs 等完整框架。

**理由:**
- 物理瓶颈在 WASM 碰撞检测，不在组件迭代性能——完整 Archetype ECS 的 SoA 内存布局优化对我们收益不大
- 现有 Zustand 已管理大部分状态，引入完整 ECS 框架会创建两个"真相来源"——复杂化同步
- 自建方案代码量小（~200 行），完全可控，方便与 Rapier Body Handle 映射
- TypeScript 中完整 ECS 的泛型体操反而降低可读性

### 决策: Rapier WASM 作为物理引擎

**理由:**
- WASM 性能远超纯 JS 引擎（Cannon-es），在数百实体规模下优势明显
- Rust 实现成熟稳定，经 production 验证（Rust 游戏生态核心库）
- `@dimforge/rapier3d-compat` 内联 WASM — 解决 Vite 打包问题（v0.15+ 已修复 tree-shaking bug）
- 相比 Ammo.js（Bullet 的 emscripten 编译）API 设计更现代、文档更好
- 比 Jolt 更轻量——Jolt 适合 AAA 级别需求，对高中物理场景过重

### 决策: 主线程物理（v1），预留 Worker 迁移路径

**理由:**
- 高中经典力学场景实体数 < 50，主线程完全够用
- 避免 Worker 的 SharedArrayBuffer 跨域限制（需要特殊 HTTP headers）
- `SimulationLoop` 和 `PhysicsWorld` 接口设计支持后续迁移到 Worker（`snapshot()` 返回 `Float32Array` 天然支持 Transferable）
- v1 快速验证，性能瓶颈确认后再 Worker 化

### 决策: 单 Zustand Store 多 Slice 而非多 Store

**理由:**
- 现有代码已采用此模式——保持一致性
- 场景编辑状态和仿真运行状态需要交叉引用（选中物体=仿真实体映射）
- Zustand v5 的 slice 模式（`create(() => ({ ...sceneSlice, ...simSlice }))`）组织清晰
- 避免多 Store 间的订阅协调复杂度

---

## Scaling Considerations

| 规模 | 场景复杂度 | 调整措施 |
|------|-----------|----------|
| MVP (0-50 实体) | 单个斜面+球+弹簧，2-3 物体场景 | 主线程物理，标准渲染，无优化需要 |
| 进阶 (50-200 实体) | 复杂场景，多碰撞体、力场叠加 | 启用 `collider.setActiveEvents(CONTACT_FORCE_EVENTS)` 减少事件开销；实例化渲染 (InstancedMesh) |
| 大量 (200-2000 实体) | 粒子系统、沙盒场景 | Worker 化物理计算；LOD 渲染；空间哈希/八叉树场景管理 |
| 多领域 (力学+光学+...) | 多求解器并行 | Worker Pool——每个领域独立 Worker；场景图管理领域间数据传递 |

### 优化优先级

1. **第一个瓶颈:** 碰撞事件回调过多 — 默认只开启需要的碰撞事件类型（`CONTACT_FORCE_EVENTS` vs `ACTIVE_EVENTS`）
2. **第二个瓶颈:** 渲染帧率下降 — 实例化渲染 (`InstancedMesh`) + 视锥剔除 + LOD
3. **第三个瓶颈:** 主线程卡顿 — Worker 化物理计算（此时架构已支持，迁移成本低）

---

## Anti-Patterns

### Anti-Pattern 1: 在 rAF 中直接用可变 dt 调用 world.step()

**错误做法:**
```typescript
// NEVER DO THIS
function animate() {
  requestAnimationFrame((dt) => {
    world.step(dt / 1000); // dt 随帧率变化！
  });
}
```

**后果:** 不同设备物理结果不同、切标签后爆炸、碰撞偏移。

**正确做法:** 固定时间步长 + 累加器（见 Pattern 2）。

---

### Anti-Pattern 2: 在 React 组件中直接操作物理世界

**错误做法:**
```typescript
function Ball({ entityId }) {
  const meshRef = useRef();
  useFrame(() => {
    // NEVER: 在 R3F useFrame 中做物理
    const body = physicsWorld.getBody(entityId);
    body.applyForce({ x: 0, y: -9.81, z: 0 });
  });
}
```

**后果:** React 生命周期与物理步长不同步；force 每个 rAF 都施加（而非每个物理步长）；难以测试。

**正确做法:** 物理逻辑全部在 `simulation/` 目录的纯 TypeScript 中，React UI 只触发 actions、订阅 store。

---

### Anti-Pattern 3: 预设每个物理场景类型的独立模块

**错误做法:**
```
src/
├── projectile-motion/    // 抛体运动模块
├── incline-plane/        // 斜面模块
├── collision/            // 碰撞模块
└── circular-motion/      // 圆周运动模块
```

**后果:** 废案（PROJECT.md 记录的失败原因）。用户只能使用预设模板，无法自由组合。

**正确做法:** 组件组合模式——所有场景由基础原语（球体、方块、斜面、弹簧、力场、约束）自由拼搭。

---

### Anti-Pattern 4: 渲染层持有物理副本

**错误做法:** Three.js mesh 的 `userData` 同时存储物理属性，两边互相写入。

**后果:** 两个"真相来源"必然不同步；难以调试；无法无头运行。

**正确做法:** 物理世界是唯一权威状态，渲染层纯粹是只读镜像（Pattern 3）。

---

## Integration Points

### 外部服务

| 服务 | 集成方式 | 注意事项 |
|------|----------|----------|
| 后端 REST API | `fetch` 封装在 `api/client.ts` | 场景序列化格式需与 Rapier 序列化一致 |
| WebSocket | 现有 `SimulationWebSocket` 骨架 | 传输二进制快照 (`Float32Array` + Transferable)，非 JSON；delta 压缩谨慎使用 |

### 内部边界

| 边界 | 通信方式 | 注意事项 |
|------|----------|----------|
| `simulation/` ↔ `rendering/` | 单向数据流: `PhysicsSnapshot` → `SyncSystem` | 渲染层不写入仿真层；用 ID 映射而非索引 |
| `simulation/` ↔ `store/` | Zustand actions 触发仿真方法调用 | 仿真核心不依赖 Zustand（可无头运行）；通过回调/事件通知状态变化 |
| `store/` ↔ `editor/` | React hooks (`useStore`) | 编辑器通过 store actions 操作，不直接接触 simulation/ |
| `simulation/` ↔ `domain/` | 接口实现 + 注册 | 核心框架不知道具体领域细节；领域通过 `IDomainPlugin` 接入 |
| `main thread` ↔ `physics worker` | `postMessage` + `Float32Array` Transferable | 只传快照，不传实体结构；每帧最多 120 次同步 |

---

## Build Order Implications

基于架构依赖关系，建议的构建顺序：

### Phase 1: 仿真核心 (simulation/)

**依赖:** 无（纯 TypeScript + Rapier WASM）
**构建:** `PhysicsWorld` → `EntityNode` → 组件(Component)接口 → `SimulationLoop`
**可验证:** 无头测试——创建实体、施加力、step、验证位置变化

### Phase 2: 渲染层 (rendering/)

**依赖:** Phase 1 完成（需要 `PhysicsSnapshot` 格式）
**构建:** Three.js Scene → 基础物体渲染器 → `RenderLoop` + `SyncSystem`
**可验证:** 球体自由下落可视化；方块堆叠

### Phase 3: 状态管理 (store/)

**依赖:** Phase 1 + Phase 2 完成（需要 action 目标）
**构建:** Zustand store slices → 完善 `api.ts` → 仿真生命周期 actions
**可验证:** UI 控制开始/暂停/重置

### Phase 4: 场景编辑器 (editor/)

**依赖:** Phase 3 完成（需要 store actions 和管理状态）
**构建:** Toolbox → EditorCanvas → PropertyPanel → 拖拽逻辑
**可验证:** 拖拽球体到画布、设置质量、点击开始模拟

### Phase 5: 领域扩展与后端集成

**依赖:** Phase 1-4 完成
**构建:** 场景持久化/加载 → WebSocket 流 → `IDomainPlugin` 接口定义
**可验证:** 保存/加载场景；实时同步；力学领域作为正式 plugin

---

## Sources

- [Rapier JavaScript 用户指南](https://rapier.rs/docs/user_guides/javascript/getting_started_wasm) — 官方文档，Rapier WASM API 参考 [HIGH confidence]
- [@dimforge/rapier.js Context7 文档](https://context7.com/dimforge/rapier.js) — API 片段与示例 [HIGH confidence]
- [Glenn Fiedler, "Fix Your Timestep!"](https://gafferongames.com/post/fix_your_timestep/) — 固定时间步长的经典参考 [HIGH confidence]
- [Three.js 官方文档](https://threejs.org/docs/) — WebGL 渲染器 API [HIGH confidence]
- [Verekia Architecture (R3F + Miniplex ECS)](https://lobehub.com/skills/verekia-r3f-gamedev-verekia-architecture) — 游戏 ECS 与 React 渲染分离的实战模式 [MEDIUM confidence]
- [Cannon-es / Three.js 分离架构](https://browse.library.kiwix.org/content/stackoverflow.com_en_all_nopic_2022-07/questions/27640270/de-coupling-physics-data-changing-components-from-render-system) — 物理-渲染分离的社区共识 [MEDIUM confidence]
- [Threlte Rapier v3.0.0 发布说明](https://blog.gitcode.com/14e3525584792f57275bcee25aba4ffb.html) — 2025 年 Rapier 框架集成的最新实践 [MEDIUM confidence]
- [Fnms Architecture (2024)](http://www.txxb.com.cn/EN/Y2024/V45/I6/1207) — 多物理场耦合的四层场景图架构 [MEDIUM confidence]
- [SOFA Framework 场景图设计](https://sofa-framework.github.io/doc/simulation-principles/scene-graph/) — 仿真框架场景图的学术参考 [MEDIUM confidence]

---
*Architecture research for: Physis — 组件化物理模拟平台*
*Researched: 2026-04-30*
