# Phase 8 深度技术调研报告：Rapier 自定义力场层增强

**项目**: Physis - Web 端交互物理模拟平台
**调研日期**: 2026/05/31
**调研范围**: Rapier3D WASM + React Three Fiber 架构中的自定义力场计算与每帧注入
**核心问题**: 如何在现有架构上实现场-源关系、时变电磁场简化模型，并保持 50 实体 @ 120fps 性能？

---

## Executive Summary（核心结论）

1. **物理引擎无需更换**。Rapier 的 `useBeforePhysicsStep` + `addForce` 已足够支持所有自定义力场需求，迁移到其他引擎没有功能收益，只有生态损失。

2. **当前架构的瓶颈不在 Rapier，在场计算复杂度**。现有实现是 O(F×B)（力场数 × 刚体数），引入场-源关系后变为 O(B²)，50 实体场景下从 ~2500 次计算/帧暴涨到 ~2500 次（基本持平），但场-源关系下每个源要对每个体计算，实际为 O(S×B)（源数 × 体数），最坏 50×50=2500，与现有 O(F×B) 同量级。

3. **场-源关系的核心改造是数据模型，不是物理引擎**。需要新增 `FieldSourceComponent`（电荷/电流源），改造 `forceFieldCalc.ts` 从"预设外场"模式转为"场源产生场"模式。

4. **时变电磁场简化模型可行**，但需明确边界：支持法拉第电磁感应（变化磁场→涡旋电场）和位移电流（变化电场→磁场），不支持电磁波传播（需要 PDE 求解器）。

5. **性能优化有成熟路径**：空间哈希网格（O(N) 邻域查询）+  Barnes-Hut 近似（O(N log N)）+ Web Worker 并行场计算，足以支撑 50 实体 @ 120fps。

---

## 1. Rapier 自定义力注入机制分析

### 1.1 现有注入模式

Physis 当前使用 `@react-three/rapier` 的 `useBeforePhysicsStep` hook：

```tsx
useBeforeStep(() => {
  // 1. 收集所有力场
  // 2. 遍历所有 dynamic 刚体
  // 3. 计算合力 → body.addForce(F, true)
  // 4. 磁场特殊处理 → body.setLinvel(newVel, true)
});
```

**关键 API**：
- `body.addForce(force, wakeUp)` — 在当前物理步中施加力（力持续作用到步结束）
- `body.applyImpulse(impulse, wakeUp)` — 施加瞬时冲量（改变动量）
- `body.setLinvel(vel, wakeUp)` — 直接设置线速度（用于磁场能量守恒处理）
- `body.translation()` / `body.linvel()` / `body.mass()` — 查询刚体状态

### 1.2 API 行为细节

| API | 作用 | 适用场景 | 注意事项 |
|-----|------|---------|---------|
| `addForce(F, true)` | 力持续作用整个时间步 | 重力、电场力、均匀场 | 每帧调用，力会累积；`wakeUp=true` 唤醒休眠体 |
| `applyImpulse(J, true)` | 瞬时动量改变 | 碰撞响应、爆炸冲击 | 不适合持续力场 |
| `setLinvel(v, true)` | 直接覆盖速度 | 磁场能量守恒旋转 | 绕过物理积分器，需确保物理正确性 |

**关键发现**：`addForce` 的力是在物理步的**积分阶段**使用的，即在 `useBeforePhysicsStep` 中设置的力会被 Rapier 的内部积分器用于更新速度和位置。这是正确的物理流程。

### 1.3 固定时间步长同步

```ts
const DT = 1 / 120; // 与 Scene3D.tsx 中 Physics timeStep 保持一致
```

**风险**：如果 `useBeforePhysicsStep` 中的 DT 与 Rapier World 的 `timeStep` 不一致，磁场旋转角度 `theta = omega * dt` 会错误，导致能量守恒处理偏差。需确保两者严格同步（建议从 World 配置读取，而非硬编码）。

### 1.4 WASM-JS 边界穿越优化

