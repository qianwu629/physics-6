# Pitfalls Research — 物理模拟平台

**Domain:** Web-based 组件化物理模拟平台（经典力学）
**Researched:** 2026-04-30
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: 可变时间步长物理积分（Variable Timestep Physics）

**What goes wrong:**
将渲染帧的时间差（`requestAnimationFrame` 的 `deltaTime`）直接传给 `world.step(deltaTime)` 会导致：不同硬件上产生完全不同的模拟结果（60Hz 显示器 vs 144Hz vs 移动端 30Hz）；帧率下降时能量漂移加剧，物体"爆炸"或穿透墙体的"死亡螺旋"。

**Why it happens:**
物理积分器（即使是半隐式欧拉）的误差与步长成正比。开发者倾向于"把 deltaTime 传进去让引擎自己算"——这是物理模拟中最常见的初学者错误。

**How to avoid:**
采用 **Gaffer on Games 固定时间步长累加器模式**：

```
accumulator += frameDeltaTime;
const FIXED_DT = 1/60;           // 16.67ms 固定步长
const MAX_STEPS = 5;             // 防止死亡螺旋
const MAX_FRAME_DELTA = 0.1;     // 防止切标签页灾难

while (accumulator >= FIXED_DT && stepCount < MAX_STEPS) {
    physicsWorld.step(FIXED_DT);
    accumulator -= FIXED_DT;
    stepCount++;
}
// 防止累积溢出
if (accumulator >= FIXED_DT) accumulator = 0;

// 用 alpha 插值渲染状态，保证画面流畅
alpha = accumulator / FIXED_DT;
renderState = lerp(prevState, currState, alpha);
```

关键点：
- **永远不要**把 `deltaTime` 传给 `world.step()`
- 限制最大步数（`MAX_STEPS = 5`）防止死亡螺旋
- 限制最大帧间隔（`maxDelta = 100ms`）防止切标签页后物体飞走
- 使用 `visibilitychange` 事件暂停/恢复模拟

**Warning signs:**
- 同一场景在不同设备上行为不一致
- 切标签页回来后物体瞬移到远处
- 快/慢机器上有肉眼可见的速度差异
- 复杂场景（多物体碰撞）帧率越来越低

**Phase to address:**
Phase 1（核心物理引擎集成）——时间步长模式是整个系统的基础，选错了就是重写。

