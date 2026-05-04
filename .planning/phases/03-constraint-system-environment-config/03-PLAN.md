---
phase: 3
slug: constraint-system-environment-config
plan_count: 5
total_tasks: 18
estimated_minutes: 135
created: 2026-05-02
dependencies:
  - 03-CONTEXT.md (8 decisions locked)
  - 03-RESEARCH.md (10 technical decisions)
  - 03-VALIDATION.md (5 Nyquist pillars)
  - 03-UI-SPEC.md (approved design contract)
  - Phase 2 delivery (ECS 5-piece, 3 store slices, Scene3D, Toolbar, Toolbox, PropertyPanel)
---

# Phase 3 — Master Plan

## Plan Overview

```
Wave 1 (基础数据)         Wave 2 (功能系统)              Wave 3 (集成收尾)
─────────────────────    ─────────────────────────    ─────────────────────
03-01 (6 tasks)          03-02 (4 tasks) ─┐           03-04 (4 tasks)
ECS + Slice 扩展         环境面板+倍率     │           PropertyPanel多态
    │                         │            │           级联删除+UAT
    ├──→ 03-02                └──→ 03-04 ←─┘                │
    │                                                       │
    └──→ 03-03 (4 tasks) ──────→ 03-04                     │
         Spring渲染+创建                                        │
                                                         03-05 (可选)
                                                         集成测试+perf
```

**总估时**: ~135 min（不含 03-05）

---

## Pre-flight: Spike Validation（Plan 启动前置）

> ⚠️ **在实施任何 task 前完成**，验证两个关键技术假设。

| Spike | 验证内容 | 方法 | 通过标准 |
|-------|---------|------|---------|
| SP-1 | `useSpringJoint` API 行为 | 在 Scene3D 中临时添加一个 hardcoded spring joint | damping=0 被接受；两 dynamic body 振动周期符合 ω=√(k/m) |
| SP-2 | TubeGeometry 每帧重建性能 | 在单独文件中测 20 个 helix 的 dispose+create 循环 | 单帧 < 2ms；20 弹簧 < 8ms |

**若 SP-1 失败**: 切换为 `useDistanceJoint` + `useBeforePhysicsStep` 自实现阻尼项。
**若 SP-2 失败**: 降级为 Line2/BufferGeometry 直线（v1）。

---

## Wave 1: ECS 类型扩展 + Store 字段

### Plan 03-01: ECS ConstraintComponent + Store Environment（6 tasks）

**依赖**: Phase 2 完整交付
**产出**: ConstraintComponent 类型、Spring 工厂、simulationSlice.environment、uiSlice.spring 状态、单元测试

---

#### Task 03-01-01: 扩展 ECS 类型系统

**文件**: `frontend/src/ecs/types.ts`

**变更**:
1. `ComponentType` 联合新增 `'constraint'`
2. 新增 `ConstraintKind = 'spring'`
3. 新增 `SpringConstraintParams { stiffness, restLength, damping }`
4. 新增 `ConstraintComponent extends Component { type: 'constraint'; kind: ConstraintKind; entityAId: string; entityBId: string; params: SpringConstraintParams }`
5. `AnyComponent` 联合新增 `ConstraintComponent`

**验收**: `tsc --noEmit` 通过；TypeScript 能推断 `entity.components.get('constraint')` 返回 `ConstraintComponent | undefined`

---

#### Task 03-01-02: 创建 Spring Entity 工厂

**文件**: `frontend/src/ecs/Entity.ts`（修改）

**变更**:
1. 新增 `createSpringEntity(entityAId, entityBId, params?): Entity`
   - id 格式 `spring-${n}`
   - name 格式 `弹簧-${n}`
   - components Map 仅含 `ConstraintComponent`
   - 默认值: stiffness=100, restLength=2.0, damping=0.1
2. 复用全局 `entityCounter`（与形状工厂一致）
3. 导出 `DEFAULT_SPRING_PARAMS` 常量

**验收**: 单元测试 `createSpringEntity('a', 'b')` → Entity.components.has('constraint') === true

