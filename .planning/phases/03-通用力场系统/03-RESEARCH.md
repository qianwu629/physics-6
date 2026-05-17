---
phase: 3
phase_name: 通用力场系统
date: "2026-05-17"
---

# Phase 3 技术调研 — 通用力场系统

## 1. 力场物理计算

### 1.1 均匀方向场 (Uniform Direction Field)
- **公式**: `F = strength * direction` (恒定矢量)
- **参数**: `direction: [dx, dy, dz]` (单位向量), `strength: number` (N)
- **行为**: 场内所有动态实体受到相同方向和大小的力
- **物理等价**: 类似重力但方向可自定义（如风力、推力）

### 1.2 点引力源 (Point Gravity Source)
- **公式**: `F = -strength * (r_vec / |r|^3)` = `-strength * r_hat / r^2`
- **参数**: `strength: number` (引力常数 G*M, 单位 N·m²), `range: number` (作用半径 m), `decay: boolean` (是否衰减)
- **行为**: 实体被拉向力场中心，力大小与距离平方成反比
- ** cutoff**: 当 `|r| > range` 时力降为 0

### 1.3 点电荷电场 (Point Charge Electric Field)
- **公式**: `E = k * Q * r_vec / |r|^3`, `F = q * E` = `k * Q * q * r_vec / |r|^3`
- **参数**: `charge: number` (场源电荷 Q, 单位 C), `range: number`, `decay: boolean`
- **行为**: 同号相斥，异号相吸；带电实体（charge ≠ 0）响应
- **k**: 库仑常数 ~8.99×10⁹ N·m²/C²（为数值稳定性可缩放为 1）

### 1.4 均匀磁场 (Uniform Magnetic Field)
- **公式**: `F = q * (v × B)` (洛伦兹力)
- **参数**: `direction: [dx, dy, dz]` (B 场方向), `strength: number` (B 场强度 T)
- **行为**: 仅对带电且运动实体施力；力方向垂直于速度和 B 场平面
- **关键特性**: 不做功（力始终垂直于速度），导致圆周/螺旋运动
- **叉积计算**: `F = q * (v_y*B_z - v_z*B_y, v_z*B_x - v_x*B_z, v_x*B_y - v_y*B_x)`

### 1.5 多力场叠加
- **规则**: 矢量和。每个物理步长，对每个动态实体计算所有影响力场的力矢量之和
- `F_total = Σ F_field_i + F_gravity` (重力由 simulationSlice.environment 独立管理)
- **注意**: 力场计算应在 Rapier 的 `beforeStep` 或每帧的 `applyForce` 中执行，确保在物理积分前注入

## 2. Rapier 集成

### 2.1 施加外力的 API 选择

**选项 A: `rigidBody.applyForce(force, wakeUp)`**
- 在 React 组件的 `useFrame` 中调用
- 每帧对目标刚体施加力（持续一帧）
- **优点**: 简单直接，与 R3F 渲染循环同步
- **缺点**: 若帧率波动，力作用时间不精确（120Hz 物理步 vs 60Hz 渲染帧）
- **适用**: 均匀场、磁场（每帧重新计算）

**选项 B: `world.forEachRigidBody()` + `beforeStep` hook**
- 在 Physics world 的 `beforeStep` 回调中执行
- 保证每物理步（120Hz）都执行一次
- **优点**: 与物理步长严格同步，帧率无关
- **缺点**: 需要访问 raw Rapier world（通过 `@react-three/rapier` 的 `useWorld()`）
- **适用**: 所有力场类型（推荐主方案）

**选项 C: `rigidBody.setAdditionalMassProperties` + Custom Gravity**
- Rapier 原生支持 per-body gravity scale
- **缺点**: 只能模拟均匀方向场，无法处理点源/磁场
- **结论**: 不适用

### 2.2 推荐集成方案

```typescript
// 在 Scene3D 或专用 ForceFieldSystem 组件中
const world = useWorld();

useBeforeStep((world) => {
  // 获取所有力场实体
  const forceFields = getForceFieldEntities();
  
  // 遍历所有动态刚体
  world.forEachRigidBody((body) => {
    const entityId = body.userData?.entityId;
    if (!entityId) return;
    
    const entity = getEntityById(entityId);
    const pos = body.translation();
    const vel = body.linvel();
    const charge = entity?.components.get('rigidBody')?.charge ?? 0;
    
    let totalForce = { x: 0, y: 0, z: 0 };
    
    for (const field of forceFields) {
      const f = computeFieldForce(field, pos, vel, charge);
      totalForce.x += f.x;
      totalForce.y += f.y;
      totalForce.z += f.z;
    }
    
    body.applyForce(totalForce, true);
  });
});
```

