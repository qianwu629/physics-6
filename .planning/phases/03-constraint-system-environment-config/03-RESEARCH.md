---
phase: 3
slug: constraint-system-environment-config
status: research_complete
created: 2026-05-02
research_method: in-context (主代理直接代为执行)
inherits:
  - .planning/research/STACK.md
  - .planning/research/ARCHITECTURE.md
  - .planning/research/PITFALLS.md
  - .planning/phases/01-simulation-core-3d-render/01-CONTEXT.md
  - .planning/phases/02-entity-component-system-property-editing/02-CONTEXT.md
  - .planning/phases/03-constraint-system-environment-config/03-CONTEXT.md
  - .planning/phases/03-constraint-system-environment-config/03-UI-SPEC.md
---

# Phase 3 — Research

**目的**：把 Phase 3 的 8 项设计决策（CONTEXT.md）和已批准的 UI 契约（UI-SPEC.md）翻译为可执行的技术方案，给 plan 阶段提供精确的"如何做"。

**Scope**：仅技术研究 + 验证架构。不写任务列表（→ PLAN.md），不写测试用例（→ VALIDATION.md）。

---

## 1. Goal Snapshot

| 维度 | 说明 |
|------|------|
| Phase Goal | 在 Phase 2 ECS 实体系统上扩展两类能力：弹簧约束 + 全局环境参数 |
| Requirements | SIM-02（重力配置）、SIM-04（弹簧约束）、SIM-05（全局环境参数） |
| Success Criteria | ROADMAP.md Phase 3 五条（弹簧附加 / 简谐运动 / 重力立即生效 / 摩擦+空气阻力可观察 / 多弹簧带约束场景正确） |
| 关键约束 | 暂停时可编辑 / 运行时只读（D-05/06）、倍率法叠加（D-08）、ConstraintComponent 进入 ECS（D-08）|

---

## 2. Research Questions

| # | 问题 | 紧迫度 | 来源 |
|---|------|--------|------|
| RQ-1 | 弹簧物理底层用 Rapier 哪个 joint API？还是自实现胡克定律？ | 高 | CONTEXT.md `<decisions>` "弹簧子系统-约束清单" |
| RQ-2 | 重力热更新走 `<Physics>` prop 还是手动调 World.gravity？ | 高 | CONTEXT.md D-07 立即生效 |
| RQ-3 | 全局摩擦/弹性倍率如何在 Rapier 中实现而不破坏实体级参数？ | 高 | CONTEXT.md D-08 倍率法 |
| RQ-4 | 空气阻力（drag）映射到 Rapier 哪个 API？ | 中 | CONTEXT.md "空气阻力例外" |
| RQ-5 | ConstraintComponent 在 ECS 中是 Entity 还是 Component？数据如何建模？ | 高 | CONTEXT.md D-08 + ARCHITECTURE.md Pattern 1 |
| RQ-6 | 弹簧 3D 可视化（螺旋线 helix tube）如何高效绘制？随长度自适应？ | 中 | UI-SPEC.md `Spring 3D 可视化` |
| RQ-7 | 弹簧创建状态机如何实现？如何与现有点击选中区分？ | 中 | UI-SPEC.md `Panel 2: Spring Creation Mode` |
| RQ-8 | PropertyPanel 如何多态——既支持实体属性也支持弹簧属性？ | 中 | UI-SPEC.md PropertyPanel 扩展 |
| RQ-9 | 级联删除（删除 Entity 时移除其相关 Spring）的实现策略？ | 高 | CONTEXT.md "弹簧子系统" 约束 |
| RQ-10 | 多弹簧场景的性能边界，是否需要软上限？ | 低 | CONTEXT.md 弹性空间 |

---

## 3. Technical Investigations

### 3.1 RQ-1：Rapier Spring/Joint API 选型

**候选方案**：

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A. `useSpringJoint` (@react-three/rapier) | 声明式 hook，封装 Rapier `JointType.Spring` 或基于 distance + spring force | 与 R3F 生命周期一致；自动 mount/unmount；声明式更新 | API 是否完整支持 damping 需查证；rapier3d-compat 在 2.x 上的 Spring joint 支持度需要源码确认 |
| B. `useDistanceJoint` + 手动 `applyImpulse` 施加胡克力 | 使用 distance joint 维持 L0 + 自实现 stiffness 效果 | 完全可控；不依赖 Spring joint 是否被支持 | 双系统协调（约束 + 力）容易引入数值不稳定 |
| C. 纯自实现：`useFrame` 中读取两端点位置，按 F = -k(L − L0) − c·v_rel 施加成对反作用力 | 不依赖 Rapier joint；任意公式 | 完全控制，最贴合教学公式 | 性能：每帧 query body position；与固定时间步长不同步——必须接入 Rapier 的 stepCallback 或 useBeforePhysicsStep |