当前实现每帧对每个刚体调用：
- `body.translation()` — 1 次
- `body.linvel()` — 1 次
- `body.mass()` — 1 次（仅磁场）
- `body.addForce()` — 1 次
- `body.setLinvel()` — 1 次（仅磁场）

**50 实体场景**：约 250 次 WASM-JS 调用/帧。Rapier WASM 的 getter/setter 是零分配的（v0.32+），但函数调用开销仍存在。

**优化方向**（非阻塞，后期可做）：
- 批量状态获取：Rapier 原生不支持批量 getter，但可通过 WASM 内存直接读取（需 unsafe 操作）
- 减少 `mass()` 调用：缓存质量到 ECS 组件中

---

## 2. 自定义力场计算架构设计

### 2.1 当前架构：预设外场模式

```
电场实体(ElectricFieldEntity) ──→ forceFieldCalc.electric() ──→ body.addForce()
                                    ↑
                                    预设参数: position, charge, range
```

**特点**：
- 力场是独立 ECS 实体，有固定位置和参数
- 电场/磁场的 `charge`/`strength` 描述的是"外场强度"，不是"这个实体是电荷源"
- 电荷实体（带 RigidBodyComponent.charge 的刚体）**不产生**电场

### 2.2 目标架构：场-源关系模式

```
电荷源实体(ChargedBody) ──→ 库仑定律 ──→ 电场分布 ──→ 其他带电体受力
                                    ↑
                                    E = Σ kQᵢr̂/r²

电流源实体(CurrentSource) ──→ 毕奥-萨伐尔 ──→ 磁场分布 ──→ 其他带电体受力
                                    ↑
                                    B = Σ (μ₀/4π) Idl×r̂/r²
```

**关键改造**：

#### 2.2.1 新增场源组件

```ts
// 场源组件 — 附加到带电荷/电流的实体上
export interface FieldSourceComponent extends Component {
  type: 'fieldSource';
  kind: 'charge' | 'current';  // 电荷源 | 电流源
  // charge 复用 RigidBodyComponent.charge
  // current 需要新增字段（电流大小 + 方向）
  current?: { magnitude: number; direction: [number, number, number] };
}
```

#### 2.2.2 改造力场计算

现有 `forceFieldCalc.ts` 的 `electric()` 函数：
```ts
// 当前：预设电场实体产生电场
function electric(field: ElectricFieldComponent, pos: Vec3, bodyCharge: number): Vec3 {
  // E = Q * r_vec / r³  (Q 是预设场源的电荷)
}
```

改造后：
```ts
// 目标：所有带 fieldSource 的实体产生电场
function electricFromSources(
  sources: Array<{ position: Vec3; charge: number }>,
  bodyPos: Vec3,
  bodyCharge: number,
): Vec3 {
  let Ex = 0, Ey = 0, Ez = 0;
  for (const src of sources) {
    const rx = bodyPos.x - src.position.x;
    const ry = bodyPos.y - src.position.y;
    const rz = bodyPos.z - src.position.z;
    const r = Math.hypot(rx, ry, rz);
    if (r > MAX_RANGE) continue;
    
    const rSoft2 = r * r + SOFTENING * SOFTENING;
    const inv_rSoft3 = 1 / (rSoft2 * Math.sqrt(rSoft2));
    Ex += src.charge * rx * inv_rSoft3;
    Ey += src.charge * ry * inv_rSoft3;
    Ez += src.charge * rz * inv_rSoft3;
  }
  
  return {
    x: COULOMB_K * bodyCharge * Ex,
    y: COULOMB_K * bodyCharge * Ey,
    z: COULOMB_K * bodyCharge * Ez,
  };
}
```

#### 2.2.3 兼容现有预设力场

场-源关系与预设外场**不冲突**，可同时存在：