---

#### Task 03-01-03: 扩展 simulationSlice — environment 字段

**文件**: `frontend/src/store/simulationSlice.ts`（修改）

**变更**:
1. 新增 `EnvironmentState { gravity: [number,number,number]; frictionScale: number; restitutionScale: number; drag: number }`
2. `SimulationSlice` 新增 `environment: EnvironmentState`（初始: `{ gravity: [0,-9.81,0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1 }`)
3. 新增 actions（每个保证新引用）:
   - `setGravity(g: [number,number,number])` — `[...g]`
   - `setFrictionScale(v: number)`
   - `setRestitutionScale(v: number)`
   - `setDrag(v: number)`
   - `resetEnvironment()` — 恢复默认
4. `reset()` action 保持现状：`resetCounter += 1`，不触碰 environment

**验收**: 单元测试 — `setGravity([1,2,3])` → `store.environment.gravity` 引用不同于输入；`reset()` 后 `environment` 不变

---

#### Task 03-01-04: 扩展 uiSlice — 弹簧创建状态机

**文件**: `frontend/src/store/uiSlice.ts`（修改）

**变更**:
1. 新增类型 `SpringCreationStage = 'idle' | 'pendingA' | 'pendingB' | 'dialog'`
2. `UiSlice` 新增:
   - `springCreationStage: SpringCreationStage`（默认 'idle'）
   - `springEntityAId: string | null`
   - `springDialogOpen: boolean`
   - `environmentPanelOpen: boolean`
3. 新增 actions:
   - `enterSpringMode()` — stage → 'pendingA', clear A
   - `exitSpringMode()` — stage → 'idle', clear A
   - `selectSpringEndpointA(id)` — 存 A, stage → 'pendingB'
   - `selectSpringEndpointB(id)` — 存 B, stage → 'dialog'
   - `openSpringDialog()` / `closeSpringDialog()`
   - `toggleEnvironmentPanel()` / `closeEnvironmentPanel()`

**验收**: 单元测试 — 状态机流转 idle → pendingA → pendingB → dialog → idle 完整路径

---

#### Task 03-01-05: 编写 ECS + Store 单元测试

**文件**: 
- `frontend/src/__tests__/ecs/ConstraintComponent.test.ts`（新建）
- `frontend/src/store/__tests__/simulationSlice.environment.spec.ts`（新建）
- `frontend/src/store/__tests__/uiSlice.spring.spec.ts`（新建）

**覆盖**:
- ConstraintComponent 类型守卫
- createSpringEntity 默认值
- setGravity 新引用
- environment 不受 reset 影响
- 状态机 5 条路径
- MAX_ENTITIES 包含弹簧

**验收**: `npx vitest run src/__tests__/ecs src/store/__tests__` 全绿

---

#### Task 03-01-06: 编写 Nyquist 物理单元测试

**文件**:
- `frontend/src/__tests__/physics/spring-oscillator.test.ts`（新建）
- `frontend/src/__tests__/physics/gravity-hot-swap.test.ts`（新建）
- `frontend/src/__tests__/physics/drag-decay.test.ts`（新建）

**依赖**: Rapier WASM headless helper（在 task 内检查是否可用，否则用纯数学模拟）

**覆盖**（VALIDATION.md 3.1）:
- 弹簧简谐运动: m=1, k=10, L0=5, damping=0 → 周期 T ≈ 2π/√10 ≈ 1.99s
- 重力热更新: setGravity([0,0,0]) → 物体停止下落
- 空气阻力衰减: drag=1.0 → 半衰期 ≈ 0.69s

**验收**: 三个新建测试文件全绿；`npx vitest run` 全集通过

---

## Wave 2: 环境系统 + 弹簧系统

### Plan 03-02: EnvironmentPanel + 倍率叠加 + Scene3D 重力接入（4 tasks）

**依赖**: 03-01 完成
**产出**: 浮动 EnvironmentPanel、重力实时接入、倍率叠加在 EntityRenderer、暂停只读