**关键决策**: `@react-three/rapier` 的 `useBeforeStep` 是最佳集成点。它在每个物理步之前调用，与 120Hz 固定步长严格同步。

### 2.3 获取刚体引用
- 实体 ID 到 Rapier RigidBody 的映射：通过 `@react-three/rapier` 的 `RigidBody` 组件 `ref`
- 在 `EntityRenderer` 中为每个 dynamic rigidBody 存储 `ref`
- 或在 `useBeforeStep` 中通过 `world.forEachRigidBody` 遍历并匹配 `userData.entityId`

### 2.4 Charge 字段集成
- `RigidBodyComponent` 新增 `charge: number`（默认 0）
- Charge 不影响 Rapier 原生物理（碰撞、质量等）
- 仅在力场计算中读取：电场力 `F = qE`，洛伦兹力 `F = qv×B`
- 无 charge 的实体只响应均匀方向场和引力场（与电荷无关）

## 3. 可视化架构

### 3.1 箭头矩阵 (Arrow Matrices) — 均匀方向场 & 均匀磁场
- **技术**: Three.js `InstancedMesh`
- **几何体**: `ConeGeometry` (箭头头部) + `CylinderGeometry` (箭杆)
- **材质**: `MeshStandardMaterial` (支持透明、颜色)
- **布局**: 在力场作用范围内按固定间距（如 2m）排列箭头网格
- **方向**: 均匀方向场 = 统一指向 force direction；磁场 = 统一指向 B 方向
- **长度/颜色编码**: 可选按强度映射（但均匀场强度处处相等，长度固定即可）
- **性能**: InstancedMesh 一次性绘制数百个箭头 = 1 个 draw call

### 3.2 半透明体积 — 点引力源 & 点电荷电场
- **技术**: `SphereGeometry` + `MeshStandardMaterial`
- **材质参数**: `transparent: true`, `opacity: 0.15-0.25`, `depthWrite: false`
- **半径**: 等于力场 `range` 参数
- **颜色**: 
  - 引力源 = 中性色（如淡蓝/灰）
  - 正电荷 = 暖色（红/橙）
  - 负电荷 = 冷色（蓝/紫）
- **视觉提示**: 中心点可加发光小球（`Emissive` 材质）标识力场源位置

### 3.3 力线可视化 (Force Lines) — FIELD-04
- **类型**: 
  - 电场线: 从正电荷发出，终止于负电荷或无穷远
  - 磁感线: 闭合曲线，无起点/终点
  - 引力场线: 从无穷远汇聚到引力源
  - 均匀场力线: 平行等距直线

- **渲染技术选择**:

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| `Line` (GL_LINE) | 最简单，性能好 | 线宽受限（WebGL max 1px） | ★★ |
| `LineSegments` | 可控线段，性能好 | 需要预计算端点 | ★★★ |
| `TubeGeometry` | 粗细可控，视觉好 | 高顶点数，性能差 | ★ |
| `Line2` (three/examples) | 粗细可控，性能好 | 需额外依赖 | ★★★ |

**推荐**: `LineSegments` 用于密度力线（大量短线段），`Line` 用于稀疏主干力线。若需粗线可引入 `three/examples/jsm/lines/Line2`。

- **密度计算**: 
  - 电场: 力线数量 ∝ |Q|（电荷量）
  - 磁场: 均匀分布
  - 引力: 径向均匀分布
  - 均匀场: 平行等距

- **动态性**: 力线是静态几何（由力场参数决定），除非力场参数改变否则无需每帧重建

### 3.4 渲染器组件结构

```
Scene3D
├── ...existing renderers...
├── ForceFieldRenderer       # 箭头矩阵 + 半透明球体
│   ├── UniformFieldArrows
│   ├── GravityFieldSphere
│   ├── ElectricFieldSphere
│   └── MagneticFieldArrows
└── ForceFieldLinesRenderer  # 力线叠加层 (toggleable)
```

## 4. ECS 组件设计

### 4.1 ComponentType 扩展

```typescript
export type ComponentType = 
  | 'transform' | 'rigidBody' | 'collider' | 'velocity' 
  | 'material' | 'constraint' | 'trail' | 'vector'
  | 'forceField';  // NEW for Phase 3
```

### 4.2 ForceFieldComponent — Discriminated Union

参照 `ColliderComponent` 的 `shape` discriminated union 模式：

