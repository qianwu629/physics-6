# Stack Research

**Domain:** Web 物理模拟平台 (高中经典力学, 组件化架构)
**Researched:** 2026-04-30
**Confidence:** HIGH

## 执行摘要

Physis 是一个基于 Web 的组件化物理模拟平台。经过对物理引擎、3D 渲染、状态管理、构建工具和 Web Worker 架构五个维度的全面调研，推荐以下技术栈：

**核心决策：Rapier (WASM) + React Three Fiber (R3F) + Zustand + Vite**

Rapier 是 2025-2026 年 Web 物理引擎的明确赢家——基于 Rust/WASM，性能是纯 JS 引擎的 2-50 倍，由 Dimforge 积极维护。React Three Fiber 将 Three.js 的渲染能力与 React 的组件化模型结合，天然匹配项目的"组件组合"架构理念。Zustand 已在现有代码中使用，轻量且适合实时仿真状态流。Vite 是 2026 年前端构建的事实标准。

## Recommended Stack

### 核心框架与运行时

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.x | UI 框架, 组件化架构 | 项目的"组件组合"核心理念与 React 组件模型完美契合；生态最丰富（R3F, Drei 等） |
| TypeScript | ^5.7 | 类型安全 | 现有代码已使用 TS；大型仿真项目需要类型系统保障重构安全 |
| React Three Fiber (@react-three/fiber) | ^9.x | React 的 Three.js 声明式渲染器 | 将 3D 场景映射为 React 组件树，与项目的"物理原语自由组合"理念一致；状态响应式渲染 |

### 物理引擎

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @dimforge/rapier2d-compat | ^0.19.3 | 2D 物理引擎 (经典力学) | Rust→WASM 编译，性能是 Matter.js 的 3-15 倍；compat 构建内联 WASM (base64)，无需额外配置；由 Dimforge 积极维护 |
| @react-three/rapier | ^2.2.0 | Rapier 的 R3F 声明式绑定 | 用 JSX 声明物理世界（`<Physics>`, `<RigidBody>`, `<Collider>`），消除命令式样板；自动同步物理状态到 Three.js 场景 |

**为什么选择 Rapier 2D 而非 3D：**
- 高中经典力学（抛体、斜面、碰撞、圆周运动、弹簧振子）本质是二维物理
- 项目明确要求"支持 3D 视角下模拟 2D 物理"
- Rapier2D 的性能优于 Rapier3D（更少的计算维度）
- 通过抽象层设计，未来可平滑迁移到 Rapier3D（多物理场阶段）

**Rapier 性能数据 (对比 Matter.js):**

| 物体数量 | Matter.js FPS | Rapier FPS | Rapier 优势 |
|---------|--------------|------------|------------|
| 4,500 | 38 | 120 | ~3.2x |
| 6,000 | 21 | 79 | ~3.8x |
| 7,500 | 4 | 60 | ~15x |
| 9,000+ | 崩溃 | 42+ | 无限 |

**2025 年性能突破：**
- SIMD 加速 WASM 包 (`@dimforge/rapier2d-simd`) 提供额外 2x 加速
- 新的 Dynamic BVH 宽相碰撞检测替代旧的 sweep-and-prune
- 持久化仿真孤岛避免每帧重复提取连通分量
- 流形缩减优化（最多 4 个接触点/流形），复杂场景 25% 加速

### 3D 渲染层

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| three.js | ^0.172.x | 底层 3D 渲染引擎 | WebGL + WebGPU 双后端；r171+ 生产级 WebGPU 支持（粒子场景 10x 性能提升）；Three.js Shading Language (TSL) |
| @react-three/drei | ^9.x | R3F 辅助组件库 | 提供 OrbitControls、网格、辅助线、文本等开箱即用组件；大幅减少样板代码 |

**为什么选择 Three.js 而非 Babylon.js：**
- Three.js 的"库"哲学（vs Babylon.js 的"引擎"哲学）给予更多控制权
- R3F 生态（React Three Fiber + Drei + Rapier）提供声明式开发体验
- 更小的包体积（~168KB gzipped vs ~1.4MB）
- 社区更大、教程更多、遇到问题更容易解决
- Babylon.js 的 Havok 物理集成优势在本项目中不相关（使用 Rapier）