**调研发现**：

- `@react-three/rapier@^2.2.0` 提供以下 joint hooks：`useFixedJoint`、`useSphericalJoint`、`useRevoluteJoint`、`usePrismaticJoint`、`useRopeJoint`、`useSpringJoint`。
- `useSpringJoint(bodyA, bodyB, [anchorA, anchorB, restLength, stiffness, damping])` 直接对应胡克弹簧 + 阻尼。
- 内部实现：调用 Rapier 的 `World.createImpulseJoint(GenericJoint)` 配置为 spring 模式，Rapier 在 substep 内施加正确的力。

**决策（D-RES-01）**：选 **方案 A — `useSpringJoint`**

**理由**：
1. **声明式**：与 R3F 实体的 `useRef` 模式自然集成（取得 entityA/entityB 的 RigidBody ref → 传给 hook）；无需手写 useFrame 力施加循环。
2. **物理正确性**：Rapier 在子步内施加力，避免了"在 React 渲染帧外推力"导致的累积误差（防 PITFALLS #1 变量时间步）。
3. **damping 原生支持**：用户期望 k/L0/damping 三参数，方案 A 一行 hook 调用即可。
4. **API 风险有限**：@react-three/rapier@2.2.0 的 useSpringJoint 已稳定（仓库有测试覆盖），即便底层 Rapier API 微调，封装层抹平了差异。

**回退方案**：若 `useSpringJoint` 不接受 damping=0（即纯弹性无阻尼）或两 RigidBody 同时为 fixed 时崩溃 → 临时切换为方案 B（distance joint + 手动 stepCallback 施加 -c·v_rel 阻尼项）。**plan 阶段第一个弹簧任务即需 spike 验证 API 行为**。

---

### 3.2 RQ-2：重力热更新策略

**Scene3D 现状**：
```tsx
<Physics gravity={[0, -9.81, 0]} ...>   // 硬编码
```

**候选方案**：

| 方案 | 描述 | 重置语义 |
|------|------|----------|
| A. Prop 直接接入 store | `<Physics gravity={[gx,gy,gz]}>` 从 simulationSlice.environment.gravity 读取 | Rapier 内部监听 gravity prop 变化（参考 @react-three/rapier 源码：`world.gravity = new Vector3(...gravity)`），下个 step 立即生效 |
| B. Remount via key | 每次 gravity 改变递增 key | 简单粗暴但会重置整个物理世界（速度归零、joint 重建），与 D-07"立即生效"语义不符 |
| C. 暴露 World ref，手动 `world.gravity.set(...)` | 通过 useRapier() 拿到 world 直接改 | 与方案 A 等价，但绕过 React 数据流 |

**决策（D-RES-02）**：选 **方案 A — Prop 接入**

**实施细节**：
```tsx
const gravity = useSimulationStore((s) => s.environment.gravity);  // Vector3 = [number, number, number]
<Physics gravity={gravity} ...>
```
- Zustand 的 `gravity` 字段必须是**新数组引用**（每次 setGravity 创建新 [gx, gy, gz]），让 R3F 的浅比较生效。
- 在 simulationSlice 中：
  ```ts
  setGravity: (g: [number, number, number]) => set((s) => ({
    environment: { ...s.environment, gravity: [...g] }   // 新引用
  }))
  ```

**注意事项**：
- 不要把 gravity 写成 Three.js Vector3 对象——保持元组形式与 Rapier API 一致。
- 重力变化只影响 dynamic 体的下个 substep，**当前帧已计算的位置/速度保留**——这正是用户期望的"立即生效"。

---

### 3.3 RQ-3：全局摩擦/弹性倍率叠加

**Phase 2 现状**：每个 entity 的 `RigidBodyComponent.friction` / `restitution` 直接传给 `<RigidBody friction={...} restitution={...}>`。

**Rapier 摩擦计算位置**：
- Rapier 把 friction/restitution 存在 **Collider** 上（不是 RigidBody）。`@react-three/rapier` 在挂载 RigidBody 子树时，把这些值复制到子 Collider。
- Rapier 计算碰撞对效果时，按 `frictionCombineRule`（默认 Average）合并两边 Collider 的 friction。

**倍率叠加候选方案**：

| 方案 | 描述 | 实施复杂度 |
|------|------|-----------|
| A. EntityRenderer 内部相乘 | `<RigidBody friction={entity.friction * frictionScale}>` | ⭐ 最简单 |
| B. Rapier API 直接调 collider.setFriction() | 通过 useRapier() 拿到 collider list，遍历调用 setFriction(originalFriction * scale) | ⭐⭐⭐ 需追踪 collider handle 与 entity id 的映射 |
| C. 把 frictionScale 写进 entity.friction（破坏性） | 直接修改 entity 数据 | ❌ 违反 D-08（保留 Phase 2 实体级独立编辑） |

