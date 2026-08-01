# Web 端物理引擎调研报告：力场支持深度分析

**项目**: Physis - Web 端交互物理模拟平台
**调研日期**: 2026/05/24
**调研范围**: Web 端 3D 物理引擎（WASM + JS 原生）
**核心问题**: 是否有比 Rapier3D 更适合的物理引擎，特别是原生支持力场（电场/磁场）的引擎？

---

## Executive Summary（核心结论）

**结论：没有 Web 物理引擎原生支持电磁场。Rapier 仍是当前最佳选择，应在其上构建自定义力场层。**

所有主流 Web 物理引擎（Rapier、Ammo.js/Bullet、Cannon-es、PhysX、Jolt、Havok）的设计目标都是**刚体动力学 + 碰撞检测**，它们的核心架构围绕以下问题构建：
- 刚体运动（位置、速度、加速度）
- 碰撞检测（broadphase/narrowphase）
- 约束求解（关节、接触、摩擦）

**电磁场模拟属于完全不同的物理范式**：
- 需要连续场（vector field）在空间中的分布
- 涉及场-粒子相互作用（Lorentz 力: F = qE + qv x B）
- 需要电荷属性、介质属性等额外物理量
- 场本身需要随时间演化（Maxwell 方程组）

这些需求超出了任何通用刚体物理引擎的设计范围。因此，**力场支持必须通过"物理引擎 + 自定义力场层"的混合方案实现**。

---

## 候选引擎对比表

| 引擎 | 语言 | 体积 | 性能 | R3F 集成 | 每帧注入力 | 力场原生支持 | TS 支持 | 维护状态 | 推荐度 |
|------|------|------|------|----------|------------|--------------|---------|----------|--------|
| **Rapier (当前)** | Rust/WASM | ~1.4MB | 优秀 | 优秀 (`@react-three/rapier`) | `useBeforePhysicsStep` | 无 | 完整 | 活跃 | **首选** |
| Jolt | C++/WASM | ~2MB | 优秀 | 有社区封装 (`react-three-jolt`) | 手动 step 前后 | 无 | 有 | 活跃 | 备选 |
| Havok | C++/WASM | ~2MB | 优秀 | Babylon.js 官方 | 手动 applyForce | 无 | 有 | 活跃 | 备选 |
| Ammo.js | C++/WASM | ~1-2MB | 良好 | 需手动集成 | `stepSimulation` 前手动 | 无 | 差 | 停滞 | 不推荐 |
| PhysX | C++/WASM | ~2MB | 优秀 | 需手动集成 | 手动 applyForce | 无 | 有 | 缓慢 | 不推荐 |
| Cannon-es | JS | ~150KB | 一般 | 有 (`@react-three/cannon`) | `preStep` 回调 | 无 | 完整 | 维护中 | 不推荐 |
| Oimo.js | JS | ~100KB | 一般 | 需手动集成 | 手动 applyForce | 无 | 一般 | 停滞 | 不推荐 |
| Matter.js | JS | ~80KB | 一般 | 需手动集成 | `beforeUpdate` 事件 | 无 (有插件) | 一般 | 维护中 | 仅2D |
| Planck.js | JS | ~120KB | 良好 | 需手动集成 | 手动 applyForce | 无 | 完整 | 维护中 | 仅2D |

### 关键发现

1. **没有任何引擎原生支持电磁场**：所有引擎的力都是瞬时施加的（`applyForce`/`applyImpulse`），没有内置的场概念。

2. **Rapier 的 `useBeforePhysicsStep` 是最优雅的注入点**：这是专门为"每帧物理步进前执行自定义逻辑"设计的 Hook，与 Physis 的需求完美匹配。

3. **Cannon-es 的 `preStep` 回调类似**，但引擎本身性能落后 Rapier 2-5 倍。

4. **Ammo.js/PhysX/Jolt/Havok** 都需要在手动调用 `stepSimulation`/`Update` 前后自行计算并施加力，没有专门的回调机制。

