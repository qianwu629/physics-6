# Phase 2: 组件化实体系统与属性编辑 - Research

**Researched:** 2026-05-01
**Domain:** ECS组件架构 + 3D交互选择 + 属性编辑UI + Zustand状态管理
**Confidence:** HIGH

## Summary

Phase 2 需要实现三个核心能力：(1) 自建轻量ECS组件化架构作为场景数据模型，(2) 通过R3F内置事件系统实现3D点击选中+描边高亮，(3) 通过shadcn/ui构建左侧工具箱+创建对话框+右侧属性面板的完整编辑UI。

**ECS层**采用ARCHITECTURE.md Pattern 1（EntityNode + Component Map），约300行自建代码，五个组件类型（Transform/RigidBody/Collider/Velocity/Material）。ECS是纯数据层，不持有任何渲染逻辑。

**Rapier集成**采用声明式React模式——实体通过条件渲染`<RigidBody>`组件动态加入/离开物理世界。`@react-three/rapier`自动处理RigidBody/Collider的创建与清理。ECS的ColliderComponent数据在渲染时翻译为对应的Rapier JSX元素。

**3D选择**直接使用R3F内置事件系统（onClick/onPointerDown），无需手写Raycaster。选中高亮使用`@react-three/drei`的`<Outlines>`组件，条件渲染在选中实体上。

**Zustand Store**使用`Map<string, Entity>`存储实体集合，通过`new Map(prev)`模式保证不可变更新。物理帧数据绝不经过Zustand（维持PITFALLS #6防护），仅实体ID列表、选中ID、物体计数等元数据在store中。

**Primary recommendation:** 采用ECS数据模型+R3F声明式Rapier+Zustand Map存储+shadcn/ui面板的四层架构，每层职责清晰、边界明确。

## Architectural Responsibility Map

| Capability | Primary Layer | Secondary Layer | Rationale |
|------------|-------------|----------------|-----------|
| ECS实体/组件数据模型 | Simulation Core | — | 纯数据(POJOs)，零渲染依赖。EntityNode+Component Map是场景的权威定义。 |
| 实体创建工作流 | UI (React) | Simulation Core | 用户通过工具箱→对话框触发；Simulation Core执行EntityNode组装+Rapier刚体创建。 |
| 3D实体渲染 | Rendering (R3F) | Simulation Core (数据来源) | R3F+Rapier声明式组件根据ECS数据渲染网格+碰撞体。 |
| 点击选中（raycasting） | Rendering (R3F events) | State (更新选中ID) | R3F内置事件系统自动处理射线检测，无需手写Raycaster。 |
| 选中高亮（Outlines） | Rendering | State (选中状态) | drei Outlines组件条件渲染于选中实体mesh上。纯视觉效果。 |
| 属性面板编辑 | UI (React) | State → Simulation Core | Slider/Input修改Zustand state → Actions直接操作Rapier Body属性。 |
| ECS组件→Rapier JSX翻译 | Rendering (声明式桥接) | Simulation Core (组件数据) | 渲染层根据ColliderComponent.shape+params动态生成对应的Collider JSX。 |
| 实体删除 | State (协调) | Simulation Core + Rendering | 从ECS Map移除→React条件渲染自动卸载RigidBody→Rapier自动清理。 |
| 物理仿真 | Simulation Core (Rapier WASM) | — | Rapier固定120Hz步进。ECS为数据模型，不参与物理计算。 |
| Zustand实体存储 | State Management | — | Map<string, Entity> + selectedEntityId + entitiesList(衍生数组)。 |
| 重置（空场景） | UI → State → Simulation Core | — | 清空ECS Map + 递增resetCounter触发Physics remount。 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-three/rapier | 2.2.0 | Rapier WASM物理引擎的R3F声明式绑定 | Phase 1已集成验证通过；声明式API匹配ECS组件驱动的渲染模式 |
| @react-three/fiber | 9.1.0 | React的Three.js渲染器 | Phase 1已集成；内置事件系统覆盖点击选中需求 |
| @react-three/drei | 10.7.7 | R3F辅助组件集 | Outlines组件提供选中高亮；OrbitControls/GizmoHelper/Grid延续使用 |
| zustand | 5.0.12 | 轻量状态管理 | Phase 1已使用；v5的useShallow+Map/Set指南覆盖ECS存储需求 |
| three | 0.174.0 | 底层3D引擎 | R3F的运行时依赖；WebGL渲染能力 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (CLI) | 4.6.0 | UI组件库(Dialog/Slider/Input/Label/Tooltip/ScrollArea/Separator/Badge) | 全部UI面板：创建对话框、属性面板、工具箱tooltip |
| lucide-react | 0.487.0 | 图标库 | 形状图标(球体/方块/圆柱/斜面)、操作按钮图标 |
| @dimforge/rapier3d-compat | 0.19.2 | Rapier WASM二进制(transitive dep) | @react-three/rapier的运行时依赖；不直接导入 |
| react-hook-form | ^7.x | 表单状态管理 | 创建对话框的表单验证和提交 |
| zod | ^3.x | Schema验证 | 创建对话框参数校验（正数半径、0-1摩擦系数等） |
| @hookform/resolvers | ^3.x | react-hook-form+zod桥接 | 将zod schema连接到react-hook-form |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| drei Outlines | @react-three/postprocessing Outline pass | Postprocessing版本需要EffectComposer（全屏pass），性能开销更大；但对于被遮挡物体的边缘可见性更好。本项目选中物体数量少（单选），drei Outlines更简单直接。 |
| 自建ECS | bitecs / javelin ECS框架 | 完整框架引入Entity ID池、Archetype存储等重型概念。Phase 2仅5个组件类型、<50实体，自建300行ECS完全够用。 |
| Map in Zustand | 普通Record/对象 | Record在频繁增删场景下不如Map（delete触发V8慢模式）。Map有size属性(O(1))、保证插入顺序、for...of迭代比Object.entries快3.6x。但JSON序列化需手动处理。 |
| react-hook-form | 手写表单状态 | 手写表单需要管理每个字段的value/error/touched/dirty状态，代码量大且容易遗漏边界情况。Hooked form+Zod是2025年shadcn生态的标准组合。 |