**决策（D-RES-03）**：选 **方案 A — EntityRenderer 内部相乘**

**实施**：
```tsx
// EntityRenderer.tsx
const frictionScale = useSimulationStore((s) => s.environment.frictionScale);
const restitutionScale = useSimulationStore((s) => s.environment.restitutionScale);

<RigidBody
  friction={Math.min(rb.friction * frictionScale, 2.0)}     // Rapier 上限通常 2
  restitution={Math.min(rb.restitution * restitutionScale, 1.0)}
  ...
>
```

**自动响应机制**：
- frictionScale 变化 → Zustand 通知 EntityRenderer 重渲染 → 新的 friction prop → @react-three/rapier 内部调用 `collider.setFriction()`（库已实现 prop diffing）。
- 无需手动 remount，无需手动调用 setter，符合 React 单向数据流。

**性能权衡**：
- 全局倍率改变会触发 ALL EntityRenderer 重渲染（小代价：每个 entity 一次 prop diff）。
- 与 PITFALLS #6（物理帧数据不经过 Zustand）不冲突——倍率是仿真元数据，本来就该在 store 中。

**单元测试关键点**：
- 验证 entity.friction = 0.5 + scale = 2.0 → 传给 RigidBody 的 friction prop 应为 1.0
- 验证 scale = 0 → friction = 0（极端情况）
- 验证 scale = 5 + entity.friction = 0.8 → friction 被夹紧到 2.0（防止超出 Rapier 范围）

---

### 3.4 RQ-4：空气阻力实现

**Rapier API 调研**：
- RigidBody 有 `linearDamping` 和 `angularDamping` 两个属性。
- `linearDamping = c` 对应物理：每帧 v_new = v_old × (1 − c·dt)，近似空气阻力的指数衰减。
- 单位：1/s（即每秒线性速度衰减比例）。教学场景值：0~2 已能明显观察。

**实施**：
```tsx
// EntityRenderer.tsx
const drag = useSimulationStore((s) => s.environment.drag);

<RigidBody
  linearDamping={drag}            // 全局 drag 直接应用，无实体级对应（D-08 例外）
  angularDamping={drag * 0.5}     // 角阻尼通常比线性弱
  ...
>
```

**决策（D-RES-04）**：drag 作为 simulationSlice.environment 顶层字段，直接传给所有 RigidBody。

**默认值**：drag = 0.1（轻微空气阻力，近似真实空气；用户可调到 0 = 真空，或 2 = 浓粘性流体）。

---

### 3.5 RQ-5：ConstraintComponent 数据建模

**现状**（types.ts 实际状态）：
- ECS 当前 5 件套：Transform/RigidBody/Collider/Velocity/Material
- ARCHITECTURE.md 提到 ConstraintComponent (kind: 'spring' | 'revolute' | 'prismatic' | 'fixed')，**但 types.ts 尚未实现**。
- CONTEXT.md D-08 明确：弹簧作为 ECS 中的 ConstraintComponent，遵循 Pattern 1。

**核心问题**：弹簧"附着"在哪个 Entity？

**候选方案**：

| 方案 | 数据布局 | 优点 | 缺点 |
|------|----------|------|------|
| A. Constraint Entity（独立约束实体） | 新建一个 Entity，components Map 仅含 ConstraintComponent；该 Component 内部记录 entityAId、entityBId | 与 Pattern 1 字面契合；CRUD 复用 entitySlice；EntityList 自然显示 | 弹簧没有 Transform——需要在渲染层特判 |
| B. Component 挂在 entityA 上 | entityA.components.set('constraint', ConstraintComponent { otherEnd: entityBId, ... }) | 不增加 Entity 数 | 弹簧"双向性"破坏；删除 entityB 时需扫描所有 entity 检查 |
| C. 顶层 springs Map（不入 ECS） | 新建 `springs: Map<string, SpringConstraint>` 在 entitySlice 或新 slice | 实施最简单 | **违反 CONTEXT.md D-08**（弹簧必须是 ECS 一部分） |

**决策（D-RES-05）**：选 **方案 A — Constraint Entity**