---

## 力场支持深度分析

### 为什么通用物理引擎不原生支持电磁场？

#### 1. 架构层面：设计目标不同

通用物理引擎解决的是**接触力学问题**（contact mechanics）：
```
刚体 A 和刚体 B 碰撞 -> 计算接触点 -> 应用冲量/力 -> 更新速度/位置
```

电磁场解决的是**连续场问题**（continuous field）：
```
空间中每一点都有场强 E(x,y,z,t) 和 B(x,y,z,t)
带电粒子在该点受力 F = qE + qv×B
场本身随时间演化（Maxwell 方程组）
```

这两个问题域的数学结构完全不同：
- 碰撞检测：离散事件驱动（event-driven）
- 场模拟：连续时间演化（time-integration of PDEs）

#### 2. 性能层面：场模拟的计算成本

电磁场模拟的核心挑战：
- **空间离散化**：需要将空间划分为网格（如 FDTD 的 Yee 网格），每帧更新所有网格点的场值
- **O(N^2) 复杂度**：N 个电荷两两相互作用，计算量随粒子数平方增长
- **多物理耦合**：场影响粒子运动，粒子运动又改变场分布

对于高中物理教学场景（几十到几百个物体），在 JS/WASM 中实时求解 Maxwell 方程组是不现实的。

#### 3. 需求层面：游戏/物理引擎 vs 科学计算

| 维度 | 游戏物理引擎 | 科学计算（电磁场） |
|------|-------------|-------------------|
| 目标 | 看起来真实 | 数值精确 |
| 时间步长 | 固定 1/60s | 受 CFL 条件限制 |
| 空间分辨率 | 无（刚体是质点） | 需要网格 |
| 主要算法 | 约束求解器 | PDE 求解器 |
| 典型应用 | 碰撞、堆叠、车辆 | 天线设计、等离子体 |

### 现有力场方案的实现模式

#### 模式 A：每帧手动计算 + applyForce（Physis 当前方案）

```typescript
// 伪代码
useBeforePhysicsStep(() => {
  bodies.forEach(body => {
    const pos = body.translation();
    const vel = body.linvel();
    const charge = getCharge(body);
    
    // 计算电场力
    const E = evaluateElectricField(pos); // 用户表达式
    const F_electric = E.scale(charge);
    
    // 计算磁场力（Lorentz 力）
    const B = evaluateMagneticField(pos); // 用户表达式
    const F_magnetic = vel.cross(B).scale(charge);
    
    // 施加合力
    body.addForce(F_electric.add(F_magnetic), true);
  });
});
```

**优点**：
- 完全灵活，支持任意数学表达式
- 与物理引擎解耦，易于调试
- 计算量可控（O(N) 每帧）

**缺点**：
- 场是"即时计算"的，不随时间演化（准静态近似）
- 多个电荷之间没有相互的场耦合（每个电荷只感受外部场）

#### 模式 B：专门的电磁模拟库（参考实现）

**PhotonLab**（Rust + WASM + WebGL2）：
- 使用 FDTD 方法求解 Maxwell 方程组
- 适用于电磁波传播、天线辐射等场景
- 不处理刚体碰撞，只模拟场
- 与通用物理引擎是互补关系

**maxwell-simulation**（TypeScript + WebGL）：
- 2D 电磁场可视化
- 使用 WebGL shader 加速场计算
- 教育用途，非刚体物理

#### 模式 C：游戏引擎中的力场（参考）

**Unity PhysX / Havok**：
- 支持 `PhysicsEffector2D`（2D 效果器），包括点引力、浮力、磁力等
- 但这些是**简化模型**，不是真正的电磁场模拟
- 例如"磁力"只是按距离衰减的吸引力，不考虑电荷、Lorentz 力