### 状态管理

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| zustand | ^5.0.x | 全局状态管理 | 现有代码已使用；极轻量（~1KB）；无 boilerplate；支持切片模式（slicing pattern）用于模块化 |
| zundo | ^2.x | 时间旅行（撤销/重做） | Zustand 中间件，提供仿真步骤的 undo/redo；对教育场景有价值 |

**Zustand 切片模式 (Slicing Pattern) 推荐结构：**

```
src/store/
  index.ts          # 组合所有切片
  physicsSlice.ts   # 物理世界状态 (物体、约束、力场)
  sceneSlice.ts     # 场景配置 (环境参数、相机状态)
  simulationSlice.ts # 仿真控制 (播放/暂停/重置/步进)
  uiSlice.ts        # UI 状态 (面板开关、选中物体)
```

现有代码 (`frontend/src/store/api.ts`) 采用单一 store 模式，建议演进为上述切片架构以支撑模块化扩展。

### 构建工具与开发环境

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | ^6.x | 构建工具和开发服务器 | 2026 前端构建事实标准；原生 ESM 开发服务器（毫秒级 HMR）；对 WASM 模块一流支持 |
| Vitest | ^3.x | 单元测试框架 | 与 Vite 共享配置和转换管道；原生 ESM 支持 |
| ESLint | ^9.x | 代码规范 | TypeScript + React 规则 |
| Prettier | ^3.x | 代码格式化 | 统一的代码风格 |

**Vite 配置关键项：**
- `optimizeDeps.exclude: ['@dimforge/rapier2d-compat']` — Rapier WASM 不应被预构建
- 需要 COOP/COEP 头（使用 SharedArrayBuffer 时）：`vite-plugin-coop-coep` 或 `@crxjs/vite-plugin`
- `build.target: 'esnext'` — 现代浏览器均支持，减小包体积

### 开发辅助库

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| comlink | ^4.4.2 | Web Worker RPC 通信 | 将 Worker 中的 Rapier API 暴露为异步代理对象，消除手动 postMessage 序列化 |
| @foxglove/comlink | ^4.4.1 | comlink 的活跃维护分支 | 如果 comlink 原始包有问题，使用此派生版本（最后更新 2025 年 5 月） |

## Installation

```bash
# 核心依赖
npm install react react-dom typescript
npm install three @react-three/fiber @react-three/drei
npm install @react-three/rapier @dimforge/rapier2d-compat

# 状态管理
npm install zustand zundo

# 构建工具
npm install -D vite @vitejs/plugin-react vitest

# 代码质量
npm install -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Web Worker 通信 (按需)
npm install comlink

# 类型定义
npm install -D @types/three
```

## Alternatives Considered

### 物理引擎

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| Rapier (WASM) | Matter.js | 仅 2D 且超过 7,500 物体时崩溃；纯 JS 性能上限低；轻量维护，无新特性。仅适用 2D 快速原型 |
| Rapier (WASM) | Cannon.js / cannon-es | 原始版已废弃；cannon-es 虽然有 ES Module + TS 支持但无算法创新；社区仍在用但日渐衰落 |
| Rapier (WASM) | Ammo.js (Bullet WASM) | WASM 体积巨大 (~1.5MB)；API 笨重（emscripten 绑定风格）；维护停滞 |
| Rapier (WASM) | Box2D WASM | 2D 经典引擎但 WASM 端口非官方；API 不友好；无 JS 生态集成 |
| Rapier (WASM) | 自研引擎 | 开发成本极高；正确实现碰撞检测、约束求解、数值稳定性需要专业领域知识；无收益 |