```typescript
export type ForceFieldKind = 'uniform' | 'gravity' | 'electric' | 'magnetic';

export interface BaseForceFieldComponent extends Component {
  type: 'forceField';
  kind: ForceFieldKind;
  position: [number, number, number];  // 力场中心位置
  range: number;                        // 作用半径 (m)
}

export interface UniformFieldComponent extends BaseForceFieldComponent {
  kind: 'uniform';
  direction: [number, number, number];  // 力方向 (非单位向量，含强度)
  strength: number;                     // 力强度 (N)
}

export interface GravityFieldComponent extends BaseForceFieldComponent {
  kind: 'gravity';
  strength: number;                     // G*M (N·m²)
  decay: boolean;                       // 是否 1/r² 衰减
}

export interface ElectricFieldComponent extends BaseForceFieldComponent {
  kind: 'electric';
  charge: number;                       // 场源电荷 Q (C)
  decay: boolean;
}

export interface MagneticFieldComponent extends BaseForceFieldComponent {
  kind: 'magnetic';
  direction: [number, number, number];  // B 场方向
  strength: number;                     // B 场强度 (T)
}

export type ForceFieldComponent =
  | UniformFieldComponent
  | GravityFieldComponent
  | ElectricFieldComponent
  | MagneticFieldComponent;
```

### 4.3 RigidBodyComponent 扩展

```typescript
export interface RigidBodyComponent extends Component {
  type: 'rigidBody';
  kind: RigidBodyKind;
  mass: number;
  restitution: number;
  friction: number;
  charge: number;    // NEW: 电荷量 (C)，默认 0
}
```

### 4.4 Entity 工厂扩展

```typescript
export function createForceFieldEntity(
  kind: ForceFieldKind,
  position: [number, number, number],
  range: number,
  params: ForceFieldParams,
): Entity {
  const n = nextNumber();
  const forceFieldComp: ForceFieldComponent = {
    type: 'forceField',
    kind,
    position,
    range,
    ...params,
  } as ForceFieldComponent;
  
  return createEntity(
    `forcefield-${n}`,
    `力场-${kind}-${n}`,
    [
      { type: 'transform', position, rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
      forceFieldComp,
    ]
  );
}
```

**注意**: ForceField 实体 = transform + forceField 组件。无 collider/rigidBody（不参与碰撞）。

### 4.5 实体检测模式

```typescript
// PropertyPanel 分支
if (entity.components.has('forceField')) {
  renderForceFieldEditor(entity);
} else if (entity.components.has('rigidBody')) {
  renderRigidBodyEditor(entity);  // 含 charge 字段
}
```

## 5. UI/UX 模式

### 5.1 ForceFieldDialog — 创建/编辑对话框

**架构**: 复用 `CreationDialog` 模式（Zod schema + react-hook-form）

**Schema 结构**:
```typescript
const forceFieldSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('uniform'),
    position: z.tuple([z.number(), z.number(), z.number()]),
    range: z.number().min(0.1).max(100),
    direction: z.tuple([z.number(), z.number(), z.number()]),
    strength: z.number().min(-1000).max(1000),
  }),
  z.object({
    kind: z.literal('gravity'),
    position: z.tuple([z.number(), z.number(), z.number()]),
    range: z.number().min(0.1).max(100),
    strength: z.number().min(0).max(10000),
    decay: z.boolean(),
  }),
  // ... electric, magnetic
]);
```

**UI 布局**:
1. 力场类型选择器（4 个卡片/按钮）
2. 通用参数: 位置 (x,y,z 输入), 范围 (Slider)
3. 类型专用参数区（动态显示）
4. 确认/取消按钮

### 5.2 Toolbox 集成

**位置**: 弹簧按钮下方新增分隔线 + 力场按钮组

**按钮**: 4 个图标按钮（lucide-react）
- 均匀方向场: `ArrowUp`
- 点引力源: `Crosshair`
- 点电荷电场: `Zap`
- 均匀磁场: `Magnet`

**点击行为**: `openForceFieldDialog(kind)` — 预选类型打开对话框

### 5.3 PropertyPanel 扩展

**力场实体分支**:
- 类型显示（不可编辑）
- 强度 Slider
- 范围 Input
- 方向 Vector3 输入（uniform/magnetic）
- 衰减模式 Switch（gravity/electric）
- 电荷 Input（electric 场源电荷）

**刚体实体分支**:
- 在 mass/restitution/friction 下方新增 charge 字段
- Slider: -10 ~ +10 C（教学场景足够）
- 标签: "电荷 (C)"