**SceneKit (Apple) SCNPhysicsField**：
- 有 `electric()` 和 `magnetic()` 场类型
- 但文档明确说明："This models the real-world physics effect of magnetic fields on moving, electrically charged bodies, not the behavior of permanent magnets or electromagnets"
- 本质上是在刚体上施加与速度叉乘的力，不是真正的场模拟

---

## 科学计算/物理模拟补充库调研

### 专门的 JS/WASM 电磁场库

| 库 | 技术 | 功能 | 与物理引擎集成 | 适用性 |
|----|------|------|---------------|--------|
| **PhotonLab** | Rust/WASM + WebGL2 | FDTD 求解 Maxwell 方程 | 无（独立） | 电磁波模拟，非刚体 |
| **maxwell-simulation** | TS + WebGL | 2D FDTD | 无 | 教育可视化 |
| **VField** | JS + WebGL | 静电场可视化 | 无 | 静态场线绘制 |
| **Matter-attractors** | JS 插件 | 引力/斥力 | Matter.js 插件 | 2D 简化模型 |

### 关键结论

**不存在一个库能同时提供：
1. 刚体物理（碰撞检测 + 约束求解）
2. 电磁场模拟（Maxwell 方程组求解）
3. Web 端实时 60fps 性能**

这两个领域需要不同的数学工具和算法，强行合并会导致两边都做不好。

---

## 最终推荐

### 推荐方案：保持 Rapier + 增强自定义力场层

**理由**：

1. **Rapier 是当前 Web 端最先进的物理引擎**：
   - 2025 年 SIMD 优化后性能提升 2-5 倍
   - `@react-three/rapier` 与 R3F 集成最成熟
   - `useBeforePhysicsStep` 专为每帧注入力设计
   - TypeScript 支持完整，API 现代化

2. **迁移成本极高，收益极低**：
   - 任何其他引擎都不原生支持电磁场
   - 迁移需要重写所有物理相关代码
   - 性能差异对教学场景（几十物体）不构成瓶颈

3. **力场层应作为独立模块构建**：
   - 与物理引擎解耦，便于测试和扩展
   - 支持表达式求值（已在做）
   - 未来可接入更精确的场计算（如 WebGPU 加速）

### 具体建议

#### 短期（保持现状 + 优化）

```
Rapier3D (WASM)
  + @react-three/rapier (React 集成)
  + 自定义 ForceFieldSystem (每帧计算 + applyForce)
  + 表达式求值引擎 (mathjs 或自定义)
```

**优化点**：
- 使用 Rapier 的 SIMD 版本 (`@dimforge/rapier3d-simd`) 提升性能
- 批量获取刚体状态（减少 WASM-JS 边界穿越）
- Rapier v0.32+ 新增了零分配标量 getter/setter，可显著减少 GC 压力

#### 中期（场计算优化）

```
Rapier3D (WASM)
  + ForceFieldSystem
    - 电场/磁场：用户表达式（即时求值）
    - 引力场：预计算空间哈希加速
    - 方向场：直接向量映射
  + WebGPU Compute Shader（可选）
    - 用于大规模粒子系统的场计算
```

#### 长期（混合方案 - 如需更精确电磁模拟）

```
Rapier3D (刚体物理 + 碰撞)
  + 自定义 FieldSolver（WASM 或 WebGPU）
    - 仅用于需要精确场模拟的场景
    - 与 Rapier 通过 applyForce 耦合
```

### 不推荐迁移的引擎

| 引擎 | 不推荐理由 |
|------|-----------|
| Ammo.js | 维护停滞，API 陈旧，WASM 绑定性能差 |
| Cannon-es | 性能落后 Rapier 2-5 倍，仅适合原型 |
| PhysX WASM | 绑定不成熟，社区小，文档匮乏 |
| Jolt | 有潜力但 R3F 生态不成熟，迁移成本高 |
| Havok | 闭源，与 Babylon.js 绑定深，R3F 支持弱 |

---

## 风险与成本评估

### 保持 Rapier 的风险