**Installation:**
```bash
# shadcn/ui 初始化（尚未执行——UI-SPEC shadcn_initialized: false）
cd frontend
npx shadcn@latest init
# 交互选项: style=New York, base=Neutral, cssVariables=yes, darkMode=yes

# 安装所需组件
npx shadcn@latest add button dialog slider input label tooltip scroll-area separator badge

# 表单依赖（创建对话框用）
npm install react-hook-form zod @hookform/resolvers
```

**Version verification:** All core packages verified against node_modules on 2026-05-01. zustand installed at 5.0.12 (package.json declares ^5.0.5), drei at 10.7.7 (declared ^10.7.0). All versions are within declared ranges.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     UI Layer (React Components)                          │
│                                                                          │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐   │
│  │ Toolbar  │   │  Toolbox     │   │ Creation     │   │ Property   │   │
│  │ (existing)│   │ (left-float)│   │ Dialog       │   │ Panel      │   │
│  │          │   │              │   │ (modal)      │   │ (right)    │   │
│  └────┬─────┘   └──────┬───────┘   └──────┬───────┘   └─────┬──────┘   │
│       │               │                  │                  │           │
│       └───────────────┴──────┬───────────┴──────────────────┘           │
│                              │  Zustand actions                         │
├──────────────────────────────┼──────────────────────────────────────────┤
│                State Layer (Zustand Store)                               │
│                                                                          │
│  ┌───────────────────────────┴────────────────────────────────────┐     │
│  │  entities: Map<string, Entity>    selectedEntityId: string|null │     │
│  │  isRunning: boolean               showDebug: boolean             │     │
│  │  fps: number                      objectCount: number            │     │
│  │  resetCounter: number             uiCollapsed: boolean           │     │
│  │                                                                  │     │
│  │  Actions: addEntity / removeEntity / selectEntity /              │     │
│  │           updateEntityComponent / resetScene / play / pause      │     │
│  └───────────────────────────┬────────────────────────────────────┘     │
│                              │  ECS sync (add/remove/modify)            │
├──────────────────────────────┼──────────────────────────────────────────┤
│          Simulation Core (ECS + Rapier Bridge)                           │
│                                                                          │
│  ┌───────────────────────────┴────────────────────────────────────┐     │
│  │  ECS Entity Manager                                              │     │
│  │  ┌─────────────────────────────────────────────────────────┐    │     │
│  │  │  EntityNode { id, name, components: Map<string, Comp> } │    │     │
│  │  │  Component types: Transform | RigidBody | Collider      │    │     │
│  │  │                   | Velocity | Material                  │    │     │
│  │  └─────────────────────────────────────────────────────────┘    │     │
│  └───────────────────────────┬────────────────────────────────────┘     │
│                              │  component data → Rapier JSX props       │
├──────────────────────────────┼──────────────────────────────────────────┤
│          Rendering Layer (R3F + @react-three/rapier)                     │
│                                                                          │
│  ┌───────────────────────────┴────────────────────────────────────┐     │
│  │  <Physics key={resetCounter} timeStep={1/120}>                  │     │
│  │    <Ground />         ← 隐式基础设施，始终存在                    │     │
│  │    <Grid /> <Gizmo />  ← 参考网格+坐标轴                         │     │
│  │    {entities.map(entity =>                                       │     │
│  │      <EntityRenderer entity={entity} />  ← ECS→Rapier翻译        │     │
│  │    )}                                                            │     │
│  │  </Physics>                                                      │     │
│  │                                                                  │     │
│  │  EntityRenderer内部:                                              │     │
│  │    <RigidBody {...fromRigidBodyComp} {...fromTransformComp}>     │     │
│  │      <[Shape]Collider {...fromColliderComp} />                   │     │
│  │      <mesh onClick={handleSelect}>...</mesh>                     │     │
│  │      {isSelected && <Outlines color="#3b82f6" />}               │     │
│  │    </RigidBody>                                                  │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Data Flow:                                                              │
│  User action → Zustand action → ECS Manager.update() → React re-render  │
│  → new JSX tree → Rapier create/update/remove bodies → render            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
frontend/src/
├── ecs/                              # ECS组件架构（自建，~300行）
│   ├── Entity.ts                     # EntityNode定义 + EntityManager
│   ├── components/                   # 五个组件定义（纯数据接口）
│   │   ├── Transform.ts              # position[x,y,z], rotation[x,y,z], scale[x,y,z]
│   │   ├── RigidBody.ts             # type(dynamic/fixed), mass, restitution, friction
│   │   ├── Collider.ts              # shape(sphere/cuboid/cylinder), params(radius/halfExtents)
│   │   ├── Velocity.ts              # linearVelocity[x,y,z], angularVelocity[x,y,z]
│   │   └── Material.ts              # color(hex), roughness, metalness
│   └── types.ts                      # 组件联合类型 + Entity接口
│
├── store/
│   ├── index.ts                      # 组合所有slices
│   ├── simulationSlice.ts            # [保留] isRunning, showDebug, fps, resetCounter
│   ├── entitySlice.ts                # [新增] entities: Map<string, Entity>, selectedEntityId
│   │                                  #   Actions: addEntity, removeEntity, selectEntity,
│   │                                  #   updateComponent, resetEntities, getState (non-reactive)
│   └── uiSlice.ts                    # [新增] toolboxCollapsed, propertyPanelOpen, dialogOpen
│
├── components/
│   ├── App.tsx                       # [修改] 整合Toolbox + PropertyPanel到布局
│   ├── Toolbar.tsx                   # [保留] 顶部控制栏不变
│   ├── Scene3D.tsx                   # [重构] 移除INITIAL_SCENE_OBJECTS，改为ECS驱动渲染
│   ├── Toolbox.tsx                   # [新增] 左侧浮动工具箱
│   ├── CreationDialog.tsx            # [新增] 创建实体模态对话框
│   ├── PropertyPanel.tsx             # [新增] 右侧属性编辑面板
│   ├── EntityList.tsx                # [新增] 属性面板内实体列表
│   ├── EntityRenderer.tsx            # [新增] ECS实体→R3F渲染器（替换PhysicsObject）
│   ├── SelectionHighlight.tsx        # [新增] drei Outlines条件渲染包装
│   ├── LoadingScreen.tsx             # [保留] 不变
│   ├── ErrorFallback.tsx             # [保留] 不变
│   └── ui/                           # shadcn/ui组件目录（npx shadcn add后生成）
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── slider.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── tooltip.tsx
│       ├── scroll-area.tsx
│       ├── separator.tsx
│       └── badge.tsx
│
└── simulation/
    ├── types.ts                      # [保留为参考] SceneObject类型（ECS迁移后可移除）
    └── hardcodedScene.ts             # [移除] INITIAL_SCENE_OBJECTS删除