```ts
function computeTotalForce_v2(
  presetFields: ForceFieldComponent[],  // 现有预设力场（uniform/gravity/electric/magnetic）
  fieldSources: FieldSourceComponent[],  // 新增场源（电荷/电流）
  bodyPos: Vec3,
  bodyVel: Vec3,
  bodyCharge: number,
): Vec3 {
  // 1. 预设力场贡献（现有逻辑）
  const F_preset = computeNonMagneticForce(presetFields, bodyPos, bodyCharge);
  
  // 2. 场-源关系贡献（新增）
  const F_fromSources = electricFromSources(fieldSources, bodyPos, bodyCharge);
  // TODO: 磁场源贡献
  
  return {
    x: F_preset.x + F_fromSources.x,
    y: F_preset.y + F_fromSources.y,
    z: F_preset.z + F_fromSources.z,
  };
}
```

### 2.3 毕奥-萨伐尔定律简化

磁场源（电流）产生磁场的完整毕奥-萨伐尔定律：

$$d\mathbf{B} = \frac{\mu_0}{4\pi} \frac{I d\mathbf{l} \times \hat{\mathbf{r}}}{r^2}$$

**简化方案**（适用于教学场景）：

1. **无限长直导线**：$B = \frac{\mu_0 I}{2\pi r}$，方向由右手定则确定
2. **圆形电流环**（中心轴线上）：$B = \frac{\mu_0 I R^2}{2(R^2 + x^2)^{3/2}}$
3. **磁偶极子近似**（远距离）：与电偶极子类似，$B \propto 1/r^3$

**实现建议**：Phase 8 先支持"无限长直导线"模型，后续版本扩展。

---

## 3. 时变电磁场简化模型

### 3.1 准静态近似（Quasi-static Approximation）

当电磁场变化的时间尺度远大于光速跨越系统尺度的时间时，可以忽略位移电流和电磁波辐射：

$$t_{variation} \gg \frac{L}{c}$$

对于 Physis 场景（尺度 L ~ 10m，光速 c ~ 3×10⁸ m/s）：
- 光跨越时间：$L/c \approx 33$ ns
- 物理步长：$dt = 1/120 \approx 8.3$ ms
- $dt \gg 33$ ns，**准静态近似完全成立**

### 3.2 法拉第电磁感应定律（简化）

$$\mathcal{E} = -\frac{d\Phi_B}{dt}$$

**离散化实现**：
```ts
// 每帧计算感应电场
function inducedElectricField(
  magneticFluxHistory: number[],  // 最近 N 帧的磁通量
  dt: number,
): Vec3 {
  // dΦ/dt ≈ (Φₙ - Φₙ₋₁) / dt
  const dPhi = magneticFluxHistory[0] - magneticFluxHistory[1];
  const dPhi_dt = dPhi / dt;
  
  // 感应电场方向由楞次定律确定
  // E_induced = - (dΦ/dt) / (2πr)  (环形电场，适用于轴对称)
  // 简化：在涡旋电场中，带电粒子受到的力 F = qE_induced
}
```

**简化边界**：
- 只计算由于**外磁场变化**（如用户调整磁场强度）产生的感应电场
- 不考虑由于电荷运动产生的变化磁场（那是完整 Maxwell 方程组）
- 感应电场以涡旋形式存在，方向由右手定则确定

### 3.3 安培-麦克斯韦定律（简化）

$$\nabla \times \mathbf{B} = \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}$$

**简化实现**：
- 只保留传导电流项 $\mu_0 \mathbf{J}$（即毕奥-萨伐尔部分）
- 位移电流项 $\mu_0 \varepsilon_0 \frac{\partial E}{\partial t}$ 在准静态近似下可忽略
- 但如果用户明确启用"位移电流"选项，可添加简化模型

### 3.4 时变场开关设计

```ts
export interface FieldSourceComponent extends Component {
  type: 'fieldSource';
  kind: 'charge' | 'current';
  // 时变参数
  timeVarying?: {
    enabled: boolean;
    amplitude: number;      // 振幅
    frequency: number;      // 频率 (Hz)
    phase: number;          // 初相位
  };
}

// 时变电荷/电流
function getTimeVaryingValue(
  baseValue: number,
  timeVarying: FieldSourceComponent['timeVarying'],
  t: number,
): number {
  if (!timeVarying?.enabled) return baseValue;
  return baseValue + timeVarying.amplitude * Math.sin(2 * Math.PI * timeVarying.frequency * t + timeVarying.phase);
}
```