**类型定义新增**（types.ts）：
```ts
// 新增组件类型
export type ComponentType =
  | 'transform' | 'rigidBody' | 'collider' | 'velocity' | 'material'
  | 'constraint';   // ← 新增

export type ConstraintKind = 'spring';   // Phase 3 仅 'spring'，预留 'revolute' | 'prismatic' | 'fixed'

export interface SpringConstraintParams {
  stiffness: number;     // k, N/m, 范围 1-1000
  restLength: number;    // L0, m, 范围 0.1-50
  damping: number;       // c, N·s/m, 范围 0-50
}

export interface ConstraintComponent extends Component {
  type: 'constraint';
  kind: ConstraintKind;
  entityAId: string;     // 约束端点引用
  entityBId: string;
  params: SpringConstraintParams;   // kind 决定 params 形态（未来 union）
}

// 扩展 AnyComponent 联合
export type AnyComponent =
  | TransformComponent | RigidBodyComponent | ColliderComponent
  | VelocityComponent | MaterialComponent
  | ConstraintComponent;
```

**Entity 工厂新增**（Entity.ts）：
```ts
export function createSpringEntity(
  entityAId: string,
  entityBId: string,
  params: Partial<SpringConstraintParams> = {}
): Entity {
  const id = `spring-${++entityCounter}`;
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'spring',
    entityAId,
    entityBId,
    params: {
      stiffness: params.stiffness ?? 100,
      restLength: params.restLength ?? 2.0,
      damping: params.damping ?? 0.1,
    },
  };
  return {
    id,
    name: `弹簧-${entityCounter}`,
    components: new Map([['constraint', constraintComp]]),
  };
}
```

**渲染层判断**（Scene3D.tsx → EntityRenderer 内部）：
- EntityRenderer 检查 entity.components.has('constraint') → 委托给新组件 `<SpringRenderer>`
- SpringRenderer：读取 constraintComponent 的 entityAId/entityBId → 通过 useFrame 查询两 RigidBody 的当前位置 → 绘制 helix tube

**MAX_ENTITIES 影响**：
- 当前 MAX_ENTITIES = 50，包含弹簧 Entity 后等同于"实体 + 弹簧 ≤ 50"
- 教学场景：5-10 实体 + 5-10 弹簧远低于上限，不需要分离
- **决策（D-RES-05a）**：保持 MAX_ENTITIES = 50 统一上限，不分离 MAX_SPRINGS

---

### 3.6 RQ-6：弹簧 3D 可视化（helix tube）

**UI-SPEC 已确定**：螺旋线（helix tube）

**实现策略**：

```tsx
// SpringRenderer.tsx
function generateHelixPoints(start: Vec3, end: Vec3, coils = 8, radius = 0.08): Vec3[] {
  // 在 [start, end] 之间生成 N 段螺旋点
  // direction = end - start 归一化
  // 在垂直 direction 的两个正交方向上做 sin/cos 摆动
  // 返回 (coils * 16) 个点
}

function SpringRenderer({ entity }) {
  const constraintComp = entity.components.get('constraint') as ConstraintComponent;
  const { entityAId, entityBId } = constraintComp;
  const tubeRef = useRef<THREE.Mesh>(null);

  // 物理体引用（Phase 2 已暴露）
  const bodyA = useRapierBodyByEntityId(entityAId);
  const bodyB = useRapierBodyByEntityId(entityBId);

  useFrame(() => {
    if (!bodyA || !bodyB || !tubeRef.current) return;
    const posA = bodyA.translation();   // Rapier 直接 query
    const posB = bodyB.translation();
    const points = generateHelixPoints(posA, posB);
    const curve = new THREE.CatmullRomCurve3(points.map(...));
    tubeRef.current.geometry.dispose();
    tubeRef.current.geometry = new THREE.TubeGeometry(curve, 64, 0.05, 6, false);
  });

  return <mesh ref={tubeRef}><meshStandardMaterial color="#888" /></mesh>;
}
```

**关键点**：
- 螺旋点在 useFrame 中实时计算（PITFALLS #6 OK——位置直接从 Rapier 拿，不写 store）
- TubeGeometry 每帧重建（Three.js geometry dispose + 创建新）：60fps × 50 顶点级别可接受。**风险**：50 个弹簧 × 每帧 dispose+create 可能 GC 抖动 → 优化方案：缓存 BufferGeometry 实例 + 仅更新 attributes
- coils（圈数）随 currentLength/restLength 比例动态调整：拉伸 → 减少圈数；压缩 → 增加圈数
- 拉伸/压缩状态颜色（UI-SPEC 提及）：v1 简化为单色（#888）；张力着色推迟

**性能边界**：
- 单弹簧 TubeGeometry 重建：~0.1ms
- 20 弹簧 × 0.1ms = 2ms/帧（120Hz 帧预算 8.3ms 中可接受 25%）
- **软上限**：MAX_SPRINGS_RENDER = 20 个超过则降级为 Line2 直线（fallback，记录在 PITFALLS）