```

### Pattern 1: ECS作为数据模型 + 声明式Rapier渲染

**What:** ECS层持有所有实体的权威数据（EntityNode + 五个Component接口）。渲染层通过`EntityRenderer`组件将ECS Component数据翻译为`@react-three/rapier`的声明式JSX。实体增删通过React条件渲染自动管理Rapier生命周期。

**When to use:** 这是D-01和D-03的架构决策——ECS是数据权威，Rapier是物理权威，渲染层是声明式桥接。

**Example:**
```typescript
// Source: ARCHITECTURE.md Pattern 1 + R3F事件系统验证 [VERIFIED: npm registry @react-three/rapier 2.2.0]

// ── ECS数据层（simulation/ecs/）──
interface Entity {
  id: string;
  name: string;
  components: Map<string, Component>;
}

interface TransformComponent {
  type: 'transform';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface ColliderComponent {
  type: 'collider';
  shape: 'sphere' | 'cuboid' | 'cylinder';
  params: { radius?: number; halfWidth?: number; halfHeight?: number; halfDepth?: number };
}

// ── 渲染层（EntityRenderer.tsx）──
function EntityRenderer({ entity, isSelected, onSelect }: Props) {
  const transform = entity.components.get('transform') as TransformComponent;
  const rigidBody = entity.components.get('rigidBody') as RigidBodyComponent;
  const collider = entity.components.get('collider') as ColliderComponent;
  const material = entity.components.get('material') as MaterialComponent;
  const velocity = entity.components.get('velocity') as VelocityComponent;

  // 根据ColliderComponent动态生成对应的Rapier JSX
  const renderCollider = () => {
    switch (collider.shape) {
      case 'sphere':
        return <BallCollider args={[collider.params.radius!]} />;
      case 'cuboid':
        return <CuboidCollider args={[
          collider.params.halfWidth!,
          collider.params.halfHeight!,
          collider.params.halfDepth!,
        ]} />;
      case 'cylinder':
        return <CylinderCollider args={[
          collider.params.halfHeight!,
          collider.params.radius!,
        ]} />;
    }
  };

  const renderGeometry = () => { /* 同上，生成Three.js几何体 */ };

  return (
    <RigidBody
      type={rigidBody.type}
      position={transform.position}
      rotation={transform.rotation}
      restitution={rigidBody.restitution}
      friction={rigidBody.friction}
      linearVelocity={velocity?.linearVelocity ?? [0, 0, 0]}
      angularVelocity={velocity?.angularVelocity ?? [0, 0, 0]}
      colliders={false}  // 手动管理Collider，不自动生成
    >
      {renderCollider()}
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(entity.id); }}
      >
        {renderGeometry()}
        <meshStandardMaterial
          color={material.color}
          roughness={material.roughness ?? 0.6}
          metalness={material.metalness ?? 0.1}
        />
      </mesh>
      {isSelected && (
        <Outlines
          thickness={0.05}
          color="#3b82f6"
          screenspace={false}
          opacity={0.8}
          angle={Math.PI}
        />
      )}
    </RigidBody>
  );
}
```

### Pattern 2: Zustand Map存储 + useShallow选择器

**What:** 实体集合使用`Map<string, Entity>`存储在Zustand中。更新时必须创建新Map实例保证引用变化触发re-render。UI组件使用`useShallow`选择器精确订阅，避免不必要的re-render。

**When to use:** 所有涉及实体CRUD的Zustand操作。实体数据本身保留在store中（仅元数据，不含每帧物理状态）。

**Example:**
```typescript
// Source: Zustand官方文档 Maps and Sets Usage [VERIFIED: github.com/pmndrs/zustand docs]

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

interface EntitySlice {
  entities: Map<string, Entity>;
  selectedEntityId: string | null;

  addEntity: (entity: Entity) => void;
  removeEntity: (id: string) => void;
  selectEntity: (id: string | null) => void;
  updateComponent: (entityId: string, componentType: string, data: Partial<Component>) => void;
}

const useStore = create<EntitySlice & SimulationSlice & UiSlice>((set) => ({
  entities: new Map(),
  selectedEntityId: null,

  addEntity: (entity) =>
    set((state) => ({
      entities: new Map(state.entities).set(entity.id, entity),
      objectCount: state.entities.size + 1,  // 更新计数
    })),

  removeEntity: (id) =>
    set((state) => {
      const next = new Map(state.entities);
      next.delete(id);
      return {
        entities: next,
        selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
        objectCount: next.size,
      };
    }),

  selectEntity: (id) => set({ selectedEntityId: id }),

  updateComponent: (entityId, componentType, data) =>
    set((state) => {
      const entity = state.entities.get(entityId);
      if (!entity) return state;
      const comp = entity.components.get(componentType);
      if (!comp) return state;
      // 创建新component对象 + 新Map → 保证引用变化
      const updatedComp = { ...comp, ...data };
      const newComponents = new Map(entity.components).set(componentType, updatedComp);
      const updatedEntity: Entity = { ...entity, components: newComponents };
      return { entities: new Map(state.entities).set(entityId, updatedEntity) };
    }),
}));