---

#### Task 03-02-01: 创建 EnvironmentPanel 组件

**文件**: `frontend/src/components/EnvironmentPanel.tsx`（新建）

**参考原型**: `Toolbar.tsx`（glassmorphism + position fixed）、`PropertyPanel.tsx`（Slider + Input 控件）

**结构**:
```
EnvironmentPanel
├── 重力预设胶囊行 [地球(9.81) | 月球(1.62) | 火星(3.71) | 零重力(0)]
├── 重力 XYZ 三分量输入（每行: label + Slider(-20~20) + NumberInput + 单位 m/s²）
├── Separator
├── 摩擦倍率（预设胶囊 + Slider(0~5) + NumberInput + 单位 ×）
├── Separator
├── 弹性倍率（Slider(0~5) + NumberInput + 单位 ×）
├── Separator
└── 空气阻力（Slider(0~5) + NumberInput）
```

**行为**（D-02/03/06/07）:
- Toolbar 环境按钮 → toggle `environmentPanelOpen`
- 点击 Popover 外部 → close
- Escape → close
- 运行时（isRunning=true）→ 顶部横幅 "运行中，请暂停后编辑" + 全 disabled
- 暂停时修改 → 立即写 store + 被改控件高亮闪烁 300ms（CSS class `animate-highlight`）

**状态接入**: `useSimulationStore` — environment, setGravity, setFrictionScale, setRestitutionScale, setDrag, isRunning

**样式**（UI-SPEC）: 320px 宽, `rgba(26,26,26,0.95)` + `backdrop-filter: blur(12px)`, border-radius 12px

**验收**: 组件渲染不崩溃；暂停时改重力 X → store 更新；运行时所有 input disabled

---

#### Task 03-02-02: 环境面板单元测试

**文件**: `frontend/src/components/__tests__/EnvironmentPanel.spec.tsx`（新建）

**覆盖**:
- 渲染 4 个重力预设胶囊
- 点击"月球" → store.environment.gravity → [0, -1.62, 0]
- 拖动 frictionScale slider → store 更新
- isRunning=true → 所有 Slider/Input disabled
- 横幅文字可见
- 高亮 class 出现/消失

**验收**: `npx vitest run src/components/__tests__/EnvironmentPanel.spec.tsx` 全绿

---

#### Task 03-02-03: Scene3D + EntityRenderer 接入 environment

**文件**:
- `frontend/src/components/Scene3D.tsx`（修改）
- `frontend/src/components/EntityRenderer.tsx`（修改）

**Scene3D 变更**:
```tsx
const gravity = useSimulationStore((s) => s.environment.gravity);
<Physics gravity={gravity} ...>
```

**EntityRenderer 变更**:
```tsx
const frictionScale = useSimulationStore((s) => s.environment.frictionScale);
const restitutionScale = useSimulationStore((s) => s.environment.restitutionScale);
const drag = useSimulationStore((s) => s.environment.drag);

<RigidBody
  friction={Math.min(rb.friction * frictionScale, 2.0)}
  restitution={Math.min(rb.restitution * restitutionScale, 1.0)}
  linearDamping={drag}
  angularDamping={drag * 0.5}
  mass={rb.mass}              // ← 新增：mass prop（Phase 2 遗漏，spring joint 需要）
  ...
>
```

> **⚠️ 注意**: mass prop 对 useSpringJoint 的正确性至关重要。若 RigidBody 未声明 mass → Rapier 默认 mass=1，但 explicit 传值更安全。

**验收**: 
- 暂停时改重力为 [0, 0, 0] → 播放 → 物体不下落
- 改 frictionScale=0 → 物体在斜面上完全不减速（或极端缓慢）
- 改 drag=5 → 物体下落明显慢

---

#### Task 03-02-04: Toolbar 集成环境按钮

**文件**: `frontend/src/components/Toolbar.tsx`（修改）