### 3.5 数值稳定性

时变场引入的额外计算：
- 每帧需要计算 $sin(\omega t)$ — 极低成本
- 感应电场需要维护磁通量历史 — 固定大小环形缓冲区（如 10 帧）
- 总开销增加 < 5%

---

## 4. 性能优化策略

### 4.1 复杂度分析

| 场景 | 实体数 | 力场数 | 场源数 | 当前 O(F×B) | 场-源 O(S×B) | 优化后 |
|------|-------|-------|-------|------------|-------------|-------|
| 小场景 | 10 | 3 | 5 | 30 | 50 | 50 |
| 中场景 | 25 | 5 | 10 | 125 | 250 | 150 |
| 大场景 | 50 | 8 | 15 | 400 | 750 | 300 |
| 极限 | 50 | 10 | 20 | 500 | 1000 | 400 |

**结论**：50 实体场景下，纯 N 体计算最坏 1000 次力计算/帧，每次约 50-100 次浮点运算，总计 50k-100k FLOPs。现代 JS 引擎可轻松处理（> 1M FLOPs/ms）。

### 4.2 空间哈希加速

当实体分布不均匀时（如聚集成团），空间哈希可将计算量减少 50-80%：

```ts
// 简化空间哈希
class SpatialHash {
  private cellSize: number;
  private cells: Map<string, Set<string>>; // cellKey → entityIds
  
  insert(entityId: string, pos: Vec3): void {
    const cellKey = this.getCellKey(pos);
    if (!this.cells.has(cellKey)) this.cells.set(cellKey, new Set());
    this.cells.get(cellKey)!.add(entityId);
  }
  
  queryNeighbors(pos: Vec3, range: number): string[] {
    // 查询周围 3×3×3 = 27 个格子
    const neighbors: string[] = [];
    const cell = this.getCellCoord(pos);
    const rangeInCells = Math.ceil(range / this.cellSize);
    
    for (let dx = -rangeInCells; dx <= rangeInCells; dx++) {
      for (let dy = -rangeInCells; dy <= rangeInCells; dy++) {
        for (let dz = -rangeInCells; dz <= rangeInCells; dz++) {
          const key = `${cell.x + dx},${cell.y + dy},${cell.z + dz}`;
          const cellEntities = this.cells.get(key);
          if (cellEntities) neighbors.push(...cellEntities);
        }
      }
    }
    return neighbors;
  }
}
```

**适用条件**：实体有 `range` 限制（当前电场/重力场已有 range 字段），空间哈希效果显著。

### 4.3 Barnes-Hut 近似

对于无 range 限制的场（如引力场），Barnes-Hut 可将 O(N²) 降到 O(N log N)：

```ts
// 简化版 Barnes-Hut
class OctreeNode {
  centerOfMass: Vec3;
  totalCharge: number;
  bounds: BoundingBox;
  children: OctreeNode[] | null;
  
  // 如果节点距离 / 节点尺寸 > θ ( openness parameter, 通常 0.5-1.0)
  // 则将该节点所有电荷近似为位于质心的单一点电荷
}
```

**实现复杂度**：中等（约 300 行 JS）
**收益**：50 实体下 O(N log N) ≈ 300 次计算 vs O(N²) = 2500 次，约 8 倍加速
**建议**：50 实体场景下收益有限，但为 100+ 实体预留扩展能力。

### 4.4 Web Worker 并行

场计算可完全并行化（每个体的场计算相互独立）：

```ts
// main thread
const worker = new Worker('./fieldWorker.js');

useBeforeStep(() => {
  // 1. 收集所有源数据
  const sources = collectFieldSources();
  const bodies = collectDynamicBodies();
  
  // 2. 分批发送给 Worker
  const batchSize = Math.ceil(bodies.length / numWorkers);
  const promises = bodies
    .chunk(batchSize)
    .map(batch => workerCompute(sources, batch));
  
  // 3. 等待结果并注入
  const results = await Promise.all(promises);
  for (const { entityId, force } of results.flat()) {
    const body = getRef(entityId)?.current;
    body?.addForce(force, true);
  }
});
```