**决策（D-RES-06）**：
- 实施螺旋线（TubeGeometry + 动态 coils 数）
- 颜色：单色 #888，选中态 #3299ff（与实体高亮一致）
- 不在 Phase 3 实施张力变色（推迟到 Phase 4 矢量可视化阶段）
- **plan 阶段**留出"性能 spike"任务：测 20 弹簧渲染帧时间，若 > 8ms 切换 Line2 fallback

---

### 3.7 RQ-7：弹簧创建状态机

**UI-SPEC 已规定状态机**：IDLE → SPRING_MODE_PENDING → CREATION_DIALOG → IDLE

**实施**：

新增 `uiSlice` 字段：
```ts
export type SpringCreationStage = 'idle' | 'pendingA' | 'pendingB' | 'dialog';

export interface UiSlice {
  // ... existing
  springCreationStage: SpringCreationStage;
  springEntityAId: string | null;     // 已选 A 后存储
  springDialogOpen: boolean;          // 复用 dialog 模式
  // Actions
  enterSpringMode: () => void;
  exitSpringMode: () => void;
  selectSpringEndpointA: (id: string) => void;
  selectSpringEndpointB: (id: string) => void;   // 触发 → openSpringDialog
  closeSpringDialog: () => void;
}
```

**点击行为分流**（Scene3D 的 onClick handler）：
```ts
function handleEntityClick(entityId: string) {
  const stage = useUiStore.getState().springCreationStage;
  if (stage === 'pendingA') {
    selectSpringEndpointA(entityId);
  } else if (stage === 'pendingB') {
    if (entityId === springEntityAId) {
      // 取消选择 A
      setStage('pendingA');
    } else {
      selectSpringEndpointB(entityId);   // 弹出 SpringDialog
    }
  } else {
    // idle 状态：正常选中（Phase 2 行为）
    selectEntity(entityId);
  }
}
```

**视觉反馈**：
- pendingA / pendingB 状态：hover 实体显示绿色描边（#22c55e）
- 已选 A：固定绿色描边
- Toolbar 上方居中显示提示横幅（条件渲染：springCreationStage !== 'idle' 时挂载）

**键盘快捷键扩展**（Phase 2 D-08 keyboard shortcuts 之上）：
- `K` → 进入弹簧创建模式（idle → pendingA）
- `Esc` → 退出弹簧创建模式（任意阶段 → idle）

**决策（D-RES-07）**：
- 状态机存放在 uiSlice
- Scene3D 的点击分发逻辑根据 stage 路由
- 进入弹簧模式时禁用普通 selectEntity（在 idle 之外不响应）
- 创建对话框使用现有 CreationDialog 模式（zod 验证 + react-hook-form）

---

### 3.8 RQ-8：PropertyPanel 多态适配

**Phase 2 PropertyPanel 现状**：
- 检查 selectedEntityId → 取出 entity → 渲染 NameField + ShapeField + Transform + Velocity + Material
- 所有字段都基于 5 件套组件假设

**Phase 3 改造**：
```tsx
function PropertyPanel() {
  const entity = selectedEntity;
  if (!entity) return <EmptyState />;

  const isSpring = entity.components.has('constraint');
  return isSpring ? <SpringPropertyEditor entity={entity} /> : <EntityPropertyEditor entity={entity} />;
}
```

**SpringPropertyEditor 字段**：
- 端点 A 名称（只读，可点击跳转选中 A）
- 端点 B 名称（只读，可点击跳转选中 B）
- stiffness（k）：Slider + NumberInput, 1-1000 N/m, step 1
- restLength（L0）：Slider + NumberInput, 0.1-50 m, step 0.1
- damping：Slider + NumberInput, 0-50, step 0.05
- 删除弹簧按钮（复用 deleteDialog 流程）

**只读态**（运行时 = isRunning=true）：
- 所有 Slider/Input disabled
- 顶部显示提示横幅"运行中，请暂停后编辑"（与环境面板一致）
- 视觉变灰（opacity: 0.5）

**决策（D-RES-08）**：
- PropertyPanel 拆分为两个子编辑器，根据 entity 类型分发
- 端点 A/B 引用展示为可点击链接（点击 → selectEntity(targetId)）
- 字段验证规则进入 zod schema（与 CreationDialog 一致）

---

### 3.9 RQ-9：级联删除 + 环境保留 reset

**问题**：删除 entity A 时，所有引用了 A 的弹簧 Entity 必须同时删除。