**变更**:
1. 在 Toolbar 右侧（Play/Pause/Reset 右侧）新增 "环境" 按钮
2. 图标: `Globe` from lucide-react
3. title: "环境参数"
4. onClick: `toggleEnvironmentPanel()`
5. 按钮样式与现有 Toolbar 按钮一致

**验收**: 点击环境按钮 → `store.environmentPanelOpen` toggle；按钮视觉与 Toolbar 一致

---

### Plan 03-03: Spring 渲染 + 创建状态机（4 tasks）

**依赖**: 03-01 完成（与 03-02 可并行）
**产出**: SpringRenderer (helix tube)、useSpringJoint、Toolbox 弹簧按钮、Spring 创建状态机

---

#### Task 03-03-01: 创建 SpringRenderer 组件

**文件**: `frontend/src/components/SpringRenderer.tsx`（新建）

**参考原型**: `EntityRenderer.tsx`（R3F 组件模式 + Rapier ref）

**核心逻辑**:
```tsx
function SpringRenderer({ entity, isSelected, onSelect }: SpringRendererProps) {
  const constraintComp = entity.components.get('constraint') as ConstraintComponent;
  const jointApiRef = useRef<any>(null);
  const tubeRef = useRef<THREE.Mesh>(null);

  // 获取两端 RigidBody ref
  // ... (via global rigidBodyRef registry or entityId→ref Map)

  // useSpringJoint hook
  useSpringJoint(rigidBodyARef, rigidBodyBRef, [
    [0,0,0], [0,0,0],           // anchor points (世界坐标, 即实体位置)
    constraintComp.params.restLength,
    constraintComp.params.stiffness,
    constraintComp.params.damping,
  ]);

  // 动态 helix tube（useFrame）
  useFrame(() => {
    const posA = /* query bodyA translation */;
    const posB = /* query bodyB translation */;
    // 生成 helix 点 → 更新 tubeRef.geometry
  });

  return <mesh ref={tubeRef} onClick={...}><meshStandardMaterial color={isSelected ? '#3299ff' : '#888'} /></mesh>;
}
```

**关键技术点**:
- `useSpringJoint` 的两个 RigidBody ref 从哪里来？方案：用 `Map<string, React.RefObject>` 在 Scene3D 层面注册，SpringRenderer 通过 entityId 查表获取 ref
- 或者：利用 `@react-three/rapier` 的 `useRapier()` 在父级 `<Physics>` 内通过 RigidBody handle 获取
- **实施策略**: task 内做两种方案尝试，选实现路径短的那个

**Helix 生成**:
- `generateHelixPoints(posA, posB, coils=8, radius=0.08)` → `[THREE.Vector3, ...]`
- coils 随 `currentLength/restLength` 动态调整：拉伸时 coils ↓，压缩时 coils ↑
- TubeGeometry 每帧 dispose + recreate

**验收**: 两个已连接的实体间可见螺旋线；实体移动时螺旋线跟随

---

#### Task 03-03-02: Toolbox 集成弹簧按钮

**文件**: `frontend/src/components/Toolbox.tsx`（修改）

**变更**:
1. 在 4 个形状按钮下方加 Separator（`<div className="w-6 h-px bg-white/6 my-1" />`）
2. 新增弹簧按钮:
   - 图标: `ZigZag` from lucide-react（或自定义 SVG）
   - label: "添加弹簧"
   - shortcut: "K"
   - onClick: `enterSpringMode()`
3. 按钮高亮态: springCreationStage !== 'idle' 时显示蓝色底色

**验收**: 点击弹簧按钮 → `uiSlice.springCreationStage === 'pendingA'`；再次点击或 Esc → 'idle'

---

#### Task 03-03-03: 实现 Spring Creation 状态机

**文件**:
- `frontend/src/components/Scene3D.tsx`（修改 —— 点击分发）
- `frontend/src/components/SpringCreationBanner.tsx`（新建 —— 提示横幅）
- `frontend/src/components/SpringCreationDialog.tsx`（新建 —— 参数对话框）

