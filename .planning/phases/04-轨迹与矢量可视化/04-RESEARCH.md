# Phase 4: 轨迹与矢量可视化 — 技术研究

**Researched:** 2026-05-03
**Phase:** 4 — 轨迹与矢量可视化
**Requirements:** DIF-02 (轨迹残影), DIF-03 (矢量箭头)

---

## 1. 轨迹残影实现方案

### 1.1 核心技术选型

| 方案 | 实现方式 | 优点 | 缺点 | 推荐 |
|------|----------|------|------|------|
| **Line + BufferGeometry + 顶点颜色** | 单条 THREE.Line，动态更新 position 和 color attribute | 性能最佳（单次 draw call），渐变效果精确 | 需手动管理 buffer，代码量稍多 | **首选** |
| 多个 LineSegment 拼接 | 每段独立 Line，每段独立颜色/透明度 | 实现简单直观 | N 段 = N 次 draw call，性能差 | 不推荐 |
| TrailRenderer 类库 | 使用第三方 trail 渲染器 | 功能完整 | 引入额外依赖，与本项目 ECS 架构难集成 | 不推荐 |
| Points + ShaderMaterial | 点精灵 + 自定义 shader 淡出 | GPU 并行处理，极致性能 | 实现复杂，shader 维护成本高 | 过度设计 |

### 1.2 渐变轨迹实现细节

**BufferGeometry 顶点颜色渐变方案：**

```typescript
// 核心思路
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(maxPoints * 3); // x, y, z
const colors = new Float32Array(maxPoints * 3);    // r, g, b
const alphas = new Float32Array(maxPoints);         // a (需自定义 attribute)

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

// Material: 开启顶点颜色 + 自定义 shader 处理 alpha
const material = new THREE.ShaderMaterial({
  vertexColors: true,
  transparent: true,
  vertexShader: `...`,   // 传递 color + alpha
  fragmentShader: `...`, // 应用 alpha 到输出
});
```

**在 R3F 中的封装方式：**

```tsx
// 封装为 R3F 组件
function TrajectoryLine({ points, color }: { points: Vector3[]; color: string }) {
  const lineRef = useRef<THREE.Line>(null);
  
  useFrame(() => {
    if (!lineRef.current) return;
    const geo = lineRef.current.geometry;
    const posAttr = geo.attributes.position;
    const colorAttr = geo.attributes.color;
    const alphaAttr = geo.attributes.alpha;
    
    // 更新 positions
    for (let i = 0; i < points.length; i++) {
      posAttr.setXYZ(i, points[i].x, points[i].y, points[i].z);
    }
    
    // 更新渐变：头部(最近) alpha=1，尾部(最旧) alpha=0
    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1); // 0=头部, 1=尾部
      alphaAttr.setX(i, 1 - t); // 线性淡出
    }
    
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    geo.setDrawRange(0, points.length);
  });
  
  return (
    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial vertexColors transparent opacity={0.8} />
    </line>
  );
}
```

> **注意**：R3F 的 `<line>` 元素默认不支持自定义 shader material。需要使用 `<primitive object={new THREE.Line(geometry, material)} />` 或自定义组件。

### 1.3 采样与存储策略

| 参数 | 值 | 理由 |
|------|-----|------|
| 采样频率 | 30Hz (~33ms) | 10秒 300 点，平滑且内存可控 |
| 最大点数 | 300 | Float32Array 预分配，避免 GC |
| 最大时长 | 5s | 与点数限制"先到先截断" |
| 存储结构 | `Map<string, Float32Array>` | entityId → 环形缓冲区 |
| 更新位置 | `useFrame` (渲染帧) | 与物理步长解耦，视觉流畅 |

**环形缓冲区实现：**

```typescript
class TrajectoryBuffer {
  private buffer: Float32Array; // [x0,y0,z0, x1,y1,z1, ...]
  private head = 0;  // 最新数据写入位置
  private count = 0; // 当前有效点数
  private readonly stride = 3;
  
  constructor(private maxPoints: number) {
    this.buffer = new Float32Array(maxPoints * this.stride);
  }
  
  push(x: number, y: number, z: number): void {
    const idx = this.head * this.stride;
    this.buffer[idx] = x;
    this.buffer[idx + 1] = y;
    this.buffer[idx + 2] = z;
    this.head = (this.head + 1) % this.maxPoints;
    this.count = Math.min(this.count + 1, this.maxPoints);
  }
  
  // 按时间顺序返回点数组（从旧到新）
  getPoints(): Vector3[] {
    const result: Vector3[] = [];
    const start = this.count < this.maxPoints ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = ((start + i) % this.maxPoints) * this.stride;
      result.push(new Vector3(this.buffer[idx], this.buffer[idx+1], this.buffer[idx+2]));
    }
    return result;
  }
  
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
```

### 1.4 性能预算