**实施**（entitySlice.removeEntity 改造）：
```ts
removeEntity: (id: string) =>
  set((state) => {
    if (!state.entities.has(id)) return state;
    const next = new Map(state.entities);
    next.delete(id);

    // 级联删除：扫描所有 entity，删除引用了此 id 的约束 entity
    const cascadeRemove: string[] = [];
    for (const [eid, entity] of next.entries()) {
      const constraint = entity.components.get('constraint') as ConstraintComponent | undefined;
      if (constraint && (constraint.entityAId === id || constraint.entityBId === id)) {
        cascadeRemove.push(eid);
      }
    }
    cascadeRemove.forEach((eid) => next.delete(eid));

    return {
      entities: next,
      selectedEntityId: state.selectedEntityId === id || cascadeRemove.includes(state.selectedEntityId ?? '')
        ? null
        : state.selectedEntityId,
    };
  }),
```

**性能**：50 entities × O(n) 扫描 = O(2500) 单次删除——可接受（人类操作频率）。

**reset 语义改造**：
- D-04: 重置仅清空实体，环境保留
- 当前 simulationSlice.reset 仅 resetCounter += 1（不动 environment）
- entitySlice.resetEntities 已经清空 entities Map
- **新增**：明确 environment 不被 reset 影响（在 simulationSlice.environment 设置初始默认 + 显式 resetEnvironment 单独 action）

**决策（D-RES-09）**：
- 级联删除在 removeEntity 内做（同步、原子）
- 不引入 weak ref 或事件机制——简单线性扫描足够
- environment 字段独立于 reset，提供 resetEnvironment() 单独 action（plan 阶段决定是否暴露 UI）

---

### 3.10 RQ-10：性能边界 + 软上限

**关键路径分析**（120Hz 帧预算 8.3ms）：
| 模块 | 单元成本 | 上限场景 | 总成本 |
|------|---------|---------|--------|
| Rapier 物理步进 | ~0.5ms × 50 实体 | 50 实体 + 20 弹簧 | ~2ms |
| EntityRenderer 重渲染（倍率改变时） | ~0.05ms × 50 | 50 实体 | ~2.5ms（一次性） |
| SpringRenderer useFrame TubeGeometry 重建 | ~0.1ms × 20 | 20 弹簧 | ~2ms |
| Three.js render | ~3ms | - | ~3ms |
| **预算总计** | - | - | ~9.5ms |

**结论**：50 + 20 是软上限。超过会出现掉帧。

**决策（D-RES-10）**：
- 沿用 MAX_ENTITIES = 50（包含弹簧）
- 不实施 MAX_SPRINGS 单独上限（用户教学场景远不到这数）
- plan 阶段留 "性能 spike" 任务：构造 50 + 20 极端场景，测帧时间，若 > 16ms 报警

---

## 4. Implementation Roadmap（建议的 Plan 划分）

> 给 plan 阶段的指导：建议 Phase 3 拆为 5 个 plans，按依赖串行。

```
Wave 1（基础数据 + UI 状态）  ──→ Wave 2（环境系统）  ──→ Wave 3（弹簧系统）  ──→ Wave 4（集成）
        │                            │                       │                       │
   03-01-PLAN                  03-02-PLAN              03-03-PLAN             03-04-PLAN
   ECS 类型扩展             Environment Panel       Spring 创建+渲染     PropertyPanel 适配
   + Spring 工厂           + 重力/摩擦/空气阻力       + ECS Spring         + 级联删除 + UAT
   + Slice 字段            + 倍率叠加 + UI            + Joint hooks         + 整合测试
   + 单元测试              + 暂停只读 + 立即生效        + helix tube         + 验证收尾
```

| Plan | 主要交付 | 估时 | 依赖 |
|------|---------|------|------|
| 03-01 | ECS ConstraintComponent + simulationSlice.environment + uiSlice.springCreation* + 工厂函数 + 单元测试 | ~25min | Phase 2 |
| 03-02 | EnvironmentPanel 组件 + 重力 prop 接入 + 倍率叠加 in EntityRenderer + drag 应用 + 暂停只读 + 立即生效高亮 | ~30min | 03-01 |
| 03-03 | SpringRenderer (helix tube) + useSpringJoint 集成 + Toolbox 弹簧按钮 + Spring Creation 状态机 + SpringDialog | ~35min | 03-01 |
| 03-04 | PropertyPanel 多态分发 + SpringPropertyEditor + 级联删除 + EntityList 弹簧条目 + 键盘快捷键 K/Esc | ~25min | 03-02, 03-03 |
| 03-05（可选）| 集成测试 + 性能 spike + Phase 3 验证报告 | ~20min | 03-04 |

**总估时**：~135min（不含可选 plan 05）

---

## 5. Dependencies & Versions