**Scene3D 点击分发改造**:
```tsx
function handleEntityClick(entityId: string) {
  const stage = uiStore.getState().springCreationStage;
  if (stage === 'pendingA') selectSpringEndpointA(entityId);
  else if (stage === 'pendingB') {
    if (entityId === springEntityAId) selectSpringEndpointA(null); // 取消
    else selectSpringEndpointB(entityId); // 弹出 dialog
  }
  else selectEntity(entityId); // idle → 正常选中
}
```

**SpringCreationBanner**:
- 固定在 Toolbar 下方，居中
- 文字状态:
  - pendingA: "〰 弹簧创建模式 — 点击场景中第一个实体（锚点 A），或按 Esc 取消"
  - pendingB: "已选「XX」— 点击第二个实体（锚点 B），或按 Esc 取消"
- 玻璃态样式（与 Toolbar 一致）
- 仅在 springCreationStage !== 'idle' 时渲染

**SpringCreationDialog**:
- 参考原型: `CreationDialog.tsx`（zod + react-hook-form）
- 字段: stiffness（k, N/m）、restLength（L0, m）、damping
- 端点和按钮（取消/确认添加）
- 确认 → 调 `addEntity(createSpringEntity(A, B, params))` → `exitSpringMode()`

**交互细节**（UI-SPEC）:
- pendingA/pendingB 态：鼠标 hover 实体显示绿色描边（#22c55e）
- 已选 A：固定绿色描边
- 键盘: K 进入，Esc 退出

**验收**（集成测试）: `SpringCreation.flow.spec.tsx` 覆盖 idle→pendingA→pendingB→dialog→提交→idle 完整路径

---

#### Task 03-03-04: SpringRenderer 集成到 Scene3D

**文件**: `frontend/src/components/Scene3D.tsx`（修改）

**变更**:
在 EntityRenderer map 循环前加判断:
```tsx
{entityEntries.map(([id, entity]) =>
  entity.components.has('constraint') ? (
    <SpringRenderer key={id} entity={entity} isSelected={id === selectedId} onSelect={selectEntity} />
  ) : (
    <EntityRenderer key={id} entity={entity} isSelected={id === selectedId} onSelect={selectEntity} />
  )
)}
```

**关键**: SpringRenderer 不输出 `<RigidBody>`（它是纯可视化 + joint hook），所以在 `<Physics>` 内仅放置 hook 不需物理解体。

> **备选方案**: 若 useSpringJoint 要求 RigidBody 引用在同一个 `<Physics>` 子树上，考虑用 `<group>` 包裹 SpringRenderer。

**验收**: 弹簧在 3D 视图可见；选中时 tube color 变蓝

---

## Wave 3: 集成收尾

### Plan 03-04: PropertyPanel 多态 + 级联删除 + UAT（4 tasks）

**依赖**: 03-02 和 03-03 完成
**产出**: PropertyPanel 适配弹簧、级联删除、实体列表弹簧条目、UAT 验证

---

#### Task 03-04-01: PropertyPanel 多态分发

**文件**: `frontend/src/components/PropertyPanel.tsx`（修改）

**变更**:
```tsx
// 当前入口
const selectedEntity = entities.get(selectedEntityId);
if (!selectedEntity) return <EmptyState />;

// 新增分发
const isSpring = selectedEntity.components.has('constraint');
return isSpring
  ? <SpringPropertyEditor entity={selectedEntity} />
  : <EntityPropertyEditor entity={selectedEntity} />;  // 原有逻辑移入此组件
```

**SpringPropertyEditor**（新建内联组件或独立文件）:
- 标题: 弹簧属性
- 端点 A 名称 + 可点击跳转（onClick → selectEntity(entityAId)）
- 端点 B 名称 + 可点击跳转
- stiffness slider + input, 1-1000 N/m
- restLength slider + input, 0.1-50 m
- damping slider + input, 0-50
- 运行时只读横幅（与 EnvironmentPanel 一致）
- 删除按钮: 打开确认对话框 → removeEntity(springId) → selectEntity(null)

**样式**: 复用 Phase 2 PropertyPanel 的 Slider/Input 组件和 glassmorphism 容器