| 场景 | 物体数 | 轨迹点数/物体 | 总顶点数 | 内存占用 | 预期 FPS |
|------|--------|---------------|----------|----------|----------|
| 轻量 | 10 | 300 | 3,000 | ~36 KB | 60+ |
| 中等 | 50 | 300 | 15,000 | ~180 KB | 60 |
| 重载 | 100 | 300 | 30,000 | ~360 KB | 55+ |

> 结论：性能开销极小，无需 LOD 或动态降级。

---

## 2. 矢量箭头实现方案

### 2.1 箭头几何选型

| 方案 | 实现 | 优点 | 缺点 | 推荐 |
|------|------|------|------|------|
| **Cone + Cylinder 组合** | THREE.ConeGeometry + CylinderGeometry 组合成箭头 | 纯 Three.js，无依赖，性能好 | 需手动计算旋转/缩放 | **首选** |
| Html 叠加层 | `@react-three/drei` 的 `<Html>` + CSS 箭头 | 样式灵活 | 3D 空间中方向不直观，深度排序问题 | 不推荐 |
| Line + Cone | 线条表示方向，锥体表示箭头 | 简单 | 视觉效果不如完整箭头 | 备选 |
| InstancedMesh | 所有箭头共用几何体，实例化渲染 | 极致性能（一次 draw call） | 实现复杂，需管理 instance matrix | 100+ 箭头时考虑 |

### 2.2 Arrow3D 组件设计

```tsx
import { Cone, Cylinder } from '@react-three/drei';
import { Vector3, Quaternion, Euler } from 'three';

interface Arrow3DProps {
  origin: Vector3;      // 箭头起点
  direction: Vector3;   // 方向向量（会被归一化）
  length: number;       // 箭头总长度
  color: string;        // 颜色
  headSize?: number;    // 箭头头部大小（默认 0.2 * length）
}

function Arrow3D({ origin, direction, length, color, headSize = 0.2 }: Arrow3DProps) {
  const normalizedDir = direction.clone().normalize();
  
  // 计算旋转：使箭头默认朝向（如 Y 轴）旋转到目标方向
  const quaternion = new Quaternion();
  quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normalizedDir);
  
  const shaftLength = length * (1 - headSize);
  const headLength = length * headSize;
  
  return (
    <group position={origin} quaternion={quaternion}>
      {/* 箭杆 */}
      <Cylinder
        args={[0.02, 0.02, shaftLength, 8]}
        position={[0, shaftLength / 2, 0]}
      >
        <meshBasicMaterial color={color} />
      </Cylinder>
      {/* 箭头 */}
      <Cone
        args={[0.06, headLength, 8]}
        position={[0, shaftLength + headLength / 2, 0]}
      >
        <meshBasicMaterial color={color} />
      </Cone>
    </group>
  );
}
```

### 2.3 对数比例缩放

```typescript
function scaleForceToLength(magnitude: number): number {
  const MIN_LENGTH = 0.5;   // 最小显示长度
  const MAX_LENGTH = 5.0;   // 最大显示长度
  const SCALE_FACTOR = 10;  // 对数缩放系数
  
  if (magnitude <= 0) return MIN_LENGTH;
  
  // log10 压缩 + 归一化
  const logValue = Math.log10(1 + magnitude / SCALE_FACTOR);
  const normalized = logValue / Math.log10(1 + 100); // 归一化到 [0, 1]
  
  return MIN_LENGTH + normalized * (MAX_LENGTH - MIN_LENGTH);
}
```

**校准参考值：**

| 力大小 | 对数缩放后长度 | 视觉判断 |
|--------|---------------|----------|
| 1 N | ~0.8 | 可见小箭头 |
| 10 N | ~1.8 | 中等箭头 |
| 100 N | ~3.2 | 明显箭头 |
| 1000 N | ~4.5 | 大箭头 |

### 2.4 力的来源与计算

| 力类型 | 数据来源 | 计算方法 | 方向 |
|--------|----------|----------|------|
| 重力 | `environment.gravity` | `F = m * g` | `gravityDirection` |
| 弹力 | `SpringComponent` | `F = -k * (currentLength - restLength)` | 弹簧方向 |
| 空气阻力 | `environment.dragCoefficient` | `F = -c * v` | 速度反方向 |
| 接触力/摩擦力 | Rapier collision events | `Δmomentum / Δt` 估算 | 碰撞法线 |

**Rapier 碰撞力估算（关键难点）：**

Rapier WASM 不直接提供接触力大小，需通过碰撞事件间接估算：

```typescript
// 方案：碰撞期间动量变化估算
interface CollisionRecord {
  entityId: string;
  startTime: number;
  initialVelocity: Vector3;
  mass: number;
}

const activeCollisions = new Map<string, CollisionRecord>();

// collisionStarted
function onCollisionStart(entityA: string, entityB: string) {
  const body = getRigidBody(entityA);
  activeCollisions.set(`${entityA}-${entityB}`, {
    entityId: entityA,
    startTime: performance.now(),
    initialVelocity: body.linvel(),
    mass: body.mass(),
  });
}

// collisionStopped
function onCollisionStop(entityA: string, entityB: string) {
  const key = `${entityA}-${entityB}`;
  const record = activeCollisions.get(key);
  if (!record) return;
  
  const body = getRigidBody(entityA);
  const finalVelocity = body.linvel();
  const deltaTime = (performance.now() - record.startTime) / 1000;
  
  // F = m * Δv / Δt
  const deltaV = finalVelocity.sub(record.initialVelocity);
  const forceMagnitude = record.mass * deltaV.length() / deltaTime;
  
  // 方向：碰撞法线方向（需从碰撞事件中获取）
  // ...
  
  activeCollisions.delete(key);
}
```