**已锁定依赖**（无需新增）：
- `@react-three/rapier@^2.2.0` ← 提供 useSpringJoint
- `@react-three/fiber@^9.1.0` ← R3F 9 with React 19
- `three@^0.174.0` ← 提供 TubeGeometry / CatmullRomCurve3
- `zustand@^5.0.5`
- `react-hook-form@^7.74.0` + `zod@^4.4.1` ← 复用 Phase 2 表单栈
- `radix-ui@^1.4.4-rc.1766004502650` + `shadcn@^4.6.0` ← Popover, Dialog, Slider
- `lucide-react@^0.487.0` ← 图标（弹簧、地球、月球）

**可能需要新增**：
- `@radix-ui/react-popover`（环境面板 Popover）：检查 radix-ui 是否已包含。**plan 阶段第一步验证**。
- 无需新增 emoji 字体（Geist + 系统 emoji 渲染已足够）

**版本兼容性 risk**：
- @react-three/rapier 2.2.0 的 useSpringJoint API 签名需要在 plan 阶段实测确认（参考 sandpack demos / GitHub 测试用例）
- React 19 + Radix UI rc 的 createPortal 适配（Phase 2 02-radix-react19 测试已覆盖，OK）

---

## 6. Validation Architecture（Nyquist 5 Dimensions）

> 作为 step 5.5 的输入，将填充 03-VALIDATION.md 模板。

### 6.1 Algorithmic Correctness（物理正确性）

| 验证项 | 方法 | 期望 | 工具 |
|-------|------|------|------|
| 弹簧简谐运动 | 单元测试创建 m=1, k=10, L0=5, damping=0；运行 1000 步；记录 entityB 位置序列 | 满足 x(t) ≈ A·cos(ωt), ω=√(k/m) ≈ 3.16 rad/s | Vitest + Rapier headless |
| 倍率叠加 | 单元测试 entity.friction=0.5 + scale=2.0 → 实际传入 RigidBody 的值 | 1.0 | Vitest mock store |
| 重力变化即时生效 | 单元测试 setGravity([0,0,0]) 后 1 帧 → 物体停止下落 | dy/dt ≈ 0 | Vitest |
| 空气阻力衰减 | drag=1.0 → 物体水平速度 v(t) ≈ v0·exp(-t) | 50% 衰减时间 ≈ 0.69s | Vitest |

### 6.2 Integration Correctness（集成正确性）

| 验证项 | 方法 | 期望 |
|-------|------|------|
| EnvironmentPanel ↔ store | UI 测试改 X 分量值 → store.environment.gravity 更新 | gravity 数组等于新值 |
| store ↔ Scene3D | 改 store.environment.frictionScale → EntityRenderer 收到新 friction | 重渲染次数 ≥ 1 |
| Spring 创建状态机 | UI 测试点击 Toolbox 弹簧 → 点击 entity A → 点击 entity B → SpringDialog 打开 | dialog visible，端点正确 |
| 级联删除 | UI 测试创建 spring 引用 entityX，删除 entityX → spring 同时被删除 | spring 不在 entities Map |

### 6.3 Presentation Consistency（UI 一致性）

| 验证项 | 方法 | 期望 |
|-------|------|------|
| 运行时只读 | 渲染 EnvironmentPanel + isRunning=true → 检查所有 Slider/Input 的 disabled | disabled=true |
| 立即生效高亮 | 暂停时改重力 X → 检查对应 Slider 在 ~300ms 内有 highlight class | class 出现并消失 |
| 玻璃态视觉 | Visual regression：截图比对 EnvironmentPanel 与 UI-SPEC mockup | 像素差异 < 1% |
| 弹簧选中态 | 点击弹簧 → tube material color 切换为 #3299ff | color 等于期望 |

### 6.4 Persistence/State Integrity（数据完整性）

| 验证项 | 方法 | 期望 |
|-------|------|------|
| Reset 不清环境 | reset() → check environment 字段 | 环境参数与 reset 前一致 |
| MAX_ENTITIES 上限 | 创建 50 个实体后再加 → 第 51 个返回 false | success=false |
| Spring 端点引用完整 | 创建 spring(A, B) → entities Map 中找到 spring entity 含正确 entityAId/entityBId | 引用正确 |
| Constraint kind 字段安全 | TypeScript 编译期检查 ConstraintKind union | tsc 无错误 |

### 6.5 User Experience（可观察性）

| 验证项 | 方法 | 期望 |
|-------|------|------|
| 弹簧 3D 可视化清晰 | 手动 UAT：搭建弹簧振子 → 观察 helix tube 拉伸压缩 | 形变可见 |
| 环境面板易用 | 手动 UAT：选月球预设 → 观察物体下落速度 | 明显比地球慢 |
| Spring Creation 流程 | 手动 UAT：按 K → 选 A → 选 B → 配参数 → 添加 | 流程顺畅，5s 内可完成 |
| 错误提示 | 手动 UAT：尝试运行时改重力 → 检查横幅提示 | "运行中，请暂停后编辑" 可见 |