**风险**：`useBeforePhysicsStep` 是同步 hook，不支持 async。如果场计算放入 Worker，需要：
- 在主线程预计算（上一帧的结果用于当前帧）— 引入 1 帧延迟
- 或修改物理循环架构（不推荐）

**结论**：Web Worker 方案需要架构调整，建议作为后期优化，不在 Phase 8 中实施。

### 4.5 性能预算总结

| 计算阶段 | 当前开销 | Phase 8 开销 | 预算占比 |
|---------|---------|-------------|---------|
| 收集力场/源 | ~0.1 ms | ~0.1 ms | 1% |
| 场计算（50 实体） | ~0.3 ms | ~0.8 ms | 10% |
| WASM 调用开销 | ~0.2 ms | ~0.2 ms | 3% |
| Rapier 物理步进 | ~2-3 ms | ~2-3 ms | 37% |
| Three.js 渲染 | ~4-5 ms | ~4-5 ms | 50% |
| **总计** | **~7-9 ms** | **~8-10 ms** | **~83-100%** |

**目标帧时间**：8.33 ms (120fps) / 16.67 ms (60fps)
**结论**：Phase 8 增强后仍可在 60fps 下稳定运行，120fps 需要优化（空间哈希即可达标）。

---

## 5. 与现有架构的集成

### 5.1 ForceFieldSystem.tsx 改造

```tsx
export function ForceFieldSystem_v2() {
  const { getRef } = useRigidBodyRefRegistry();
  
  useBeforeStep(() => {
    const state = useSimulationStore.getState();
    const entities = state.entities;
    const t = performance.now() / 1000; // 仿真时间（秒）
    
    // 1. 收集预设力场
    const presetFields: ForceFieldComponent[] = [];
    // 2. 收集场源
    const fieldSources: Array<{ entityId: string; pos: Vec3; charge: number; timeVarying?: ... }> = [];
    // 3. 收集 dynamic 刚体
    const dynamicBodies = [];
    
    for (const [entityId, entity] of entities) {
      const f = entity.components.get('forceField') as ForceFieldComponent | undefined;
      if (f) presetFields.push(f);
      
      const src = entity.components.get('fieldSource') as FieldSourceComponent | undefined;
      const rb = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
      const ref = getRef(entityId)?.current;
      if (src && rb && ref) {
        const pos = ref.translation();
        const charge = getTimeVaryingValue(rb.charge, src.timeVarying, t);
        fieldSources.push({ entityId, pos, charge });
      }
      
      if (rb?.kind === 'dynamic' && ref) {
        dynamicBodies.push({ entityId, rb, ref });
      }
    }
    
    // 4. 计算并注入力
    for (const { entityId, rb, ref } of dynamicBodies) {
      const body = ref.current;
      if (!body) continue;
      const pos = body.translation();
      const vel = body.linvel();
      const charge = rb.charge ?? 0;
      
      // 4a) 预设力场
      const F_preset = computeNonMagneticForce(presetFields, pos, charge);
      
      // 4b) 场-源关系（新增）
      const F_sources = computeFieldFromSources(fieldSources, pos, charge, entityId);
      
      const F_total = {
        x: F_preset.x + F_sources.x,
        y: F_preset.y + F_sources.y,
        z: F_preset.z + F_sources.z,
      };
      
      if (F_total.x !== 0 || F_total.y !== 0 || F_total.z !== 0) {
        body.addForce(F_total, true);
      }
      
      // 4c) 磁场（罗德里格斯旋转）— 场源产生的磁场 + 预设磁场
      // ...
    }
  });
  
  return null;
}
```

### 5.2 序列化适配

新增 `fieldSource` 组件需要序列化支持：

```ts
// sceneSerializer.ts 扩展
function serializeEntity(entity: Entity): SerializedEntity {
  const components: Record<string, unknown> = {};
  
  for (const [type, comp] of entity.components) {
    switch (type) {
      case 'fieldSource':
        components.fieldSource = {
          kind: (comp as FieldSourceComponent).kind,
          timeVarying: (comp as FieldSourceComponent).timeVarying,
        };
        break;
      // ... 其他组件
    }
  }
  
  return { id: entity.id, name: entity.name, components };
}
```