| 风险 | 等级 | 说明 | 缓解措施 |
|------|------|------|----------|
| 力场计算性能瓶颈 | 低 | 教学场景物体数 < 100，O(N) 计算无压力 | 使用空间哈希、Web Workers |
| 表达式求值延迟 | 中 | 复杂表达式每帧求值可能耗时 | 预编译表达式、缓存结果 |
| WASM 加载时间 | 低 | Rapier WASM ~1.4MB，现代网络可接受 | 使用 `-compat` 版本内联 |
| 跨平台确定性 | 低 | 教学场景不需要严格确定性 | 如需可用 `-deterministic` 版本 |

### 迁移到其他引擎的风险

| 风险 | 等级 | 说明 |
|------|------|------|
| 重写成本 | 高 | 所有物理相关代码需重写 |
| 生态不成熟 | 高 | R3F 绑定、调试工具、社区支持 |
| 无实际收益 | 高 | 没有任何引擎原生支持电磁场 |
| 性能回归 | 中 | Cannon-es/JS 引擎性能更差 |
| 维护风险 | 中 | Ammo.js/PhysX 社区活跃度低 |

### 成本对比

| 方案 | 开发成本 | 维护成本 | 性能收益 | 功能收益 |
|------|----------|----------|----------|----------|
| **保持 Rapier + 优化力场层** | 低 | 低 | 中（SIMD） | 高（完全控制） |
| 迁移到 Jolt | 高 | 中 | 低 | 无 |
| 迁移到 Havok | 高 | 高 | 低 | 无 |
| 自研物理引擎 | 极高 | 极高 | 不确定 | 不确定 |
| 混合方案（Rapier + FDTD） | 高 | 高 | 低 | 中（精确场模拟） |

---

## 关键判断：为什么没有 Web 物理引擎原生支持电磁场？

### 根本原因

1. **问题域不匹配**：
   - 物理引擎 = 刚体碰撞 + 约束求解
   - 电磁场 = 连续介质 PDE + 粒子-场耦合
   - 两者需要不同的数学框架和算法

2. **性能不可行**：
   - 实时求解 Maxwell 方程组需要空间网格（FDTD/FEM）
   - 3D 网格每帧更新计算量巨大，不适合浏览器环境
   - 刚体物理引擎的 O(N) 或 O(N log N) 复杂度 vs 场模拟的 O(M^3)（M 为网格分辨率）

3. **需求 niche**：
   - 游戏开发（物理引擎主要用户）不需要精确电磁模拟
   - 科学计算用户直接使用专用工具（COMSOL、ANSYS、Meep 等）
   - Web 端教育可视化市场太小，不值得引擎层面支持

4. **架构解耦更优**：
   - 物理引擎提供"力接口"（applyForce）
   - 力场层提供"场计算"
   - 两者通过接口耦合，各自独立演进

### 类比理解

这就像问"为什么 Excel 不原生支持 Photoshop 的图层功能？"——两者都是处理数据，但问题域完全不同。更好的方案是 Excel 提供 API，让插件实现图像处理。

同理，物理引擎提供 `applyForce` API，让应用层实现力场计算，是更合理的架构。

---

## 参考资源

- [Rapier 官方文档](https://rapier.rs/docs/)
- [@react-three/rapier 文档](https://pmndrs.github.io/react-three-rapier/)
- [js-physics-benchmarks](https://github.com/isaac-mason/js-physics-benchmarks)
- [Web Game Dev - Physics](https://www.webgamedev.com/physics)
- [PhotonLab - FDTD WASM](https://github.com/SpaceEngineerSS/PhotonLab)
- [maxwell-simulation](https://github.com/RobinKa/maxwell-simulation)
- [Dimforge 2025 年度回顾](https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/)

---

*报告完成。建议：继续基于 Rapier 构建，将精力投入力场表达式的丰富性和可视化效果的提升，而非物理引擎迁移。*