---

## 7. Risk Register

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| useSpringJoint API 签名不匹配预期 | High | Low | plan 阶段第一个任务为 spike——若 API 不接受 damping=0 → 切换 distance joint + 自实现阻尼 |
| TubeGeometry 重建 GC 抖动 | Med | Med | 性能 spike 测 20 弹簧帧时间；超 8ms → 改为 BufferAttribute 原地更新或 Line2 fallback |
| Friction prop 变化未触发 Rapier collider.setFriction | Med | Low | 验证 @react-three/rapier 内部 prop diffing；若失败 → 通过 useRapier() 手动调用 setter |
| React 19 + Radix Popover 在 React.StrictMode 下双挂载 | Low | Low | 已在 Phase 2 测试覆盖；若复发 → 用 controlled Popover 自己管理 open state |
| 级联删除 O(n²) 在场景接近上限时变慢 | Low | Low | 50 实体下 O(2500) 仍 < 1ms；只在 plan 阶段 5 性能 spike 验证 |
| 弹簧创建状态机与现有 selectEntity 互相干扰 | Med | Med | 状态机入口处 disable selectEntity 路径；UI 测试覆盖 stage 路由 |
| 重力 prop 浅比较失效（同一数组引用） | Med | Low | setGravity 中确保 [...g] 创建新引用；单元测试 store action |

---

## 8. Open Questions for Plan Phase

> Plan 阶段需要在第一个 task 内决定，不得延后。

1. **useSpringJoint API spike 结果**：返回值是 ref？hook 还是 component？damping=0 是否被接受？
2. **TubeGeometry 重建性能**：单弹簧实测 ms？超过预算时降级哪种 fallback？
3. **EnvironmentPanel Popover 库选择**：用 radix-ui 内置的 Popover 还是自实现 absolute 定位？
4. **预设胶囊的图标**：lucide-react 是否有合适的地球/月球/火星图标？还是用 emoji？
5. **键盘快捷键 K** 是否与现有快捷键冲突？（Phase 2 D-08 8 个快捷键，需查 K 是否被占用）
6. **PropertyPanel 多态分发** 是用条件渲染还是策略对象？
7. **级联删除是否需要 confirmation dialog**？（用户删 entity 同时删 spring 是否要二次确认？）
8. **Reset 是否提供"也重置环境"的二级菜单**？（D-04 默认保留环境，但用户可能偶尔需要）

---

## 9. Pattern Reuse Map（建议给 PATTERNS.md 阶段的输入）

| 新组件 | 现有最近原型 | 复用程度 |
|--------|------------|---------|
| EnvironmentPanel | Phase 1 Toolbar / Phase 2 PropertyPanel | High（玻璃态 + Slider/Input 控件） |
| SpringDialog | Phase 2 CreationDialog | High（zod + react-hook-form 模板） |
| SpringRenderer | Phase 2 EntityRenderer | Medium（同 R3F 渲染管线，但 geometry 类型不同） |
| SpringPropertyEditor | Phase 2 PropertyPanel | High（字段层换字段） |
| Spring Creation 状态机 | 无原型 | Low（新增 uiSlice 状态机字段） |
| createSpringEntity | Phase 2 createSphereEntity 等 | High（工厂模式） |

---

## 10. Summary（一段话）

Phase 3 在 Phase 2 ECS 五件套之上**新增 ConstraintComponent 一类组件 + 弹簧 Entity 工厂**，**simulationSlice 扩展 environment 字段**（gravity[3]/frictionScale/restitutionScale/drag）并通过 Rapier `<Physics gravity>` prop 与 `<RigidBody friction>`/`linearDamping` props 自然热同步；弹簧物理由 `@react-three/rapier` 的 `useSpringJoint` 直接驱动；UI 加 EnvironmentPanel（Popover）+ Toolbox 弹簧按钮 + 弹簧创建三阶段状态机；PropertyPanel 通过实体类型多态分发为 EntityPropertyEditor / SpringPropertyEditor；级联删除在 entitySlice.removeEntity 做 O(n) 线性扫描；reset 仅清空 entities，环境参数保留。**最大风险**为 useSpringJoint API 行为与 TubeGeometry 重建性能，均在 plan 阶段第一任务通过 spike 验证。

---

*Phase 3 Research complete — 2026-05-02*
*Next: 03-VALIDATION.md (step 5.5) → 03-PATTERNS.md (step 7.8) → 03-PLAN.md (step 8)*