**版本兼容性**：在序列化 JSON 中添加 `engineVersion: "2.1"` 字段，加载时根据版本做适配转换。

### 5.3 UI 集成

场源控制面板：
- PropertyPanel 中新增"场源"折叠面板
- 开关：启用/禁用场源
- 时变参数：振幅、频率、相位滑块
- 电流源：方向向量输入

---

## 6. 错误处理与数值稳定性

### 6.1 现有防御机制

| 机制 | 实现 | 效果 |
|------|------|------|
| Plummer 软化 | `SOFTENING = 0.5` | 防止 r→0 时 1/r² 爆炸 |
| 距离截断 | `if (r > range) return ZERO` | 减少无效计算 |
| NaN/Infinity 检查 | `isFiniteVec()` | 防止数值污染 |
| 零电荷短路 | `if (bodyCharge === 0) return ZERO` | 减少无效计算 |

### 6.2 场-源关系新增风险

| 风险 | 描述 | 缓解措施 |
|------|------|---------|
| 自相互作用 | 实体对自己施加力 | 计算时跳过 `entityId === sourceId` |
| 力发散 | 多源叠加导致合力过大 | 限制最大合力 `MAX_FORCE = 1e6` |
| 数值共振 | 时变场频率与物理步长共振 | 限制最大频率 `MAX_FREQ = 10 / DT = 1200 Hz` |
| 零质量除法 | 磁场旋转中 mass=0 | 已有 `if (mass <= 0) return vel` |

### 6.3 新增防御代码

```ts
const MAX_FORCE = 1e6;  // N, 超过此值截断
const MAX_FREQ = 1200;  // Hz, 时变场频率上限

function clampForce(F: Vec3): Vec3 {
  const mag = Math.hypot(F.x, F.y, F.z);
  if (mag > MAX_FORCE) {
    const scale = MAX_FORCE / mag;
    return { x: F.x * scale, y: F.y * scale, z: F.z * scale };
  }
  return F;
}
```

---

## 7. 推荐架构方案

### 7.1 模块划分

```
frontend/src/ecs/
  forceFieldCalc.ts          # 现有：预设力场计算
  fieldSourceCalc.ts         # 新增：场-源关系计算
  
frontend/src/components/
  ForceFieldSystem.tsx       # 现有：力注入系统（扩展）
  FieldSourceSystem.tsx      # 新增：场源可视化（可选）
  
frontend/src/store/
  fieldSourceSlice.ts        # 新增：场源状态管理（如有需要）
```

### 7.2 伪代码：完整力计算管道

```ts
// fieldSourceCalc.ts

interface FieldSource {
  entityId: string;
  position: Vec3;
  charge: number;
  current?: { magnitude: number; direction: Vec3 };
}

/**
 * 计算所有场源在指定位置产生的电场。
 * 复杂度：O(S)，S = 场源数
 */
export function computeElectricFieldFromSources(
  sources: FieldSource[],
  targetPos: Vec3,
  excludeId?: string,  // 排除自身（防止自相互作用）
): Vec3 {
  let Ex = 0, Ey = 0, Ez = 0;
  
  for (const src of sources) {
    if (src.entityId === excludeId) continue;
    
    const rx = targetPos.x - src.position.x;
    const ry = targetPos.y - src.position.y;
    const rz = targetPos.z - src.position.z;
    const r = Math.hypot(rx, ry, rz);
    
    if (r > MAX_RANGE) continue;
    
    const rSoft2 = r * r + SOFTENING * SOFTENING;
    const inv_rSoft3 = 1 / (rSoft2 * Math.sqrt(rSoft2));
    
    Ex += src.charge * rx * inv_rSoft3;
    Ey += src.charge * ry * inv_rSoft3;
    Ez += src.charge * rz * inv_rSoft3;
  }
  
  return { x: COULOMB_K * Ex, y: COULOMB_K * Ey, z: COULOMB_K * Ez };
}

/**
 * 计算带电体在场源产生的电场中的受力。
 */
export function computeForceFromFieldSources(
  sources: FieldSource[],
  bodyPos: Vec3,
  bodyCharge: number,
  bodyId: string,
): Vec3 {
  if (bodyCharge === 0) return ZERO;
  
  const E = computeElectricFieldFromSources(sources, bodyPos, bodyId);
  return {
    x: bodyCharge * E.x,
    y: bodyCharge * E.y,
    z: bodyCharge * E.z,
  };
}
```