**验收**: 选中弹簧 → 面板显示 k/L0/damping 字段 + 端点引用；改动 k → 弹簧 behavior 变化

---

#### Task 03-04-02: 级联删除 + EntityList 弹簧条目

**文件**:
- `frontend/src/store/entitySlice.ts`（修改）
- `frontend/src/components/EntityList.tsx`（修改）

**entitySlice.removeEntity 改造**:
```ts
removeEntity: (id: string) =>
  set((state) => {
    if (!state.entities.has(id)) return state;
    const next = new Map(state.entities);
    next.delete(id);

    // 级联: 遍历所有 entity，删除引用了此 id 的 constraint entity
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
      selectedEntityId:
        state.selectedEntityId === id || cascadeRemove.includes(state.selectedEntityId ?? '')
          ? null
          : state.selectedEntityId,
    };
  }),
```

**EntityList 改造**:
- 弹簧条目用不同图标（ZigZag）
- 弹簧名以 "弹簧-" 前缀识别
- 点击弹簧条目 → selectEntity(springId)
- 显示端点摘要（A → B）

**验收**: 单元测试 — 删除 entityA 后引用它的 spring 同时被删除；selectedEntityId 正确清空

---

#### Task 03-04-03: 键盘快捷键扩展

**文件**: `frontend/src/components/App.tsx`（修改）

**新增快捷键**（叠加 Phase 2 D-08 现有 8 个快捷键）:
- `K` — 进入/退出弹簧创建模式（springCreationStage === 'idle' ? enterSpringMode() : exitSpringMode()）
- `Esc` — 退出弹簧创建模式（若 stage !== 'idle'）

**过滤器**: 保持 Phase 1 D-08 的 target 过滤（INPUT/TEXTAREA/SELECT/contentEditable 不响应）

**验收**: 手动按 K → 弹簧模式进入；按 Esc → 退出

---

#### Task 03-04-04: 手动 UAT（Phase 3 验收）

**覆盖 VALIDATION.md UAT-01 到 UAT-10**:

| UAT | 场景 | 通过标准 |
|-----|------|---------|
| 01 | EnvironmentPanel 视觉 | Popover 320px 玻璃态，4 段完整 |
| 02 | 月球重力 | 下落约 1/6 地球加速度 |
| 03 | 弹簧振子 | B 上下振荡，周期符合理论 |
| 04 | 弹簧选中 | tube 变蓝 + 属性面板显示 |
| 05 | 级联删除 | 删 entity 后弹簧消失 |
| 06 | 运行时只读 | 横幅 + disabled |
| 07 | 高亮动画 | 300ms 闪烁 |
| 08 | Reset 不清环境 | 重力仍月球 |
| 09 | 多弹簧链 | 无穿插，无爆炸 |
| 10 | 50+20 性能 | FPS ≥ 60 |

**验收**: 全部 10 项通过

---

### Plan 03-05（可选）: 集成测试 + 性能 Spike（2 tasks）

**依赖**: 03-04 完成
**触发条件**: 03-04 UAT-09 或 UAT-10 发现性能问题，或用户要求代码质量收尾

---

#### Task 03-05-01: 集成测试套件

**文件**:
- `frontend/src/__tests__/integration/spring-physics.integration.test.tsx`（新建）
- `frontend/src/__tests__/integration/environment-flow.integration.test.tsx`（新建）

**覆盖**:
- EnvironmentPanel → store → Scene3D Physics gravity 完整链路
- Spring Creation 状态机 → addEntity → SpringRenderer 渲染
- PropertyPanel 改 k → spring behavior 变化

**验收**: `npx vitest run` 全集绿；覆盖率 ≥ 75%

---

#### Task 03-05-02: 性能 Spike

**文件**: `frontend/src/__tests__/perf/spring-perf-spike.test.ts`（新建）

**覆盖**:
- 创建 50 实体 + 20 弹簧 → 运行 1000 步 → 测单步物理时间
- SpringRenderer useFrame 平均耗时
- GC 抖动测量（frame time variance）