// ── 组件中使用 ──
function PropertyPanel() {
  // useShallow + 派生数组避免Map变化触发无关re-render
  const entityList = useStore(useShallow((s) =>
    Array.from(s.entities.values()).map(e => ({ id: e.id, name: e.name }))
  ));
  const selectedId = useStore((s) => s.selectedEntityId);
  // ...
}
```

### Pattern 3: R3F内置事件系统的点击选中

**What:** 直接在mesh上绑定`onClick`处理器，利用R3F内部raycaster自动检测。选中后更新Zustand的`selectedEntityId`，触发Outlines条件渲染。

**When to use:** 所有3D交互选择。切勿手写Raycaster——R3F已内置完整的pointer事件管道。

**关键要点:**
- 必须在onClick中调用`e.stopPropagation()`防止穿透
- `onPointerMissed`在`<Physics>`外层或Canvas级别处理取消选中
- 事件处理放在mesh上（非RigidBody），确保精确命中视觉几何

```typescript
// Source: R3F事件系统文档 [VERIFIED: r3f.docs.pmnd.rs/api/events]

// 点击空白处取消选中
function DeselectHandler() {
  const selectEntity = useStore((s) => s.selectEntity);
  return (
    <mesh
      visible={false}
      onPointerMissed={() => selectEntity(null)}
      position={[0, 0, -100]}  // 大平面捕获所有missed事件
    >
      <planeGeometry args={[1000, 1000]} />
    </mesh>
  );
}
```

### Pattern 4: 属性面板读写模式（暂停可编辑/运行只读）

**What:** 属性面板根据`isRunning`状态切换渲染模式。暂停时渲染Slider+Input（可编辑），运行时渲染纯文本（只读）。实体列表始终可点击切换选中（不影响编辑）。

**When to use:** D-09约束——运行中属性面板只读，防止物理不一致。

```typescript
// Source: UI-SPEC.md Read-Only vs Editable States [VERIFIED: .planning/phases/02-.../02-UI-SPEC.md]