### 5.4 Toolbar 扩展

新增「力线」toggle 按钮:
- 图标: `GitBranch` 或 `Waves`
- 状态: 全局力线显示开关
- 存储: `visualizationStore` 或新 `forceFieldStore`

## 6. 序列化

### 6.1 sceneSerializer 扩展

**新增组件序列化**:
```typescript
// 序列化
if (comp.type === 'forceField') {
  return { type: 'forceField', ...(comp as ForceFieldComponent) };
}

// 反序列化
if (data.type === 'forceField') {
  return { type: 'forceField', ...data } as ForceFieldComponent;
}
```

### 6.2 RigidBody 序列化扩展

```typescript
// 序列化时包含 charge
{
  type: 'rigidBody',
  kind: 'dynamic',
  mass: 1,
  restitution: 0.5,
  friction: 0.3,
  charge: 0,  // NEW
}
```

### 6.3 预设场景

**点电荷力场示例**（Phase 1 推迟的第 6 个预设）:
- 2 个带电球体（+Q 和 -Q）
- 1 个点电荷电场力场
- 展示库仑力相互作用

## 7. 性能考虑

### 7.1 每帧计算成本
- **力场数量**: 预计用户同时创建 ≤5 个力场
- **实体数量**: MAX_ENTITIES = 50
- **计算复杂度**: O(fields × bodies) = ~250 次力计算/物理步
- **单次计算**: 向量运算（减、乘、归一化）—— 可忽略
- **总成本**: <0.1ms/步（120Hz）

### 7.2 可视化性能
- **InstancedMesh**: 1 个 draw call 绘制所有箭头（数百个）
- **半透明球体**: 每个力场 1 个 SphereMesh，开启透明混合
- **力线**: 静态几何，仅在力场参数改变时重建
- **总体**: 增加 <5 draw calls，不影响 60fps 目标

### 7.3 内存
- ForceFieldComponent 存储在 entitySlice.entities Map 中
- 无额外大型缓冲区（区别于 Phase 2 的 chartBuffer）

## 8. 验证架构

### 8.1 单元测试策略
1. **力计算正确性**: 
   - 均匀场: `F = [strength*dx, strength*dy, strength*dz]`
   - 引力场: 距离 2m，strength=10 → |F| = 10/4 = 2.5N
   - 电场: Q=1, q=1, r=1 → |F| = k*1*1/1 = k (缩放后=1)
   - 磁场: v=[1,0,0], B=[0,0,1], q=1 → F=[0,-1,0]

2. **多力场叠加**: 2 个同向均匀场 → 合力 = 2×单力

3. **范围 cutoff**: r > range → F = 0

4. **电荷零值**: charge=0 的实体不受电场/磁场影响

### 8.2 集成测试
1. **Rapier 同步**: 施加力后实体加速度符合 `a = F/m`
2. **磁场圆周运动**: 带电粒子垂直进入均匀磁场 → 圆周运动，半径 `r = mv/qB`
3. **UI 流程**: Toolbox 点击 → Dialog 打开 → 确认 → 实体创建 → 3D 可视化出现

### 8.3 UAT 验收项
- [ ] 创建 4 种力场，3D 场景中出现对应可视化
- [ ] 带电实体在电场中加速/偏转
- [ ] 带电粒子在磁场中做圆周运动
- [ ] 力线 toggle 开关正常工作
- [ ] 预设场景（点电荷）正确加载

## 9. 关键决策与风险

### 9.1 已确认决策
- `useBeforeStep` 作为力场注入点（与 120Hz 物理步同步）
- `InstancedMesh` 用于箭头矩阵（性能最优）
- `MeshStandardMaterial` + transparent 用于体积可视化
- ForceFieldComponent 采用 discriminated union（参照 ColliderComponent）

### 9.2 待 Planner 决定
- 力线渲染具体用 `LineSegments` 还是 `Line2`
- ForceFieldStore 是否需要（独立 store 管理可视化状态）
- 力场参数改变时是否实时更新可视化（debounce vs immediate）

### 9.3 风险
- **风险 1**: `@react-three/rapier` 的 `useBeforeStep` 在 v1.x 中 API 可能变化 → 需要验证版本兼容性
- **风险 2**: 大量力线几何体可能导致内存压力 → 限制力线密度/数量
- **风险 3**: 磁场洛伦兹力计算中的叉积在数值上可能不稳定 → 需要归一化 B 场方向

## RESEARCH COMPLETE