**验收**: 
- 物理步进 < 4ms @ 50+20
- useFrame < 2ms @ 20 springs
- 帧时间方差 < 2ms（无 GC spike）

---

## Verification Matrix

| Plan | Tasks | 自动验证 | 手动 UAT |
|------|-------|---------|---------|
| 03-01 | 6 | `npx vitest run src/__tests__/ecs src/store/__tests__ src/__tests__/physics` | — |
| 03-02 | 4 | `npx vitest run src/components/__tests__/EnvironmentPanel` | UAT-01, 02, 06, 07, 08 |
| 03-03 | 4 | `npx vitest run src/components/__tests__/SpringCreation` | UAT-03, 09 |
| 03-04 | 4 | `npx vitest run src/store/__tests__/entitySlice.cascade` | UAT-04, 05 |
| 03-05 | 2 (opt) | `npx vitest run` 全集 + 性能测试 | UAT-10 |

---

## Risk Register（Plan 阶段）

| Risk | 影响 Task | 概率 | 缓解 |
|------|----------|------|------|
| useSpringJoint API 不接受 damping=0 或 mandatory anchor | 03-03-01 | Low | Pre-flight SP-1 先验证；降级: useDistanceJoint + 自实现阻尼 |
| TubeGeometry GC 抖动 > 2ms | 03-03-01 | Med | Pre-flight SP-2；降级: Line2 直线 |
| Radix Popover 在 React 19 StrictMode 双挂载 | 03-02-01 | Low | 自实现 absolute 定位（不依赖 Popover primitive） |
| EntityRenderer 获取 RigidBody ref 给 useSpringJoint 的方案复杂 | 03-03-01 | Med | 用全局 `Map<string, RefObject>` 在 Scene3D 注册 → SpringRenderer 读取 |
| gravity 浅比较失效 | 03-02-03 | Low | setGravity 保证 [...g] 新引用；单元测试覆盖 |
| 级联删除 O(n²) 在 50+20 场景 | 03-04-02 | Low | 线性扫描 < 1ms；性能 spike 验证 |

---

## File Manifest（Phase 3 所有文件变更）

### 新建文件（10 个）
- `frontend/src/components/EnvironmentPanel.tsx`
- `frontend/src/components/SpringRenderer.tsx`
- `frontend/src/components/SpringCreationBanner.tsx`
- `frontend/src/components/SpringCreationDialog.tsx`
- `frontend/src/components/__tests__/EnvironmentPanel.spec.tsx`
- `frontend/src/__tests__/ecs/ConstraintComponent.test.ts`
- `frontend/src/__tests__/physics/spring-oscillator.test.ts`
- `frontend/src/__tests__/physics/gravity-hot-swap.test.ts`
- `frontend/src/__tests__/physics/drag-decay.test.ts`
- `frontend/src/store/__tests__/simulationSlice.environment.spec.ts`

### 修改文件（8 个）
- `frontend/src/ecs/types.ts` — ConstraintComponent 类型
- `frontend/src/ecs/Entity.ts` — createSpringEntity 工厂
- `frontend/src/store/simulationSlice.ts` — environment 字段 + actions
- `frontend/src/store/uiSlice.ts` — spring 状态机 + environmentPanelOpen
- `frontend/src/store/entitySlice.ts` — 级联删除
- `frontend/src/components/Scene3D.tsx` — gravity prop + 点击分发 + SpringRenderer
- `frontend/src/components/EntityRenderer.tsx` — 倍率叠加 + mass + drag
- `frontend/src/components/Toolbar.tsx` — 环境按钮
- `frontend/src/components/Toolbox.tsx` — 弹簧按钮
- `frontend/src/components/PropertyPanel.tsx` — 多态分发
- `frontend/src/components/EntityList.tsx` — 弹簧条目
- `frontend/src/components/App.tsx` — K/Esc 快捷键

---

*Phase 3 Master Plan — 2026-05-02*
*Next: plan-checker validation → coverage gate → commit*