function PhysicsField({ label, value, unit, min, max, step, disabled, onChange }: Props) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between py-1">
        <Label style={{ color: '#a0a0a0' }}>{label}</Label>
        <span style={{ color: '#666', fontFamily: 'var(--font-mono)' }}>
          {value.toFixed(2)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 text-sm font-mono"
        />
        {unit && <span className="text-xs text-[#888]">{unit}</span>}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **在RigidBody上绑定onClick而非mesh:** RigidBody的碰撞几何可能与视觉几何不同，导致"看起来点中了但没反应"。始终在mesh上绑定点击事件。
- **Map原地修改不创建新引用:** `state.entities.set(id, entity)`不会触发Zustand更新。必须`new Map(state.entities).set(...)`。
- **手写Raycaster检测:** R3F已有完整事件管道(DOM event→坐标归一化→raycaster→intersections排序→dispatch)。手写会导致两套射线检测运行。
- **在useFrame中更新Zustand:** 物理帧数据直接通过@react-three/rapier内部桥接同步到Three.js Object3D，不经过React/Zustand（PITFALLS #6）。
- **选中高亮使用Emissive材质而非Outlines:** Emissive需要修改材质属性，与现有材质系统冲突，且不支持实例化mesh。Outlines是独立的后处理层，侵入性更小。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 3D射线检测 | 手写THREE.Raycaster + 手动坐标转换 | R3F内置事件系统(onClick/onPointerDown) | R3F已经处理了DOM→NDC坐标转换、raycaster创建、intersections排序和事件分发。手写会与内部系统产生竞态。 |
| 选中描边效果 | 自定义Shader/GLSL后处理 | drei `<Outlines>` 组件 | Outlines使用inverted-hull技术，自动处理depthTest=off保证描边可见；支持screenspace模式保持线宽恒定。自定义shader需处理多种几何体类型。 |
| 表单验证逻辑 | 手写if/else校验每个字段 | zod schema + react-hook-form | Zod提供类型推导（z.infer）、组合验证（.min/.max/.positive）、错误消息国际化。手写校验遗漏边界情况（NaN、负数半径等）。 |
| 模态对话框 | 手写portal+焦点管理+ESC关闭+遮罩 | shadcn/ui Dialog (@radix-ui/react-dialog) | Radix Dialog已处理焦点trap、ESC关闭、aria-modal、遮罩点击关闭、body scroll lock。手写每个都容易遗漏。 |
| 滑块组件 | 手写range input + CSS | shadcn/ui Slider (@radix-ui/react-slider) | Radix Slider处理键盘导航、触摸拖拽、多thumb、无障碍属性。CSS range input跨浏览器样式不一致。 |
| 实体ID生成 | Math.random()或自增计数器 | crypto.randomUUID() 或 nanoid | crypto.randomUUID()是浏览器原生API（无需依赖），保证全局唯一。Math.random()有碰撞风险。自增计数器在多窗口场景不安全。 |
| Map序列化 | 手写Map→Object转换 | 标准化`Array.from(map.entries())` + `new Map(entries)` | Persist中间件和SSR水合都需要。统一序列化路径避免多处不一致实现。 |

**Key insight:** Phase 2涉及的UI组件（对话框、滑块、输入框、tooltip、滚动区域）都有成熟的Radix/shadcn实现——这些组件涉及焦点管理、键盘导航、无障碍属性、触摸事件等大量边缘情况，手写成本远超直接使用标准库。

## Common Pitfalls

### Pitfall 1: Zustand中Map原地修改不触发更新

**What goes wrong:** 使用`state.entities.set(id, entity)`修改Map，Zustand检测到同一个Map引用，不触发订阅者更新。UI中实体列表不刷新。

**Why it happens:** Zustand使用`Object.is`做引用比较。Map的`.set()`/.`delete()`返回的是同一个Map实例——引用未变化。

**How to avoid:** 每次修改都创建新Map：`new Map(state.entities).set(id, entity)`。对于深层更新（修改组件内部字段），需要同时创建新组件对象和新Map：`{ ...entity, components: new Map(entity.components).set(key, newComp) }`。

**Warning signs:** UI不更新但console.log显示数据已变化；React DevTools中store状态正确但组件未re-render。

### Pitfall 2: 3D点击事件穿透

**What goes wrong:** 点击一个物体时，射线继续穿透到后面的物体（如地面），触发两个onClick事件。或者点击物体后事件冒泡到父级组件。

**Why it happens:** R3F事件系统默认允许事件传播（类似DOM冒泡）。射线可能击中多个重叠物体。

**How to avoid:** 在目标mesh的onClick中调用`e.stopPropagation()`。在场景中放置一个大invisible plane绑定`onPointerMissed`处理取消选中。

**Warning signs:** 点击物体后选中状态闪烁（先选中后立即取消）；选中物体A但属性面板显示物体B的参数。

### Pitfall 3: Outlines被遮挡物体隐藏

**What goes wrong:** 选中物体的Outlines描边在转到某个角度时消失——因为被其他物体遮挡。

**Why it happens:** 默认情况下Outlines受深度测试影响。当另一个物体在选中物体和相机之间时，描边被遮挡像素覆盖。

**How to avoid:** Outlines组件默认已设置`depthTest: false` [VERIFIED: drei Outlines文档]。如果仍有遮挡问题，检查是否有自定义renderOrder或material.depthTest覆盖。可以给Outlines设置更高的renderOrder确保后绘制。

**Warning signs:** 旋转视角时选中高亮间歇性消失；物体被遮挡时描边不可见。

### Pitfall 4: 动态添加RigidBody后物理行为异常

**What goes wrong:** 新添加的实体卡在原地不动、穿模、或者瞬间弹飞到远处。

**Why it happens:** 实体在(0,5,0)生成时可能与已存在的物体重叠。Rapier在检测到穿透时会施加很大的分离力，导致物体飞走。

**How to avoid:** 生成位置验证——在添加实体前检查(0,5,0)附近是否有物体。如果重叠，将Y位置提升到现有最高物体之上。或者通过`<Physics paused={!isRunning}>`在暂停状态下添加实体，用户手动播放时再开始物理。

**Warning signs:** 新实体生成瞬间弹飞；物体穿模到地面以下；控制台出现"penetration"相关警告。

### Pitfall 5: ECS组件数据→Rapier属性运行时修改的延迟

**What goes wrong:** 用户在属性面板修改摩擦系数/弹性系数，但实体行为未立即改变——需要重新播放才生效。

**Why it happens:** @react-three/rapier的`restitution`和`friction`属性仅在RigidBody组件挂载时传递给Rapier。运行时修改这些props可能不会触发Rapier内部状态更新。

**How to avoid:** 对于需要运行时修改的物理属性（mass/restitution/friction），通过ref直接操作Rapier底层API：
```typescript
const rigidBodyRef = useRef<RapierRigidBody>(null);
// 修改时：
rigidBodyRef.current.setRestitution(0.8);     // Rapier原生方法
rigidBodyRef.current.setFriction(0.3);
```
对于位置/速度修改，使用`setTranslation()`/`setLinvel()`。这些方法立即生效于下一个物理步长。

**Warning signs:** 用户修改参数后物理行为不变；拖动滑块视觉变化但碰撞表现不变。

### Pitfall 6: 新增键盘快捷键与现有快捷键冲突

**What goes wrong:** Phase 2新增B/N/C/S键（打开创建对话框）、Delete/Backspace（删除实体）。与浏览器原生行为或现有快捷键冲突。

**Why it happens:** Phase 1已注册Space（播放/暂停）和R（重置），有INPUT/TEXTAREA过滤。Phase 2新增4+2个快捷键需要整合到同一处理函数中。

**How to avoid:** 统一键盘处理——扩展App.tsx的`handleKeyDown`函数，添加所有Phase 2快捷键。Delete/Backspace在属性面板聚焦时触发删除确认，在输入框内时不触发。使用`e.code`而非`e.key`（避免输入法/键盘布局差异）。

**Warning signs:** 在输入框中输入文字时意外打开对话框；按Backspace删除文本时触发实体删除。

## Code Examples

### ECS Entity Manager (simulation/ecs/Entity.ts)

```typescript
// Source: ARCHITECTURE.md Pattern 1 + 项目决策D-01/D-02 [VERIFIED: .planning/research/ARCHITECTURE.md]

export type ComponentType = 'transform' | 'rigidBody' | 'collider' | 'velocity' | 'material';

export interface Component {
  type: ComponentType;
}

export interface Entity {
  id: string;
  name: string;
  components: Map<ComponentType, Component>;
}

// Entity工厂函数
export function createEntity(id: string, name: string, components: Component[]): Entity {
  const compMap = new Map<ComponentType, Component>();
  for (const comp of components) {
    compMap.set(comp.type, comp);
  }
  return { id, name, components: compMap };
}

// 预设创建函数（确保组件完整性）
export function createSphereEntity(
  n: number,
  radius: number,
  mass: number,
  restitution: number,
  friction: number,
  color: string,
  velocity?: [number, number, number],
): Entity {
  return createEntity(`sphere-${n}`, `球体-${n}`, [
    { type: 'transform', position: [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction },
    { type: 'collider', shape: 'sphere', params: { radius } },
    { type: 'material', color, roughness: 0.6, metalness: 0.1 },
    { type: 'velocity', linearVelocity: velocity ?? [0, 0, 0], angularVelocity: [0, 0, 0] },
  ]);
}
```

### 3D点击选中 + 描边高亮

```typescript
// Source: R3F事件系统 + drei Outlines [VERIFIED: r3f.docs.pmnd.rs, drei.docs.pmnd.rs]

function Scene3D() {
  const entities = useStore(useShallow((s) => Array.from(s.entities.entries())));
  const selectedId = useStore((s) => s.selectedEntityId);
  const selectEntity = useStore((s) => s.selectEntity);
  const resetCounter = useStore((s) => s.resetCounter);
  const isRunning = useStore((s) => s.isRunning);
  const showDebug = useStore((s) => s.showDebug);

  // ...

  return (
    <Canvas /* ... */>
      <Physics key={resetCounter} timeStep={1/120} paused={!isRunning} debug={showDebug}
        gravity={[0, -9.81, 0]} interpolate={true}>
        <Ground />
        {/* ECS驱动渲染——替代 INITIAL_SCENE_OBJECTS.map() */}
        {entities.map(([id, entity]) => (
          <EntityRenderer
            key={id}
            entity={entity}
            isSelected={id === selectedId}
            onSelect={selectEntity}
          />
        ))}
        {/* 取消选中——点击空白处 */}
        <mesh visible={false} onPointerMissed={() => selectEntity(null)}
          position={[0, 0, -500]}>
          <planeGeometry args={[2000, 2000]} />
        </mesh>
      </Physics>
      {/* OrbitControls, Grid, GizmoHelper, Lights — 保持不变 */}
    </Canvas>
  );
}
```

### 创建对话框表单（shadcn/ui + react-hook-form + zod）

```typescript
// Source: shadcn/ui官方Form组件模式 [VERIFIED: ui.shadcn.com/docs/components/form]

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const creationSchema = z.object({
  shape: z.enum(['sphere', 'cuboid', 'cylinder']),
  radius: z.number().positive('尺寸必须为正数').optional(),
  halfWidth: z.number().positive('尺寸必须为正数').optional(),
  halfHeight: z.number().positive('尺寸必须为正数').optional(),
  halfDepth: z.number().positive('尺寸必须为正数').optional(),
  mass: z.number().positive('质量必须大于0').default(1.0),
  restitution: z.number().min(0).max(1, '弹性系数必须在0到1之间').default(0.5),
  friction: z.number().min(0).max(1, '摩擦系数必须在0到1之间').default(0.3),
  velocityX: z.number().default(0),
  velocityY: z.number().default(0),
  velocityZ: z.number().default(0),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#f4a261'),
});

type CreationFormData = z.infer<typeof creationSchema>;

export function CreationDialog({ open, defaultShape, onConfirm, onCancel }: Props) {
  const form = useForm<CreationFormData>({
    resolver: zodResolver(creationSchema),
    defaultValues: { shape: defaultShape, mass: 1.0, restitution: 0.5, friction: 0.3,
      velocityX: 0, velocityY: 0, velocityZ: 0, color: '#f4a261' },
  });

  const shape = form.watch('shape');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>添加实体</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-6">
          {/* 尺寸参数——根据形状动态切换 */}
          {shape === 'sphere' && (
            <FormField name="radius" render={({ field }) => (
              <FormItem>
                <Label>半径</Label>
                <Input type="number" {...field} min={0.1} step={0.1} />
              </FormItem>
            )} />
          )}
          {/* 质量Slider */}
          <FormField name="mass" render={({ field }) => (
            <FormItem>
              <Label>质量 ({field.value.toFixed(1)} kg)</Label>
              <Slider value={[field.value]} onValueChange={([v]) => field.onChange(v)}
                min={0.1} max={100} step={0.1} />
            </FormItem>
          )} />
          {/* 弹性Slider */}
          <FormField name="restitution" render={({ field }) => (
            <FormItem>
              <Label>弹性系数 ({field.value.toFixed(2)})</Label>
              <Slider value={[field.value]} onValueChange={([v]) => field.onChange(v)}
                min={0} max={1} step={0.01} />
            </FormItem>
          )} />
          {/* ... 更多字段 */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
            <Button type="submit">确认添加</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SceneObject类型 + hardcodedScene.ts | ECS Entity + Component Map (自建) | Phase 2 | 硬编码场景被UI自由添加取代；类型系统从固定字段演进为可组合组件 |
| PhysicsObject组件（基于SceneObject switch） | EntityRenderer组件（基于ECS Component Map） | Phase 2 | 渲染逻辑与数据模型解耦；新形状类型只需新增ColliderComponent变体，无需修改switch语句 |
| 手动Raycaster | R3F内置onClick事件 | Phase 2 | 减少~40行样板代码；自动处理坐标转换和intersections排序 |
| 无选中/编辑能力 | drei Outlines + 属性面板 | Phase 2 | 首次实现3D交互选择和参数编辑 |

**Deprecated/outdated:**
- `INITIAL_SCENE_OBJECTS` / `hardcodedScene.ts` — 被ECS实体管理器取代。文件在Phase 2实现后删除。
- `SceneObject` interface (`types.ts`) — 被ECS Component接口取代。保留为向后兼容参考，标记`@deprecated`。
- `PhysicsObject` 组件 — 重构为`EntityRenderer`，基于ECS组件动态渲染。
- `SCENE_STATS` 常量 — 被Zustand `objectCount` 动态计算取代。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | react-hook-form + zod是创建对话框表单的最佳选择 [ASSUMED] | Standard Stack | 若项目已用其他表单库或偏好原生受控组件，需更换方案。改用原生state管理表单字段代码量增加约100行但不影响架构。 |
| A2 | @react-three/rapier的restitution/friction prop在RigidBody mount后不可动态修改 [ASSUMED] | Common Pitfalls #5 | 若v2.x已支持props响应式更新，则不需要ref方案。需在实现时验证一次：修改prop后调用world.step检查效果。若支持则简化代码；若不支持则需ref。 |
| A3 | drei Outlines的depthTest默认已设为false [ASSUMED] | Common Pitfalls #3 | 若特定版本默认值为true，需显式设置或自定义renderOrder。实现时验证一次即可。 |
| A4 | crypto.randomUUID()在目标浏览器中可用 [ASSUMED] | Don't Hand-Roll | 所有现代浏览器(chrome 95+, firefox 95+, safari 15.4+)已支持。若需支持更旧浏览器，fallback到nanoid。 |
| A5 | @react-three/rapier的`<Physics>`组件在paused状态下仍允许添加RigidBody且物理正确初始化 [ASSUMED] | Architecture Patterns | 若paused状态下添加的RigidBody在resume后位置/速度异常，需改为isRunning时短暂暂停+添加+恢复的方案。 |

## Open Questions

1. **Rapier运行时属性修改机制**
   - What we know: `restitution`/`friction`/`mass`作为RigidBody props传入，不确定挂载后修改prop是否触发Rapier内部更新
   - What's unclear: @react-three/rapier v2.2.0对props变化的具体响应行为——是重新创建RigidBody还是调用Rapier.setXxx()方法
   - Recommendation: 在实现阶段做一次原型验证。如果不支持prop响应，使用ref+原生Rapier API作为运行时修改路径

2. **shadcn/ui初始化对现有Tailwind v4配置的影响**
   - What we know: 项目已使用Tailwind v4（Vite插件方式）。shadcn/ui v4 CLI需要在初始化时配置CSS变量和components.json
   - What's unclear: shadcn init是否会覆盖现有的`@import "tailwindcss"`配置或与Vite tailwindcss插件冲突
   - Recommendation: 在独立分支上先执行shadcn init验证，确认不会破坏现有样式后再合并

3. **ECS实体计数器(实体名后缀数字)的全局唯一性**
   - What we know: 需求是"球体-1, 球体-2..."递增命名
   - What's unclear: 删除球体-1后再次添加球体，应该是球体-3（永不重用）还是球体-1（填补空洞）？CONTEXT.md未明确
   - Recommendation: 实现永不重用方案（全局递增计数器，更简单且避免混淆）。在下一个discuss-phase确认。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 构建/运行 | Yes | (runtime) | — |
| @react-three/rapier | 物理引擎 | Yes (已安装) | 2.2.0 | — |
| @react-three/drei | Outlines/Gizmo/Grid | Yes (已安装) | 10.7.7 | — |
| zustand | 状态管理 | Yes (已安装) | 5.0.12 | — |
| three.js | 3D渲染 | Yes (已安装) | 0.174.0 | — |
| @dimforge/rapier3d-compat | WASM物理 | Yes (transitive) | 0.19.2 | — |
| shadcn CLI | UI组件生成 | Yes | 4.6.0 | — |
| shadcn/ui 初始化 | UI组件库 | **No — 未初始化** | — | 执行 `npx shadcn@latest init` |
| react-hook-form | 表单管理 | **No — 未安装** | — | `npm install react-hook-form` |
| zod | Schema验证 | **No — 未安装** | — | `npm install zod @hookform/resolvers` |

**Missing dependencies with no fallback:**
- shadcn/ui 初始化: 必须在Phase 2 Wave 0执行 `npx shadcn@latest init` + `npx shadcn@latest add button dialog slider input label tooltip scroll-area separator badge`。所有Phase 2 UI面板依赖这些组件。

**Missing dependencies with fallback:**
- react-hook-form + zod: 可以用原生React受控组件+手写验证替代，但代码量增加约100-150行。建议直接使用。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| Config file | vite.config.ts (inline test config) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements --> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIF-01 | ECS架构——EntityNode+Component Map结构正确性：创建实体、附加组件、组件查询 | unit | `npx vitest run src/ecs/Entity.test.ts` | No -- Wave 0 |
| DIF-01 | 组件组合——不同组件组合产生不同行为：sphere+cuboid+cylinder三种形状正确映射 | unit | `npx vitest run src/ecs/Entity.test.ts` | No -- Wave 0 |
| REN-03 | 属性面板可编辑/只读切换：isRunning=true时所有input disabled | unit | `npx vitest run src/components/PropertyPanel.test.tsx` | No -- Wave 0 |
| REN-03 | Slider值变化触发ECS组件更新 | integration | `npx vitest run src/components/PropertyPanel.test.tsx` | No -- Wave 0 |
| SC-1 | 工具箱按钮点击打开创建对话框，预填充对应形状 | unit | `npx vitest run src/components/Toolbox.test.tsx` | No -- Wave 0 |
| SC-1 | 创建对话框确认后实体出现在store中 | integration | `npx vitest run src/components/CreationDialog.test.tsx` | No -- Wave 0 |
| SC-2 | 3D点击选中更新selectedEntityId | integration | `npx vitest run src/components/Scene3D.test.tsx` | Partial -- needs update |
| SC-3 | 属性修改即时生效——修改mass后entity.components.rigidBody.mass更新 | unit | `npx vitest run src/store/entitySlice.test.ts` | No -- Wave 0 |
| SC-4 | ECS架构可扩展性——新组件类型可注册并查询 | unit | `npx vitest run src/ecs/Entity.test.ts` | No -- Wave 0 |
| — | 删除实体——确认对话框 + ECS移除 + selectedEntityId清除 | integration | `npx vitest run src/components/PropertyPanel.test.tsx` | No -- Wave 0 |
| — | 重置键(R) — 清空所有实体 + resetCounter递增 | integration | `npx vitest run src/store/entitySlice.test.ts` | No -- Wave 0 |
| — | 键盘快捷键(B/N/C/S/Delete/Backspace) | unit | `npx vitest run src/components/App.test.tsx` | Partial -- needs update |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose` (subset of related tests)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/ecs/Entity.test.ts` — 覆盖ECS Entity创建、组件CRUD、组件查询
- [ ] `src/ecs/components/__tests__/` — 覆盖五种组件类型的接口一致性
- [ ] `src/store/entitySlice.test.ts` — 覆盖Map增删改查操作的正确性
- [ ] `src/components/Toolbox.test.tsx` — 覆盖按钮渲染、点击事件、collapsed状态
- [ ] `src/components/CreationDialog.test.tsx` — 覆盖表单验证、提交流程、取消关闭
- [ ] `src/components/PropertyPanel.test.tsx` — 覆盖可编辑/只读状态、Slider交互、删除流程
- [ ] `src/components/EntityRenderer.test.tsx` — 覆盖ECS数据→Rapier JSX映射
- [ ] `src/components/App.test.tsx` — 更新以覆盖新增键盘快捷键
- [ ] `src/components/Scene3D.test.tsx` — 更新以覆盖ECS驱动渲染和选中交互
- [ ] `src/test/setup.ts` — 现有配置(`@testing-library/jest-dom`)已足够

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — (纯前端应用，无用户认证) |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | zod schema验证创建对话框输入（正数检查、范围检查、颜色格式检查）；Slider min/max限制 |
| V6 Cryptography | No | — (crypto.randomUUID()仅用于ID生成，非安全目的) |

### Known Threat Patterns for React+R3F+Zustand Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意构造的Entity数据导致Rapier panic | Denial of Service | 所有用户输入通过zod schema验证；Slider组件自带min/max限制；坐标/尺寸上限硬编码（如位置范围±1000m，质量max 10000kg） |
| 快速连续创建大量实体耗尽WASM内存 | Denial of Service | 限制场景最大实体数（硬上限50个）；创建对话框在实体数达上限时禁用 |
| XSS via实体名（如果后续支持自定义命名） | Tampering | 实体名使用React默认转义（JSX自动escape）；不需要dangerouslySetInnerHTML |
| 属性面板输入注入（如恶意修改position到极大值） | Tampering | 所有数值输入通过zod .min().max()约束；slider自带范围限制 |

## Sources

### Primary (HIGH confidence)
- [R3F事件系统文档](https://r3f.docs.pmnd.rs/api/events) — 内置事件管道、onClick/onPointerMissed API验证 [VERIFIED]
- [drei Outlines组件API](https://drei.docs.pmnd.rs/abstractions/outlines) — Outlines props(screenspace/opacity/thickness/angle/depthTest) [VERIFIED]
- [Zustand Maps and Sets Usage官方指南](https://github.com/pmndrs/zustand/blob/main/docs/guides/maps-and-sets-usage.md) — Map/Set在Zustand中的不可变更新模式 [VERIFIED]
- [Zustand useShallow文档](https://zustand.docs.pmnd.rs/learn/) — v5 useShallow API和最佳实践 [VERIFIED]
- [@react-three/rapier官方文档](https://pmndrs.github.io/react-three-rapier/) — RigidBody props(linearVelocity/angularVelocity/restitution/friction/mass) [VERIFIED]
- [@react-three/rapier DeepWiki](https://deepwiki.com/pmndrs/react-three-rapier/2-core-api) — 声明式vs命令式API对比，useRapier钩子 [VERIFIED]
- [ARCHITECTURE.md Pattern 1](.planning/research/ARCHITECTURE.md) — ECS变体设计 (EntityNode + Component Map) [VERIFIED: project internal]
- [PITFALLS.md #6](.planning/research/PITFALLS.md) — Zustand重渲染风暴防护模式 [VERIFIED: project internal]
- [02-UI-SPEC.md](.planning/phases/02-entity-component-system-property-editing/02-UI-SPEC.md) — 面板布局合同、shadcn组件清单、可编辑/只读状态规范 [VERIFIED: project internal]

### Secondary (MEDIUM confidence)
- [shadcn/ui官方文档](https://ui.shadcn.com/docs/components/form) — Dialog+Form+Slider集成模式 [CITED]
- [react-hook-form + zod + shadcn/ui集成](https://deepwiki.com/satnaing/shadcn-admin/6-form-and-dialog-system) — 生产级表单对话框模式验证 [CITED]
- [Rapier velocity docs](https://rapier.rs/docs/user_guides/javascript/rigid_body_velocity/) — setLinvel/setAngvel运行时API [CITED]
- [Zustand Map vs Object性能对比](https://devgex.com/en/article/00012545) — Map在频繁增删场景下的性能优势 [CITED]

### Tertiary (LOW confidence)
- [WebSearch: Ecosphere Map vs Object benchmarks](https://dev.to/mehedibangladeshi/why-map-lookups-are-slower-than-object-lookups-in-javascript-33g8) — 微基准测试数据，需在本地验证 [CITED]
- [WebSearch: ECS TypeScript patterns](https://github.com/phughesmcr/Miski) — Miski ECS架构参考（ArrayBuffer+WeakMap模式） [CITED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有核心库已在Phase 1安装验证，版本精确匹配。shadcn CLI 4.6.0确认可用。仅react-hook-form+zod需新安装（成熟标准组合）。
- Architecture: HIGH — ECS变体设计来自项目内部ARCHITECTURE.md，经过Phase 1 CONTEXT讨论确认。R3F事件系统+Outlines+条件渲染Rapier模式均有多源验证。
- Pitfalls: MEDIUM-HIGH — 主要来自PITFALLS.md已知陷阱（已有防护策略）+ R3F/Rapier/Zustand的已知集成问题。A2（Rapier props动态修改）需要原型验证。

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days — Zustand/R3F/Rapier均为稳定版本，API变化风险低)