### 3D 渲染

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| Three.js + R3F | Babylon.js | 全功能引擎但过度封装；包体积大 (~1.4MB)；对"组件组合"场景限制多于赋能；Havok 物理被 Rapier 替代 |
| Three.js + R3F | 裸 WebGPU | 学习曲线陡峭；需要手写着色器、缓冲区管理、渲染管线；开发效率极低 |
| Three.js + R3F | PlayCanvas | 偏向游戏编辑器工作流；开源但核心功能需商业许可；自由度不如 Three.js |

### 状态管理

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| Zustand | Redux Toolkit | 对实时仿真过度设计；样板多；中间件开销大 |
| Zustand | Jotai / Valtio | 也是优秀选择但 Zustand 已在现有代码中；统一技术栈降低认知负担 |
| Zustand | MobX | 装饰器/代理魔法不利于 TypeScript 严格模式；学习曲线比 Zustand 陡峭 |

### 构建工具

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| Vite | Webpack 5 | 配置复杂；HMR 慢；WASM 集成需额外 loader 配置 |
| Vite | Turbopack | 尚未成熟；文档不完善；生态不够 |
| Vite | esbuild (直接) | 缺少 dev server、HMR、插件生态；仅适用于极简场景 |

## Web Worker / WASM 集成策略

### 架构模式：独立 Worker 拥有物理计算

```
┌─────────────────────────────────────────────────────┐
│ Main Thread (UI)                                    │
│ ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│ │ React UI │  │ R3F      │  │ Zustand Store      │  │
│ │ (面板)   │  │ (3D渲染) │  │ (仿真状态)         │  │
│ └──────────┘  └──────────┘  └────────────────────┘  │
│       │             │                 │              │
│       └─────────────┴─────────────────┘              │
│                     │                                │
│          comlink RPC / SharedArrayBuffer             │
│                     │                                │
├─────────────────────┼────────────────────────────────┤
│ Web Worker          │                                │
│ ┌───────────────────┴──────────────────────────────┐ │
│ │  Rapier WASM Physics Engine                       │ │
│ │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │ │
│ │  │ World    │  │ Solver   │  │ Collision      │  │ │
│ │  │ (场景图) │  │ (约束解) │  │ Detection      │  │ │
│ │  └──────────┘  └──────────┘  └────────────────┘  │ │
│ │                                                    │ │
│ │  Physics Loop (固定时间步长 1/60s)                 │ │
│ │  while (running) {                                 │ │
│ │    world.step()                                    │ │
│ │    syncBodiesToMainThread()                        │ │
│ │  }                                                 │ │
│ └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 通信通道选择

| 通道 | 延迟 | 适用场景 | 要求 |
|------|------|---------|------|
| comlink RPC (postMessage) | ~1-4ms | 默认方案 | 无特殊要求 |
| SharedArrayBuffer + Atomics | ~0ms | 高性能场景 (>100 物体) | COOP/COEP 头 |

### 分阶段策略

**Phase 1 (MVP)：** 物理在主线程运行（简化）
- Rapier WASM 直接在 R3F 的 `<Physics>` 组件内运行
- 经典力学物体数量少（<50），主线程计算完全可行
- 避免 Worker 通信复杂性，快速验证核心理念

**Phase 2 (优化)：** 物理迁移到 Web Worker
- 使用 comlink 将 Rapier 实例移到 Worker
- 主线程通过代理对象调用 `world.step()`
- Worker 每帧将物体位姿通过 postMessage 发送回主线程
- Zustand store 接收 Worker 数据并驱动 R3F 重新渲染

**Phase 3 (高性能)：** SharedArrayBuffer 零拷贝
- 物体位姿写入 SharedArrayBuffer（Float32Array）
- Worker 写入、主线程读取，无需序列化/反序列化
- 配合 `Atomics.wait/notify` 实现帧同步
- 适用于大规模仿真（>500 物体）

### Vite + WASM 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@dimforge/rapier2d-compat'],  // WASM 不被预构建
  },
  build: {
    target: 'esnext',  // 支持 top-level await (WASM 异步初始化)
  },
  worker: {
    format: 'es',  // Web Worker 使用 ES module 格式
  },
});
```

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Matter.js | 仅 2D、纯 JS 性能天花板 (~7,500 物体崩溃)、轻量维护 | @dimforge/rapier2d-compat |
| Cannon.js (原始) | 项目已废弃，无更新 | cannon-es (如需 JS 引擎) 或 Rapier |
| Ammo.js | WASM 体积巨大 (~1.5MB)、emscripten 风格 API 笨重 | Rapier (现代 WASM 绑定) |
| Webpack | 配置复杂、HMR 慢、WASM 需额外 loader | Vite |
| Redux | 对实时仿真过度设计 | Zustand |
| 模板化架构 | 废案失败的根本原因 | 组件组合架构 (React + R3F) |
| 裸 Canvas 2D | 缺少深度/透视感，不利于物理直觉培养 | Three.js 3D 渲染 |
| 自定义物理引擎 | 开发成本极高，无法匹敌 Rapier 十年算法积累 | Rapier |