### 7.3 关键决策点

| 决策 | 选项 A | 选项 B | 建议 |
|------|--------|--------|------|
| 场源与刚体耦合 | 复用 RigidBodyComponent.charge | 新增独立 FieldSourceComponent.charge | **A** — 避免数据冗余 |
| 电流源方向 | 世界坐标系向量 | 实体本地坐标系 | **B** — 随实体旋转 |
| 时变场更新 | 每帧重新计算 sin(ωt) | 缓存 sin 表 | **A** — sin 计算极快 |
| 空间哈希 | Phase 8 即实现 | 后期优化 | **B** — 50 实体无压力 |
| 自相互作用 | 自动排除 | 允许（用于测试） | **A** — 物理正确 |

---

## 8. 风险与缓解措施

| 风险 | 严重程度 | 可能性 | 缓解措施 |
|------|---------|--------|---------|
| 场-源关系引入性能回归 | 中 | 中 | 空间哈希 + 距离截断 |
| 时变场数值不稳定 | 中 | 低 | 频率上限 + 振幅限制 |
| 序列化格式不兼容 | 低 | 低 | 版本字段 + 适配转换 |
| 用户混淆"电荷"与"场源" | 低 | 高 | UI 明确标注 + 工具提示 |
| 毕奥-萨伐尔实现复杂 | 中 | 中 | 先实现无限长直导线简化模型 |
| 与 Phase 4 表达式力冲突 | 中 | 低 | 力叠加时明确优先级 |

---

## 9. 与 Phase 4 表达式驱动外力的叠加规则

Phase 4 引入的表达式力与 Phase 8 场-源关系的叠加：

```
总力 = 重力 + 预设力场力 + 场-源关系力 + 表达式力 + 弹簧力
```

**优先级**（从低到高）：
1. 重力（始终存在）
2. 预设力场（uniform/gravity/electric/magnetic）
3. 场-源关系力（电荷/电流产生的场）
4. 表达式力（用户自定义 fx/fy/fz）
5. 弹簧力（约束系统）

**实现**：所有力在 `ForceFieldSystem` 中计算后矢量叠加，通过 `addForce` 一次性注入。

---

## 10. 实施建议

### 10.1 Phase 8 范围（推荐）

**在范围内**：
1. 场-源关系（电荷产生电场）
2. 毕奥-萨伐尔简化（无限长直导线磁场）
3. 时变电磁场简化模型（正弦时变 + 感应电场）
4. 性能优化（空间哈希）
5. 序列化适配
6. UI 控制面板

**不在范围内**：
1. Barnes-Hut 近似（50 实体不必要）
2. Web Worker 并行（架构改动大）
3. 完整毕奥-萨伐尔（任意电流分布）
4. 位移电流（准静态近似下可忽略）
5. 电磁波模拟（需要 PDE 求解器）

### 10.2 预估工作量

| 任务 | 预估时间 |
|------|---------|
| 数据模型扩展（FieldSourceComponent） | 2h |
| 场-源计算引擎（fieldSourceCalc.ts） | 4h |
| ForceFieldSystem 改造 | 3h |
| 时变场模型 | 3h |
| 空间哈希优化 | 4h |
| 序列化适配 | 2h |
| UI 控制面板 | 4h |
| 测试（单元 + 集成） | 4h |
| **总计** | **~26h** |

---

## RESEARCH COMPLETE

*调研完成，结论：无需更换物理引擎。在 Rapier 上扩展自定义力场层即可实现所有 Phase 8 目标。*