**Sources:**
- [Gaffer on Games: Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) — 行业标准参考（HIGH confidence）
- [Planck.js Limitations](https://app.unpkg.com/planck@1.4.2/files/docs/pages/limitations.md) — 官方文档确认（HIGH confidence）
- [Three.js Forum: Cannon world.step and delta time](https://discourse.threejs.org/t/cannon-world-step-and-delta-time/88027) — 社区实际案例（MEDIUM confidence）

---

### Pitfall 2: 组件粒度过细 + 热路径中的 GetComponent

**What goes wrong:**
将物理数据拆分成微组件（`PositionComponent`、`VelocityComponent`、`AccelerationComponent` 各一个），然后在每帧更新循环中调用 `GetComponent<T>()` 查找依赖。结果：查找开销是遍历逻辑的几十倍；隐性耦合（系统 B 依赖系统 A 内部的组件类型，API 上却看不出来）；多线程环境下脆弱。

**Why it happens:**
ECS 教程常以"把一切拆成组件"作为最佳实践，但没强调**共同使用的数据应该放在同一个组件中**。此外，运行时组件查找看起来"灵活"，实际上每次都是 hash 表查询。

**How to avoid:**
- **同一 ECS 实体上、同一系统使用的相关物理数据放在一个组件中**（如 `RigidBodyComponent { position, velocity, angularVelocity, mass }`）。
- 组件依赖在**实体创建时注入**，不在每帧查找：
  ```typescript
  // 创建时
  const physicsRef = entity.addComponent(new RigidBodyComponent(...));
  const renderRef = entity.addComponent(new MeshComponent(mesh, physicsRef));
  
  // 渲染系统直接使用固定引用
  class RenderSystem {
      update() {
          for (const entity of this.entities) {
              const mesh = entity.get(MeshComponent);
              mesh.updateFromPhysics(); // 内部使用预先注入的引用
          }
      }
  }
  ```
- 物理引擎内部的 entity handle（如 Rapier.js 的 `RigidBodyHandle`）本身就是最优的"组件引用"——不要在其上再套一层 GetComponent 查找。

**Warning signs:**
- 添加一个新组件类型后，表面上无关的系统开始静默失败
- 渲染帧中有大量 `Map<id, Component>.get()` 调用
- 修改一个组件需要同时修改 5+ 个系统文件（真正的耦合信号）

**Phase to address:**
Phase 2（组件系统 + 场景组装）——组件粒度设计应在搭建场景搭建框架时确定。

**Sources:**
- [Usagi Component Best Practices](https://github.com/vitei/Usagi/wiki/Component-Best-Practices/) — 游戏引擎团队内部规范（MEDIUM confidence）
- [Excalibur Engine: ColliderComponent 隐式耦合问题](https://blog.gitcode.com/a5d6290e7d6acedee13ea1a84fbf5996.html) — 真实案例分析（MEDIUM confidence）
- [StackOverflow: De-coupling Physics from Render System](https://browse.library.kiwix.org/content/stackoverflow.com_en_all_nopic_2022-07/questions/27640270/) — 社区共识（MEDIUM confidence）

---

### Pitfall 3: 物理状态与 3D 渲染差一帧（Frame Lag）

**What goes wrong:**
物理引擎更新了物体位置，但 `InstancedMesh.setMatrixAt()` 在物理步进之前执行，导致渲染滞后物理一帧。或者反过来，先渲染再步进物理，用户看到的是上一帧的位置。视觉上表现为物体"追着自己跑"或轻微抖动。

**Why it happens:**
Three.js 的 `InstancedMesh` 矩阵更新、物理引擎的 `world.step()`、渲染器的 `renderer.render()` 之间存在隐式执行顺序依赖。没有显式的管线编排逻辑。

**How to avoid:**
严格执行管线顺序：

```
requestAnimationFrame 回调:
  1. 物理步进 (world.step)
  2. 同步矩阵 (InstancedMesh.setMatrixAt)
  3. 渲染 (renderer.render)
  
  注意：2 必须在 1 之后、3 之前。
```

具体实现方案：
```typescript
function gameLoop() {
    // Step 1: Physics
    physicsWorld.step(FIXED_DT);
    
    // Step 2: Sync transforms (AFTER physics, BEFORE render)
    for (let i = 0; i < bodies.length; i++) {
        const pos = bodies[i].translation();
        const rot = bodies[i].rotation();
        tempMatrix.compose(pos, rot, scale);
        instancedMesh.setMatrixAt(i, tempMatrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    
    // Step 3: Render (last)
    renderer.render(scene, camera);
}
```

**Warning signs:**
- 快速移动的物体看起来有"拖影"或"重影"
- 碰撞瞬间的反弹位置与视觉位置不一致
- 帧率波动时抖动加剧

**Phase to address:**
Phase 1（核心渲染集成）——渲染管线的执行顺序是最基础的架构决策。

**Sources:**
- [instanced-mesh GitHub Issue #18: Instanced Mesh lags a frame behind](https://github.com/diarmidmackenzie/instanced-mesh/issues/18) — 问题根源分析（MEDIUM confidence）
- [Rapier.js DeepWiki: Graphics and Rendering](https://deepwiki.com/dimforge/rapier.js/6.2-graphics-and-rendering) — 官方集成模式（HIGH confidence）

---

### Pitfall 4: 每帧创建对象导致 GC 抖动

**What goes wrong:**
物理模拟循环中创建了碰撞信息对象、临时向量、接触点数组。JavaScript 引擎的垃圾回收器每隔几秒触发一次停顿（50-200ms），导致模拟画面周期性卡顿。

**Why it happens:**
物理引擎必须创建碰撞 manifold、接触点等数据结构。如果把这些对象直接暴露给 JS 层（而非复用），每帧会产生数千个临时对象。这在浏览器端尤其严重——V8 没有像游戏主机那样的可控 GC。

**How to avoid:**

（a）**对象池化（Object Pooling）**：碰撞数据、向量、矩阵全部池化复用。

（b）**SoA（Structure of Arrays）布局**：使用预分配的 `Float32Array` 而非 `class Body` 实例数组：
```
// 避免：每个物体是一个对象
class Body { x; y; vx; vy; mass; ... }
bodies = [new Body(), new Body(), ...];

// 推荐：使用 TypedArray 列式存储
const posX = new Float32Array(MAX_BODIES);
const posY = new Float32Array(MAX_BODIES);
const velX = new Float32Array(MAX_BODIES);
const mass = new Float32Array(MAX_BODIES);
```
SoA 的优势：缓存友好（连续内存访问）、零 GC 压力（数组是静态的）、SIMD 自动向量化潜力。

（c）**如果使用 Rapier.js**：物理数据在 WASM 堆中，JS 层只拿 handle 和同步后的快照。确保不要在 JS 侧创建临时数组/对象来接收每帧的快照——预分配缓冲区。

（d）**Three.js 侧**：`Matrix4`、`Vector3`、`Quaternion` 等对象使用 `.set()` 修改而非 `new` 创建。使用 `tempMatrix.copy()` 而非 `new Matrix4().copy()`。

**Warning signs:**
- Chrome DevTools Performance 面板中出现周期性 50-200ms 的"GC"标记
- 帧率呈锯齿状（60fps → 10fps → 60fps → 10fps）
- 物体数量从 10 增加到 100 后帧率非线性下降

**Phase to address:**
Phase 1（核心集成）+ Phase 3（性能优化阶段）——初期可以不追求极致优化，但架构应预留池化/SoA 接口。

**Sources:**
- [SourceForge: gdalgorithms list — OOOE and FP determinism](https://sourceforge.net/p/gdalgorithms/mailman/gdalgorithms-list/thread/44C0977C.8020104%40mindcontrol.org/) — 行业最佳实践（MEDIUM confidence）
- Three.js Performance 社区共识：避免在 render loop 中 `new` 对象（HIGH confidence，广泛验证）

---

### Pitfall 5: WASM 引擎在移动端的兼容性灾难

**What goes wrong:**
选用了 WASM 物理引擎（如 Rapier.js），在桌面端完美运行，一上移动端就崩溃。原因：
- Android Chrome 运行在 32 位模式，WASM 堆上限 ~256-640MB
- iOS Safari 的 Jetsam 机制在内存超限时直接杀掉页面
- 移动端 `WebAssembly.Memory()` 分配经常失败

**Why it happens:**
开发者只在桌面 Chrome 上测试，没有意识到移动浏览器是 32 位进程且内存限制严苛。WASM 生态的"一次编译到处运行"口号忽略了平台间的内存和进程模型差异。

**How to avoid:**

（a）**引擎选型时测试移动端**：在真实 iOS Safari 和 Android Chrome 设备上验证，不要只用桌面模拟器。

（b）**WASM 内存策略**：
- 使用更大的 `initial` 内存而非依赖 `grow()`（`initial` 是预留地址空间，实际物理内存按需分配）
- 限制 `WASM_MEM_MAX` 为 128-256MB（移动端安全值）
- 实现内存探测循环：从最大尝试到最小，找到可分配的最大值

（c）**函数计数控制**：使用 `wasm-opt --metrics` 检查 WASM 模块的导出函数数量。iOS 18.4 存在已知 bug——超过 10 万个内部函数会导致编译期崩溃。Rapier.js 的多功能构建可能触发此限制。

（d）**降级方案**：检测移动端时使用纯 JS 物理引擎（如 Planck.js 用于 2D，或纯 JS 简化引擎）。WASM SIMD 在某些移动浏览器上也不可用。

（e）**Web Worker 数量**：移动端 Safari 限制硬件并发数不可靠，实际可用 Worker 应限制在 4 个以内（非桌面端的 `navigator.hardwareConcurrency`）。

**Warning signs:**
- 桌面 Chrome 正常，真机 Safari 白屏或刷新
- Android Chrome 抛出 `WebAssembly.Memory(): cannot allocate memory`
- iOS 18.4+ 上 Unity WebGL 游戏崩溃（已知 WebKit 回归 bug）

**Phase to address:**
Phase 1（物理引擎选型）——选引擎时就必须做移动端可行性验证。不宜在后期才"处理兼容性"。

**Sources:**
- [Chromium Issue #40747423: Chrome unable to grow WebAssembly Memory on Android](https://issues.chromium.org/issues/40747423) — 浏览器 bug 追踪（HIGH confidence）
- [WebKit Bug #291677: Memory Exceedance and Page Reload During WASM Compilation](https://wiki.webkit.org/show_bug.cgi?id=291677) — iOS 18.4 已知问题（HIGH confidence）
- [Emscripten mailing list: WASM mobile](http://www.mail-archive.com/emscripten-discuss@googlegroups.com/msg10760.html) — 社区实测数据（MEDIUM confidence）

---

### Pitfall 6: Zustand 高频更新触发 React 重渲染风暴

**What goes wrong:**
物理引擎每 16.67ms 产生一帧数据（60fps），直接通过 Zustand 的 `setState` 写入 store。React 组件使用 `useStore(state => state.physicsData)` 订阅，导致每个 React 组件每帧都重新渲染。结果：主线程被 React reconciliation 占满，渲染帧率降到 5-15fps。

**Why it happens:**
Zustand 本身很快（基于发布-订阅），但 React 的 reconciliation 不是为 60fps 状态更新设计的。物理模拟的每一帧都是一个完整的新状态对象——这和"用户点击按钮改变一个值"的更新模式完全不同。

**How to avoid:**

（a）**热路径使用 Transient Updates（旁路 React）**：
```typescript
// 物理帧数据不走 React render cycle
const physicsSnapshotRef = useRef(physicsStore.getState().bodies);

useEffect(() => {
    const unsub = physicsStore.subscribe(
        state => { physicsSnapshotRef.current = state.bodies; }
    );
    return unsub;
}, []);

// 直接在 rAF 中读取 ref，更新 Three.js mesh，不触发 React 渲染
function renderLoop() {
    const bodies = physicsSnapshotRef.current;
    for (let i = 0; i < bodies.length; i++) {
        instancedMesh.setMatrixAt(i, bodies[i].matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
}
```

（b）**批量化 + 降频写入**：物理数据写到 Zustand 的速率降低到 15-30fps（仅当 UI 需要反映状态变化时）：
```typescript
// 物理循环中不直接 setState
let uiSyncTimer = 0;
function physicsTick(dt) {
    world.step(dt);
    uiSyncTimer += dt;
    if (uiSyncTimer >= 1/30) { // 降到 30fps
        store.setState({ simulationTime: world.time });
        uiSyncTimer = 0;
    }
}
```

（c）**Persist 中间件陷阱**：`zustand/persist` 在每次 `setState` 时调用 `JSON.stringify`。对于物理快照数据，这会阻塞主线程。使用 `partialize` 排除高频变化字段，或手动异步写入 IndexedDB。

（d）**选择器粒度**：每个订阅物理帧数据的组件必须使用精确选择器，且用 `useShallow` 避免引用变化导致的重渲染：
```typescript
import { useShallow } from 'zustand/react/shallow';

// 避免
const data = useStore(state => state);
// 推荐
const { simulationTime, isRunning } = useStore(
    useShallow(s => ({ simulationTime: s.simulationTime, isRunning: s.isRunning }))
);
```

**Warning signs:**
- React DevTools Profiler 显示每帧有大量组件重新渲染
- 帧率低于预期的 60fps，但 GPU 占用不高（瓶颈在 CPU/React）
- `console.log` 插入组件看到每秒打印 60 次——说明在不必要地重渲染

**Phase to address:**
Phase 3（UI/交互层）——当状态管理开始连接物理引擎和 React 组件时。初期直接在 rAF 中操作 Three.js 可以绕过此问题。

**Sources:**
- [Zustand Discussion #2642: causing more rerenders than expected](https://github.com/pmndrs/zustand/discussions/2642) — 官方讨论（HIGH confidence）
- [Zustand Discussion #2275: How to batch multiple store updates](https://github.com/pmndrs/zustand/discussions/2275) — 维护者推荐方案（HIGH confidence）

---

### Pitfall 7: 浮动点数跨浏览器非确定性

**What goes wrong:**
同一场景、同一初始条件，在 Chrome 和 Safari 上产生不同的模拟结果。开发者试图做"回放"功能时，回放结果与原模拟分叉。高精度需求场景（如精确碰撞弹道）在不同浏览器上偏差显著。

**Why it happens:**
- 不同 JS 引擎的 `Math.sin`/`Math.cos`/`Math.sqrt` 实现存在微小差异
- 不同 CPU 架构的 FMA（Fused Multiply-Add）指令行为不同
- 编译器浮点优化级别差异
- WASM 引擎之间也有类似的浮点差异

Box2D 作者 Erin Catto 确认："对于同一输入和同一 JS 运行时，Box2D/Planck.js 会重现模拟。但跨平台/跨二进制文件的完全相同结果？答案是**否**。"

**How to avoid:**

（a）**接受同运行时确定性**：只承诺同一浏览器同一版本内可重现，这是 pragmatic 的 web 平台策略。大多数教育模拟不需要跨浏览器精确回放。

（b）**如果必须跨平台确定性**（如用于分数判定/竞赛）：
- 使用 Rapier.js 的固定点数构建（`fixed-point` feature）——用整数替代浮点
- 或用纯 JS 实现定点数物理——性能开销大，不适合实时

（c）**回放方案**：记录初始状态 + 用户输入序列，在客户端本地引擎上重放（不传输每帧状态），接受"不同浏览器重放结果略有差异"。

（d）**不要承诺**："所有浏览器上完全一致的物理结果"——这在工程上不可行，应在产品描述中如实说明。

**Warning signs:**
- 自动化测试在同一台机器上通过，CI（不同 OS/浏览器）上失败
- Q&A 报告"同一个场景，同事的机器上结果不一样"
- 回放功能在开发者机器上完美，用户报告偏差

**Phase to address:**
Phase 1（引擎选型）——评估引擎是否提供确定性保证，确认是否匹配需求。回放功能在 Phase 4+。

**Sources:**
- [Box2D Blog: Determinism (Erin Catto, 2024)](https://box2d.org/posts/2024/08/determinism/) — 物理引擎作者的一手分析（HIGH confidence）
- [Rapier.js DeepWiki: Core Physics Engine](https://deepwiki.com/dimforge/rapier.js/2-core-physics-engine) — 固定点数支持确认（HIGH confidence）

---

### Pitfall 8: 坐标系/单位制不匹配

**What goes wrong:**
物理引擎用 SI 单位（米、千克、秒），3D 场景用无名单位（1 unit = 1 像素/任意），相机参数按"看起来对"调整。结果：物体在物理上计算正确但视觉上"太大/太小/太快/太慢"；缩放时相机 clipping 混乱；不同来源的模型比例不一致。

**Why it happens:**
物理引擎和 3D 渲染引擎是两个独立的世界，没有统一的单位约定。开发者通常从"让球看起来像球"开始调整，缺少系统性。

**How to avoid:**

（a）**建立全局单位约定**：定义 1 unit = 1 meter（最无争议的选择，与大多数物理引擎一致）。所有模型导入时归一化到此单位。

（b）**物理-渲染同步的坐标系映射**：
```typescript
// 定义变换常量（一般直接 1:1）
const PHYSICS_TO_RENDER_SCALE = 1; // 1 meter = 1 Three.js unit

function physicsToRender(pos: Vec3): Vector3 {
    return new Vector3(
        pos.x * PHYSICS_TO_RENDER_SCALE,
        pos.y * PHYSICS_TO_RENDER_SCALE,
        pos.z * PHYSICS_TO_RENDER_SCALE
    );
}
```

（c）**相机参数基于物理世界设置**：
```typescript
// 相机 near/far 基于物理世界的尺寸设定
// 如果场景是 10m × 10m 的桌面
camera = new PerspectiveCamera(45, aspect, 0.01, 100); // near=1cm, far=100m

// 对于 1000m 范围的大场景
camera = new PerspectiveCamera(45, aspect, 0.1, 5000); // near 不能太小，否则 z-fighting
```

（d）**OrbitControls 绑定到物理尺度**：
```typescript
controls.minDistance = 0.1;  // 10cm
controls.maxDistance = 50;   // 50m
controls.target.set(0, 1, 0); // 眼睛高度 1m
```

（e）**大世界原点重定位**：如果场景范围超过 ±5000 units，float32 精度开始不足（物体抖动）。周期性重定位世界原点，保持相机附近物体在精度范围内。

**Warning signs:**
- `controls.minDistance` 在某个缩放级别"卡住"
- 物体接近相机时被裁剪（clipping）或远离时消失
- 模型导入后"巨大无比"或"小到看不见"
- OrbitControls 的平移速度在不同缩放级别差异巨大

**Phase to address:**
Phase 1（渲染集成）——在搭建第一个 3D 场景时就定义单位约定。后期统一成本很高。

**Sources:**
- [Three.js Discourse: OrbitControls zooming limits](https://discourse.threejs.org/t/why-my-scene-can-not-showed-fully-after-wheel-scale-and-drag-who-can-help-me/64766/) — 社区实际案例（MEDIUM confidence）
- [Three.js Issue #28714: WebXRManager.updateCamera regression](https://github.com/mrdoob/three.js/issues/28714) — 大世界缩放 bug（MEDIUM confidence）

---

### Pitfall 9: 测试数据/用户数据比例悬殊

**What goes wrong:**
开发时用 2-3 个物体测试，性能完美。用户搭建了 50 个物体 + 弹簧 + 约束 + 碰撞检测的场景后，帧率降到个位数。约束求解是 O(n^2) 或更差的最坏情况。

**Why it happens:**
物理引擎的约束求解器（Sequential Impulses）每次迭代需要遍历所有接触点 × 所有约束。物体越多，接触越多，收敛越慢。Stack overflow 的经典问题："为什么我的游戏在加了 100 个盒子后帧率暴跌？"

**How to avoid:**

（a）**设定明确的系统容量上限**：在 UI 中限制最大物体数、最大约束数（如"最多 100 个物体"）。比让用户搭出 500 个物体后崩溃体验好得多。

（b）**性能分级策略**：
- < 20 个物体：全精度约束求解（10 次迭代）
- 20-50 个物体：降低迭代次数（5 次迭代）
- 50-100 个物体：关闭某些约束类型、简化碰撞检测
- > 100 个物体：提示用户简化场景

（c）**WASM 与 JS 的权衡**：Rapier.js（WASM）在大量物体时比纯 JS 引擎有数量级优势——但不是免费的，需要权衡移动端兼容性和加载时间。

（d）**性能基准测试**：在 Phase 1 就建立基准测试——100 个球体自由落体碰撞应该保持 >30fps。

**Warning signs:**
- 物体数量非线性导致帧率下降（10→20 个物体帧率减半但 GPU 没满）
- 接触点数量快速增长的场景（紧密堆积、多米诺骨牌）
- 质量比 >10:1 的堆叠场景——Planck.js 文档特别警告此类场景不稳定

**Phase to address:**
Phase 1（基准测试）+ Phase 4（性能调优）——早期建立基准，后期针对性优化。

**Sources:**
- [Planck.js Limitations (official)](https://app.unpkg.com/planck@1.4.2/files/docs/pages/limitations.md) — 堆叠稳定性警告（HIGH confidence）
- [Box2D Blog: Determinism (includes performance notes)](https://box2d.org/posts/2024/08/determinism/) — 引擎作者经验（HIGH confidence）

---

### Pitfall 10: "先做功能，后加 3D"的开发顺序陷阱

**What goes wrong:**
先实现完整的 2D 物理模拟（物理引擎 + 逻辑层），然后"加一个 3D 视图"。结果：物理引擎的选择限制了 3D 能力（选了 2D 引擎后期要换 3D 引擎），状态管理需要重构以适配 3D 变换格式，数据流有两条不同路径。

**Why it happens:**
迭代式开发思维——"先把核心逻辑跑通，可视化后面再说"。但在物理模拟平台中，可视化是核心价值而非可选附加品。后期"加 3D"本质上是架构重构。

**How to avoid:**

（a）**Day 1 就确定 3D 物理引擎**（Rapier.js 同时有 2D 和 3D）——不要选纯 2D 引擎（Planck.js/Box2D）然后后期迁移。

（b）**数据模型从第一天就支持 3D**：即使初期场景是 2D（z=0 平面），状态结构中使用 `{x, y, z}` 和四元数旋转而非 `{x, y}` 和角度。

（c）**渲染不可推迟**：第一个可运行的 demo 就应该有 3D 视图，哪怕只是球体和方块在重力下掉落。

**Warning signs:**
- 物理引擎文档的 API 只有 `Vec2`，没有 `Vec3`
- store 中的 position 类型是 `{x: number, y: number}` 而非 `{x, y, z}`
- 有人在 PR 评论中问"怎么加 z 轴"——架构不支持

**Phase to address:**
Phase 1 第一天——这不是可以在后期加的功能。

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 纯 JS 物理引擎（Planck.js 2D） | 零 WASM 加载时间，移动端绝对兼容 | 后期需 3D 物理时必须完全替换引擎 | 仅当确定项目永远只需要 2D 物理 |
| 跳过固定时间步长，直接传 `deltaTime` | 少写 20 行代码 | 全平台行为不一致，无法复现 bug | 永远不会（初学者可以理解，但产品代码不可接受） |
| 将模拟状态全部存 Zustand 并每帧 `setState` | 调试方便，状态可追溯 | React 重渲染风暴，fps < 10 | 仅用于 UI 状态（非物理帧数据） |
| 复用 `Mesh` 对象而非 `InstancedMesh` | 代码简单，每个物体独立操控 | 100+ 物体时 draw call 爆炸 | 物体数 <10 时临时可用，但应尽快迁移 |
| 硬编码物理参数（重力、摩擦系数等） | 少写配置系统 | 无法支持不同环境/场景的切换 | 初期原型阶段，但架构应预留配置接口 |
| 使用 `JSON.stringify` 持久化 Zustand | 一行代码实现持久化 | 高频更新下主线程阻塞 50-200ms | 仅持久化低频变化的 UI 设置，排除物理快照 |
| 碰撞回调中修改物理世界状态 | 逻辑直观 | 解算器内部状态不一致，不可预测的崩溃 | 永远不要——将修改推迟到 `step()` 完成后 |

---

## Integration Gotchas

Common mistakes when connecting to external services and libraries.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Rapier.js WASM** | 在 `new World()` 之前未调用 `Rapier.init()` | 确保 `await Rapier.init()` 在所有 API 调用前完成（WASM 异步加载） |
| **Three.js InstancedMesh** | `setMatrixAt` 后忘记 `instanceMatrix.needsUpdate = true` | 在渲染前设置此标志；并用 `frustumCulled = false` 或手动更新包围球 |
| **WebSocket 实时数据** | WebSocket 消息到达后在回调中直接 `setState` | 使用消息队列缓冲 + 定时批量写入 Zustand（降频到 15-30fps） |
| **OrbitControls** | 组件销毁时不移除事件监听，导致内存泄漏 | 在 React `useEffect` cleanup 或组件 `dispose()` 中调用 `controls.dispose()` |
| **WASM Memory (移动端)** | 假设桌面和移动端可用内存相同 | 实现内存探测循环，设定 `WASM_MEM_MAX=256MB` |
| **Three.js Shader 首帧编译** | 用户看到的第一个画面卡顿 500ms-2s | 场景加载后用 `frustumCulled=false` + 一次预渲染预热所有 shader |
| **@dimforge/rapier3d-compat** | `free()` 调用遗漏导致 WASM 内存泄漏 | 每个 `RigidBody`、`Collider`、`Joint` 移除时必须调用 `world.removeRigidBody()` 释放 WASM 侧资源 |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **每个物体一个 `THREE.Mesh`** | 帧率从 60 降到 15（物体 50+） | 使用 `InstancedMesh` 按形状分组批处理 | 物体 >10-20 时明显 |
| **`InstancedMesh` 不排序** | 透明物体渲染错误，overdraw 严重 | 使用 `BatchedMesh`（支持排序）或 `@three.ez/instanced-mesh` | 有半透明物体时 |
| **视锥剔除未更新** | InstancedMesh 在相机移动时整批消失 | 每次矩阵更新后调用 `computeBoundingSphere()` 或设置 `frustumCulled = false` | 相机旋转/缩放时 |
| **约束求解器迭代数固定不变** | 复杂场景（多关节、紧密接触）帧率暴跌 | 根据物体数和接触点数动态调整迭代次数（5-20 次） | 物体 >30 或复杂约束链 |
| **OrbitControls `enableDamping=true` + 复杂场景** | 停止拖拽后仍因阻尼消耗帧渲染预算 | 在无交互时暂停 `controls.update()` 调用 | 场景渲染耗时接近 16.67ms 时 |
| **质量比 >10:1 的堆叠** | 轻物体被重物体"压碎"或飞出去 | 物理引擎限制：Planck.js 官方文档明确此为已知限制 | 堆叠 3+ 层且质量差 >10 倍时 |
| **首帧加载所有 shader** | 首次打开白屏 1-3 秒 | 预渲染预热 + 使用 `KHR_materials_unlit` 减少 shader 变体 | 首次打开页面时 |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **用户场景 JSON 直接传给物理引擎构造器** | 恶意 JSON 构造超大场景（10000 个物体），耗尽浏览器内存导致 crash | 服务端验证场景参数：最大物体数、最大尺寸、禁止无限循环约束 |
| **WASM 模块无 SRI hash** | CDN 投毒：恶意的 rapier WASM 文件可执行任意指令 | HTML `<script>` 或 fetch 时添加 `integrity` 属性 |
| **WebSocket 无消息大小限制** | 超大 payload（模拟精度极高的 1000 帧历史）压垮客户端 | 服务端限制单条消息最大 64KB，分页传输历史数据 |
| **`SharedArrayBuffer` 未设置 COOP/COEP 头** | SAB 静默不可用，WASM 多线程回退到单线程，性能暴跌 | 配置 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp` |
| **用户上传自定义模型无校验** | 恶意 .glb 文件包含超大纹理或无限递归节点层次 | 上传限制文件大小（<5MB），服务端用 gltf-validator 校验 |

---

## UX Pitfalls

Common user experience mistakes in educational physics simulation.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **"空白画布"恐惧**——无引导的纯白场景 | 学生不知道从哪开始，放弃使用 | 提供 2-3 个预构建示例场景（不是模板！是学习起点），可以一键加载然后自由修改 |
| **模拟结果与直觉冲突时无解释** | 学生看到"反直觉"的结果，认为软件是"坏的"（diSessa 1982: "broken computer" 现象） | 当检测到极端值/异常行为时，显示提示信息解释物理原理（如"注意：此处摩擦力已被简化"） |
| **无速度/轨迹可视化** | 物体运动过程不可见——只看到起点和终点 | 提供矢量显示（速度箭头）、轨迹线（拖尾）、能量图等可视化辅助工具 |
| **2D 截面在 3D 中容易混淆** | 球体和圆柱体在 2D 截面中看起来相同（一个圆），但物理行为不同（滚动 vs 滑动） | 使用透视视角 + 轻微俯视角度，用不同颜色/纹理区分几何类型，始终保持 3D 感 |
| **缩放/旋转后迷失方向** | 学生旋转视角后找不到场景中的物体 | （a）双击物体自动聚焦 （b）提供"重置视角"按钮 （c）始终显示世界坐标轴指示器 |
| **精度过高的数值输入** | 要求输入"45.000°"，但实际上 45° 就够了 | 输入验证时只要求合理精度（角度到 0.1°，质量到 0.01kg），其余自动四舍五入 |
| **无访问性支持** | 视障/运动障碍学生无法使用 | Phase 3+ 考虑键盘导航、屏幕阅读器 ARIA 标签、替代输入方式 |
| **学习目标不明确** | 学生在探索中迷失，不理解关键物理概念 | 提供可选的"引导模式"——渐进式展示参数（先暴露质量，确认理解后再暴露摩擦系数） |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **固定时间步长**: 表面看 `world.step()` 在调用——验证是否传入固定值；验证是否有 MAX_STEPS 上限；验证是否有 tab-out 保护。
- [ ] **3D 渲染**: 表面看物体在移动——验证 InstancedMesh 矩阵更新在物理步进之后；验证多浏览器 60fps；验证移动端不掉帧。
- [ ] **OrbitControls**: 表面看可以旋转缩放——验证 `controls.dispose()` 在组件卸载时调用；验证 `minDistance`/`maxDistance` 不会卡住；验证 `screenSpacePanning` 行为符合预期。
- [ ] **WASM 加载**: 表面看桌面端正常——在真机 iOS Safari 和 Android Chrome 上验证；验证 3G 网络下的加载时间；验证 COOP/COEP 头配置。
- [ ] **Zustand Store**: 表面看数据可读写——验证高频更新路径使用了 `subscribe()` 而非 `useStore()`；验证 persist 排除了高频字段。
- [ ] **场景保存/加载**: 表面看 JSON 可以序列化——验证包含约束的场景可正确反序列化；验证 WASM handle 引用在加载后重新建立。
- [ ] **性能**: 表面看 5 个物体时 60fps——用 100 个物体、10 个约束的场景做压力测试；用 Chrome DevTools Performance 检查 GC 停顿。
- [ ] **碰撞检测**: 表面看球碰球正常——测试高速运动（隧道效应）、边-边碰撞、多体同时碰撞（3+ 物体同一帧接触）。
- [ ] **错误恢复**: 表面看正常路径没问题——测试 WASM 初始化失败、WebSocket 断连、标签页切回后的恢复能力。

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 可变时间步长 | MEDIUM | 重构主循环为累加器模式；修改 `world.step()` 调用点；添加时间保护逻辑。预计 1-3 天。 |
| 组件粒度过细 | HIGH | 重新设计组件数据结构；合并微组件；修改所有系统以使用新组件。预计 3-7 天。 |
| 物理-渲染帧差一帧 | LOW | 调整循环中物理/矩阵/渲染的执行顺序。预计 1-4 小时。 |
| Zustand 重渲染风暴 | MEDIUM | 识别高频路径改用 `subscribe()` + ref；添加 `useShallow`；局部重构——不影响物理逻辑。预计 1-2 天。 |
| WASM 移动端崩溃 | HIGH | 调研纯 JS 降级方案；实现双引擎切换；重新测试。预计 1-2 周。 |
| 选了 2D 物理引擎后期需 3D | HIGH | 完全替换物理引擎，重写所有物理相关代码。预计 2-4 周。 |
| GC 抖动 | MEDIUM | 实现对象池化；改用 SoA 布局；这是一个渐进式重构。预计 3-5 天。 |
| 坐标系混乱 | HIGH | 建立全局单位约定；批量转换所有模型和参数；统一相机配置。预计 3-7 天。 |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 可变时间步长 | Phase 1 — 核心物理集成 | 在 60Hz/144Hz/30Hz 三种显示器上验证同一场景结果一致 |
| 组件粒度过细 | Phase 2 — 组件系统设计 | Code review：每个系统需要 <3 个组件类型；无循环 GetComponent 调用 |
| 物理-渲染帧差 | Phase 1 — 渲染管线 | 高速运动小球测试：视觉位置与物理碰撞点重合 |
| GC 抖动 | Phase 1 + Phase 3 | Chrome DevTools Memory: 无周期性 GC 停顿 |
| WASM 移动端 | Phase 1 — 引擎选型 | 真机测试：iOS Safari + Android Chrome 上 20 物体 30fps 以上 |
| Zustand 重渲染 | Phase 3 — UI/状态管理 | React DevTools Profiler: 物理运行时非 UI 组件重渲染为 0 |
| 浮动点非确定性 | Phase 1 — 引擎选型 | 确认需求：是否需要跨浏览器确定性？（大概率不需要） |
| 坐标系不匹配 | Phase 1 — 基础 3D 场景 | OrbitControls 缩放范围符合物理世界尺寸 |
| 测试/用户数据比例 | Phase 1 + Phase 4 | 100 物体基准测试 >30fps |
| 3D 推迟陷阱 | Phase 1 — 第一天 | 第一个 demo 就有 3D 视图 |

---

## Sources

- [Gaffer on Games: Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) — 固定时间步长权威参考（HIGH confidence）
- [Box2D Blog: Determinism (Erin Catto, 2024)](https://box2d.org/posts/2024/08/determinism/) — 物理引擎确定性权威分析（HIGH confidence）
- [Planck.js Limitations (official docs)](https://app.unpkg.com/planck@1.4.2/files/docs/pages/limitations.md) — 堆叠/质量比限制（HIGH confidence）
- [Rapier.js DeepWiki: Architecture Overview](https://deepwiki.com/dimforge/rapier.js/1.2-architecture-overview) — Handle 型架构文档（HIGH confidence）
- [Rapier.js DeepWiki: Graphics and Rendering](https://deepwiki.com/dimforge/rapier.js/6.2-graphics-and-rendering) — 官方 3D 渲染集成模式（HIGH confidence）
- [Zustand Discussion #2275: How to batch multiple store updates](https://github.com/pmndrs/zustand/discussions/2275) — 维护者推荐批处理方案（HIGH confidence）
- [Chromium Issue #40747423: WASM Memory on Android](https://issues.chromium.org/issues/40747423) — WASM 移动端内存限制（HIGH confidence）
- [WebKit Bug #291677: Memory Exceedance on iOS 18.4](https://wiki.webkit.org/show_bug.cgi?id=291677) — iOS WASM 编译崩溃（HIGH confidence）
- [Three.js Discourse: OrbitControls zooming limits](https://discourse.threejs.org/t/why-my-scene-can-not-showed-fully-after-wheel-scale-and-drag-who-can-help-me/64766/) — 相机控制常见问题（MEDIUM confidence）
- [instanced-mesh GitHub Issue #18: Frame lag](https://github.com/diarmidmackenzie/instanced-mesh/issues/18) — 物理渲染同步延迟（MEDIUM confidence）
- [Usagi Component Best Practices](https://github.com/vitei/Usagi/wiki/Component-Best-Practices/) — 游戏引擎组件设计规范（MEDIUM confidence）
- [PhET Simulation Design Documentation](https://fluidproject.atlassian.net/wiki/pages/viewpage.action?pageId=11515369) — 教育模拟软件设计规范（MEDIUM confidence）
- [Excalibur Engine: ColliderComponent 耦合问题](https://blog.gitcode.com/a5d6290e7d6acedee13ea1a84fbf5996.html) — 真实架构问题分析（MEDIUM confidence）
- [StackOverflow: De-coupling Physics from Render System](https://browse.library.kiwix.org/content/stackoverflow.com_en_all_nopic_2022-07/questions/27640270/) — 社区架构共识（MEDIUM confidence）
- diSessa (1982) — "Broken computer" phenomenon（学术研究，LOW confidence，二手引用）
- Renken & Nunez (2013) — "Computer simulations and clear observations do not guarantee conceptual understanding"（学术研究，MEDIUM confidence）

---
*Pitfalls research for: Web 组件化物理模拟平台（Physis）*
*Researched: 2026-04-30*