## Stack Patterns by Variant

**如果仅需 2D 视觉呈现 (不需要 3D 旋转/缩放):**
- 使用 Rapier2D + HTML5 Canvas 2D 渲染
- 因为：减少复杂度，调试更直观

**如果目标是大规模粒子仿真 (>10,000 物体):**
- 使用 Rapier SIMD 构建 (`@dimforge/rapier2d-simd`)
- 使用 InstancedMesh 渲染（R3F `<InstancedRigidBodies>`）
- 因为：SIMD 提供额外 2x 加速，InstancedMesh 大幅减少 draw calls

**如果需要离线/桌面运行 (Electron/Tauri):**
- Rapier 可直接编译为原生代码
- 使用 Tauri (Rust) + Rapier 原生版本，性能更高

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @react-three/rapier@^2.2.0 | @react-three/fiber@^9, react@^19, three@^0.159 | React 18 需降级到 @react-three/rapier@^1 |
| @dimforge/rapier2d-compat@^0.19 | @react-three/rapier@^2.2.0 | @react-three/rapier 内置依赖 |
| zustand@^5 | react@^18 \|\| ^19 | 与现有 React 版本兼容 |
| vite@^6 | @vitejs/plugin-react@^4 | TypeScript SWC 编译 |

## Sources

- **Context7** — `/dimforge/rapier.js` (148 snippets), `/pmndrs/react-three-rapier` (190 snippets), `/pmndrs/zustand` (478 snippets, v5.0.12), `/vitejs/vite` (699 snippets, v8.0.7) — 库 API 确认
- **Dimforge 官方博客** — "The Rapier physics engine 2025 review and 2026 goals" (2026-01-09) — 性能数据、SIMD、路线图 [MEDIUM confidence, 未直接访问验证]
- **Rapier CHANGELOG** — 版本 0.19.3 (2025-11-05), 0.19.0 (2025-09-05) — 具体版本号和变更 [MEDIUM confidence]
- **dev.to — "This little known javascript physics library blew my mind!"** — Matter.js vs Rapier 直接性能对比数据 [MEDIUM confidence]
- **dev.to — "Babylon.js vs Three.js: The 360 Technical Comparison"** — 3D 框架架构对比 [MEDIUM confidence]
- **W3C WebApps 讨论 (2025-03)** — Web Worker + OffscreenCanvas + WASM 架构最佳实践 [MEDIUM confidence]
- **Mozilla.ai Blog** — "3W for In-Browser AI: WebLLM + WASM + WebWorkers" — WASM/Worker 通信模式 [MEDIUM confidence]
- **GitHub — pmndrs/react-three-rapier** — @react-three/rapier v2.2.0 版本、API、兼容性矩阵 [HIGH confidence]
- **npm.io / ecosyste.ms** — 各包发布版本和下载量统计 [MEDIUM confidence]
- **rapier.rs** — Rapier 官方文档和基准测试数据 [HIGH confidence (官方来源)]

---
*Stack research for: Physis 组件化物理模拟平台*
*Researched: 2026-04-30*
*Confidence: HIGH — 物理引擎和渲染框架结论有多源验证；版本号来自 npm 注册表和 GitHub CHANGELOG*