> **注意**：此估算为时间平均值，非瞬时力。对于简谐运动分析够用，但对于精确碰撞动力学不够。考虑添加"接触力估算（近似）"的免责声明。

---

## 3. UI 控制集成

### 3.1 状态扩展

```typescript
// uiSlice.ts 新增
interface VisualizationState {
  showTrails: boolean;           // 全局轨迹开关
  showVelocityVectors: boolean;  // 速度矢量开关
  showForceVectors: boolean;     // 受力矢量开关
  vectorDisplayMode: 'all' | 'selected'; // 显示范围
}

// entitySlice.ts / ECS 组件新增
interface TrailComponent {
  type: 'trail';
  visible: boolean;  // 按实体开关
}

interface VectorComponent {
  type: 'vector';
  showVelocity: boolean;
  showForces: boolean;
}
```

### 3.2 Toolbar 按钮布局

```
[Play] [Pause] [Reset] | [Debug] [Environment] | [Trail] [Velocity] [Forces] [Show: All/Selected]
                        ←—— Phase 3 ——→        ←——————— Phase 4 ———————→
```

按钮类型：toggle（激活/非激活状态视觉区分）

---

## 4. 架构集成点

### 4.1 渲染管线挂载

```tsx
// Scene3D.tsx 扩展
function Scene3D() {
  return (
    <Canvas>
      <Physics>
        <RigidBodyRefContext.Provider>
          {/* 实体渲染 */}
          <EntityRenderer />
          <SpringRenderer />
          
          {/* Phase 4: 可视化叠加层 */}
          <TrajectoryRenderer />  {/* 轨迹线 */}
          <VectorRenderer />      {/* 矢量箭头 */}
        </RigidBodyRefContext.Provider>
      </Physics>
    </Canvas>
  );
}
```

### 4.2 关键约束（PITFALLS #6）

- **轨迹采样**必须在 `useFrame` 中完成，使用 `useRef` 存储历史点数组
- **矢量计算**（速度读取、力计算）在 `useFrame` 中实时读取 RigidBody 状态
- **禁止**将每帧物理数据写入 Zustand store
- 仅开关状态变化时更新 store

### 4.3 与其他 Phase 的依赖

| 依赖 | 来源 | 用途 |
|------|------|------|
| `RigidBodyRefContext` | Phase 2 | 获取实体 RigidBody ref，读取位置/速度 |
| `EntityRenderer` 模式 | Phase 2 | `TrajectoryRenderer` / `VectorRenderer` 遵循同模式 |
| `SpringComponent` | Phase 3 | 弹力矢量计算 |
| `environment` slice | Phase 3 | 重力/阻力参数 |
| `Toolbar` 组件 | Phase 2/3 | 新增可视化控制按钮 |
| `PropertyPanel` | Phase 2 | 扩展轨迹/矢量按实体开关 |

---

## 5. 验证架构

### 5.1 关键验证维度

| 维度 | 验证内容 | 方法 |
|------|----------|------|
| 轨迹正确性 | 抛物线运动轨迹为平滑曲线 | 视觉检查 + 截图对比 |
| 矢量方向 | 速度矢量与运动方向一致 | 视觉检查 |
| 对数缩放 | 大小力在视觉上都可区分 | 测试不同质量物体 |
| 性能 | 50 物体 + 全开可视化仍 60fps | FPS 计数器 |
| 开关响应 | 切换开关后 1 帧内生效 | 交互测试 |
| 重置语义 | 重置后轨迹清空 | 功能测试 |

### 5.2 潜在风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Rapier 碰撞事件估算接触力不准确 | 受力矢量可信度下降 | 添加"近似估算"提示；文档说明 |
| 大量箭头导致 draw call 过多 | 帧率下降 | 50+ 物体时考虑 InstancedMesh |
| 轨迹渐变 shader 兼容性问题 | 部分浏览器不显示 | 提供纯色线条 fallback |
| 静止物体轨迹堆积 | 内存泄漏 | 静止 2 秒后自动停止采样 |

---

## RESEARCH COMPLETE

**关键技术决策：**
1. 轨迹：BufferGeometry + 顶点颜色渐变（单 Line，单次 draw call）
2. 箭头：Cone + Cylinder 组合（纯 Three.js，无需额外依赖）
3. 接触力：碰撞事件 + 动量变化估算（近似方案，文档说明限制）
4. 性能：预期 50 物体场景 60fps，100 物体略降但仍流畅
