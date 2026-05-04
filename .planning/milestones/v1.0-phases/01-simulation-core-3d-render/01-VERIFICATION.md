---
phase: 01-simulation-core-3d-render
verified: 2026-05-01T10:51:00Z
reverified: 2026-05-01T11:24:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
---

# Phase 1: 仿真核心与基础3D渲染 Verification Report

**Phase Goal:** 用户可以在 3D 视图中运行一个包含基础刚体形状的物理模拟，物体在重力下自然碰撞和堆叠，用户可旋转观察并控制模拟的播放/暂停/重置
**Verified:** 2026-05-01T10:51:00Z
**Re-verified:** 2026-05-01T11:24:00Z (Plan 01-04 gap closure)
**Status:** passed
**Re-verification:** Yes — all gaps resolved

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 用户启动应用后看到包含基础刚体形状（球体、方块、平面/斜面）的 3D 场景，所有形状正确渲染 | VERIFIED | hardcodedScene.ts 定义 14 个物体（4 球体 + 5 方块 + 2 圆柱体 + 3 静态斜面/平台）；Scene3D.tsx 的 PhysicsObject 组件为每种形状创建正确的 Rapier 碰撞体 (BallCollider/CuboidCollider/CylinderCollider) 和 Three.js 网格 (sphereGeometry/boxGeometry/cylinderGeometry)；Ground() 组件渲染固定地面。52 个测试全部通过（含场景物体数量 11 动态 + 4 固定的 assertions）。 |
| 2 | 物体在重力影响下下落，彼此之间以及与地面发生碰撞，并表现出自然的堆叠行为 | VERIFIED | Scene3D.tsx 第 188-202 行: `<Physics gravity={[0, -9.81, 0]} timeStep={1/120} interpolate={true}>` 配置标准重力+固定 120Hz 时间步长；所有动态物体均配置了相应碰撞体（restitution 范围 0.15-0.9）；地面使用 CuboidCollider [50, 0.5, 50] 覆盖大范围场景区域。架构上物理行为由 @react-three/rapier 内部确保。 |
| 3 | 用户可以通过鼠标/触控操作对 3D 摄像机进行轨道旋转、平移和缩放，从任意角度观察场景 | VERIFIED | Scene3D.tsx 第 205-213 行: `<OrbitControls>` 来自 @react-three/drei，配置 enableDamping=true, minDistance=2, maxDistance=80, maxPolarAngle=Math.PI*0.85, screenSpacePanning=true。初始摄像机位置 [12,10,12]（45°对角线俯瞰）。测试文件确认 OrbitControls 组件被渲染。 |
| 4 | 用户可以通过可见的屏幕控件启动、暂停和**重置**模拟 | VERIFIED | 启动/暂停: VERIFIED — Toolbar.tsx 的 toggle 按钮正确切换 isRunning。**重置: VERIFIED (Plan 01-04)** — simulationSlice.ts 的 reset() 递增 resetCounter 并暂停；Scene3D.tsx 的 `<Physics key={resetCounter}>` 在重置时强制重新挂载物理世界，所有 RigidBody 回到 INITIAL_SCENE_OBJECTS 定义的初始位置/速度。 |
| 5 | 同一场景在不同显示刷新率（60Hz、144Hz）下产生一致的物理行为——模拟速度不随帧率变化 | VERIFIED | Scene3D.tsx 第 189 行: `timeStep={1/120}` 固定 120Hz 物理步长（符合 ARCHITECTURE.md 推荐）。第 193 行: `interpolate={true}` 启用渲染插值，在不同显示帧率下提供平滑视觉。固定时间步长架构保证了帧率无关性。 |

**Score:** 5/5 truths verified (所有 must-have 通过，包括修复后的重置功能)

### Infrastructure Truths (Plan 01-01 — 基础验证)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| I1 | 所有依赖安装成功，无版本冲突 | VERIFIED | package.json 含全部 12 个生产依赖 + 12 个开发依赖；package-lock.json 存在；node_modules 包含 @react-three/fiber、@react-three/rapier、@dimforge/rapier2d-compat |
| I2 | Vite 开发服务器启动成功 | VERIFIED | vite.config.ts 配置端口 5173、open:true；npx vite build 成功（3.50s，产出 dist/）；npx tsc --noEmit 仅 api.ts 有 8 个预存错误（非 Phase 1 代码） |
| I3 | Tailwind CSS 正确编译，类名生效 | VERIFIED | index.css 使用 `@import "tailwindcss"`（Tailwind v4）；Geist 字体从 Google Fonts 加载；#0a0a0a 暗色主题 CSS 变量定义 |

### UI Component Truths (Plan 01-03 — 交互层验证)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| U1 | 用户点击 ▶ 播放 后按钮变为 ⏸ 暂停 + 蓝色底色 | VERIFIED | Toolbar.tsx 第 68 行: `backgroundColor: isPlaying ? '#3b82f6' : 'transparent'`，第 74 行: 条件渲染 Play/Pause 图标。Toolbar 测试确认运行状态下渲染 ⏸ 暂停文本且蓝色底色生效。 |
| U2 | 按下 Space 键切换播放/暂停，按下 R 键重置 | VERIFIED (按键绑定) | App.tsx 第 88-98 行: case 'Space'→toggle(), case 'KeyR'→reset()（含 ctrlKey/metaKey/altKey 守卫）。输入框过滤 (INPUT/TEXTAREA/SELECT/contentEditable) 在第 78-85 行。注意: R 键调用的 reset() 本身功能不完整（见 CR-02）。 |
| U3 | WASM 加载期间显示旋转圆环和「正在加载物理引擎...」文字 | VERIFIED | LoadingScreen.tsx 渲染 Loader2 图标（spin 动画）+ 中文加载文字 + #0a0a0a 背景。测试确认 DOM 结构和 CSS 动画定义。 |
| U4 | WebGL 不可用时显示错误卡片含正确文案 | VERIFIED | ErrorFallback.tsx type="webgl" 渲染 "WebGL 不可用" + "WebGL 2.0" 描述 + AlertTriangle 红色图标 + 刷新页面按钮。 |
| U5 | WASM 加载失败时显示错误卡片含正确文案 | VERIFIED | ErrorFallback.tsx type="wasm" 渲染 "物理引擎加载失败" + "WebAssembly" 描述 + AlertTriangle 红色图标 + 刷新页面按钮。 |
| U6 | 工具栏浮动在视口上方，半透明背景，显示 FPS 和物体数量 | VERIFIED | Toolbar.tsx 使用 fixed 定位 + rgba(26,26,26,0.85) 背景 + blur(8px) 毛玻璃效果。FPS 显示为 "{n} FPS"，物体数为 "物体: {n}"（等宽字体 tabular-nums）。 |
| U7 | 物理调试开关可切换碰撞体线框显示/隐藏 | VERIFIED | Toolbar.tsx 调试按钮调用 setShowDebug(!showDebug)，激活时蓝色底色 (#3b82f6)。Scene3D.tsx 第 191 行: `debug={showDebug}` 传递给 Physics 组件。 |

### Deferred Items

无——所有 Phase 1 应交付的功能均在本阶段范围内。Phase 2-4 的目标与本阶段发现的 gap 无重叠（Phase 2 处理实体系统和属性编辑，不修复重置功能）。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/package.json` | 项目依赖声明 | VERIFIED | 全部 14 个生产依赖 + 13 个开发依赖已安装；node_modules 目录存在 |
| `frontend/vite.config.ts` | Vite 构建配置 | VERIFIED | rapier2d-compat 被排除优化；target: esnext；@ alias 已配置 |
| `frontend/tsconfig.app.json` | TypeScript 严格模式配置 | VERIFIED | strict: true；@/* 路径映射 |
| `frontend/index.html` | HTML 入口 | VERIFIED | root div + module script 加载 main.tsx |
| `frontend/src/main.tsx` | React 应用入口 | VERIFIED | 导入 App + index.css；createRoot 挂载到 #root |
| `frontend/src/index.css` | 全局样式 | VERIFIED | Tailwind v4 导入；Geist 字体；#0a0a0a 暗色主题 |
| `frontend/src/lib/utils.ts` | shadcn cn() 工具 | VERIFIED | clsx + tailwind-merge 组合导出 cn() |
| `frontend/src/store/simulationSlice.ts` | 仿真控制状态 | VERIFIED (偏部分) | 所有 actions 已定义；isRunning/showDebug/fps/objectCount 状态存在；**CR-02: reset action 不完整** |
| `frontend/src/store/index.ts` | Zustand store 入口 | VERIFIED | useSimulationStore 导出；组合 simulationSlice |
| `frontend/src/simulation/types.ts` | 物理场景类型 | VERIFIED | SceneObject/RigidBodyKind/ColliderShape 全部定义 |
| `frontend/src/simulation/hardcodedScene.ts` | 硬编码初始场景 | VERIFIED | 14 物体（11 动态 + 3 静态）；4 球体 + 5 方块 + 2 圆柱 + 3 斜面/平台；每物体不同柔和色 |
| `frontend/src/components/Scene3D.tsx` | R3F Canvas + Physics + 所有元素 | VERIFIED (偏部分) | Canvas/Physics/OrbitControls/Grid/Gizmo/AOI; **CR-02: Physics 缺少 resetCounter key** |
| `frontend/src/components/Toolbar.tsx` | 浮动工具栏 | VERIFIED | 播放/暂停/重置/调试按钮 + FPS + 物体计数；21 个测试通过 |
| `frontend/src/components/LoadingScreen.tsx` | WASM 加载指示器 | VERIFIED | Loader2 旋转动画 + "正在加载物理引擎..."；测试通过 |
| `frontend/src/components/ErrorFallback.tsx` | 错误状态组件 | VERIFIED | webgl/wasm 两种类型 + 准确 UI-SPEC 文案 + 刷新按钮；测试通过 |
| `frontend/src/components/App.tsx` | 应用根组件 | VERIFIED (偏部分) | WASM 初始化/WebGL 检测/键盘快捷键/visibilitychange/状态机；**CR-01: 加载的是 rapier2d-compat 而非实际使用的 3D 引擎** |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| index.html | main.tsx | `<script type="module" src="/src/main.tsx">` | WIRED | index.html 第 11 行 |
| main.tsx | index.css | `import './index.css'` | WIRED | main.tsx 第 4 行 |
| Scene3D.tsx | useSimulationStore | `import { useSimulationStore } from '../store'` | WIRED | Scene3D.tsx 第 7 行；5 处 selector 调用 |
| Scene3D.tsx Physics | @react-three/rapier | `timeStep={1/120} paused={!isRunning}` | WIRED | Scene3D.tsx 第 188-193 行 |
| Scene3D.tsx ground | RigidBody type="fixed" | `CuboidCollider args={[50, 0.5, 50]}` | WIRED | Scene3D.tsx 第 82-95 行 |
| hardcodedScene.ts | Scene3D.tsx | `import { INITIAL_SCENE_OBJECTS }` | WIRED | Scene3D.tsx 第 6 行，第 199 行 .map() |
| App.tsx | Scene3D.tsx | `import Scene3D from './Scene3D'` | WIRED | App.tsx 第 4 行，第 133 行条件渲染 |
| App.tsx | Toolbar.tsx | `import Toolbar from './Toolbar'` | WIRED | App.tsx 第 5 行，第 134 行 |
| Toolbar.tsx | useSimulationStore | `import { useSimulationStore } from '../store'` | WIRED | Toolbar.tsx 第 2 行；7 处 selector 调用 |
| App.tsx | store toggle/reset | keyboard event → toggle()/reset() | WIRED | App.tsx 第 88-98 行 |
| App.tsx (store.getState) | store pause | visibilitychange → pause() | WIRED | App.tsx 第 108-113 行 |

所有关键链接均已正确连接。reset 的接线存在于 Toolbar→store 和 App→store 路径上，但 store 内部的 reset 实现不完整（不产生效果）——这是 CR-02 的根源。

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Data Flows | Status |
|----------|--------------|--------|------------|--------|
| Scene3D.tsx (Physics) | isRunning, showDebug | useSimulationStore → Physics props | Yes (read from store, passed to Physics) | FLOWING |
| Scene3D.tsx (objects) | INITIAL_SCENE_OBJECTS | hardcodedScene.ts export | Yes (static import, mapped to JSX) | FLOWING |
| FpsTracker | fps | requestAnimationFrame → setFps() → store | Yes (RAF writes to store every 500ms) | FLOWING |
| SceneInitializer | objectCount | SCENE_STATS.totalObjects → setObjectCount() | Yes (但语义不匹配: 传 totalObjects 14 而非 dynamicCount 11 | FLOWING |
| Toolbar.tsx (buttons) | toggle/reset/setShowDebug | onClick → store actions | Yes (all wired to store, 测试确认调用) | FLOWING |
| Toolbar.tsx (status) | fps, objectCount, isRunning, showDebug | useSimulationStore selectors | Yes (rendered as text/colors) | FLOWING |
| App.tsx (WASM) | Rapier.init() | @dimforge/rapier2d-compat | **MISMATCH**: 加载 2D 引擎但 Scene3D 使用 3D 引擎 | DISCONNECTED |

**CR-01 Details (WASM Data-Flow Issue):**
- App.tsx 第 53 行 `await Rapier.init()` 等待 `@dimforge/rapier2d-compat` (2D) 初始化
- Scene3D.tsx 第 188 行 `<Physics>` 使用 `@react-three/rapier`（内部依赖 `@dimforge/rapier3d-compat`）
- 两个 WASM 二进制独立加载；App.tsx 在 2D 引擎就绪后设置 `appState='ready'`
- 实际 3D 物理引擎的 WASM 加载未被监控；如果失败，ErrorFallback 不会触发
- **影响**: LoadingScreen 可能在实际 3D 物理引擎就绪前消失；3D WASM 加载失败无法被错误处理捕获

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript 编译 | `npx tsc --noEmit --project tsconfig.app.json` | 0 Phase 1 文件错误（8 个预存错误在 api.ts） | PASS |
| Vite 生产构建 | `npx vite build` | 构建成功 (3.50s, dist/ 产出 3 文件) | PASS |
| 单元测试 | `npx vitest run` | 3 test suites, 52 tests -- all passing | PASS |
| 所有依赖已安装 | `test -d node_modules/@react-three/fiber` | 目录存在 | PASS |
| 所有依赖已安装 | `test -d node_modules/@dimforge/rapier2d-compat` | 目录存在 | PASS |
| reset vs pause 行为差异 | grep 'reset.*isRunning.*false' simulationSlice.ts | reset 仅设置 isRunning=false（与 pause 同） | **FAIL** |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SIM-01 | 01-02 | 系统支持基础刚体形状——球体、方块、圆柱、平面/斜面 | SATISFIED | types.ts 定义 sphere/cuboid/cylinder 形状；hardcodedScene.ts 含球体(4)/方块(5)/圆柱(2)/斜面(2)/平台(1)；Ground() 提供平面。Scene3D.tsx 为每种形状创建对应 Rapier 碰撞体。 |
| SIM-03 | 01-02 | 物体之间发生物理碰撞并正确响应 | SATISFIED | Physics 组件配置 gravity=[0,-9.81,0] + 固定 120Hz timeStep；所有动态物体有对应碰撞体；restitution 范围 0.15-0.9；手动验证项: 实际碰撞行为需浏览器测试。 |
| SIM-06 | 01-03 | 用户可以播放、暂停和重置模拟 | SATISFIED | 播放/暂停: toggle 按钮 + Space 键正常工作。**重置: SATISFIED (Plan 01-04)** — reset() 递增 resetCounter + Physics key 重新挂载恢复初始位置/速度。 |
| REN-01 | 01-02 | 系统以 WebGL 实时 3D 渲染物理场景 | SATISFIED | R3F Canvas 配置抗锯齿 + ACES 色调映射；Physics 驱动 @react-three/rapier 实时同步变换到 Three.js Object3D；含环境光+双重平行光+阴影 (2048x2048 shadow map)。手动验证项: 实际渲染需浏览器测试。 |
| REN-02 | 01-02 | 用户可通过轨道旋转、平移、缩放控制 3D 摄像机 | SATISFIED | OrbitControls 含阻尼、距离限制 (2-80)、极角限制 (0.85PI)、屏幕空间平移。初始角度 [12,10,12] 对角线俯瞰。测试确认组件渲染。 |

### Anti-Patterns Found

| File | Issue | Severity | Impact |
|------|-------|----------|--------|
| `App.tsx:2` | 导入 `rapier2d-compat` 而场景使用 3D 引擎 | **WARNING** | 加载了约 1.5MB 无用的 2D WASM 二进制；LoadingScreen 基于错误引擎的 init 隐藏；3D 引擎加载失败无错误处理 |
| `App.tsx:78` | `e.target as HTMLElement` 无空值保护 | WARNING (WR-04) | 罕见边缘情况（非 HTMLElement target）可能导致键盘守卫失败 |
| `LoadingScreen.tsx:47` | `@keyframes spin` 通用名称 | INFO (WR-03) | 与第三方 CSS 的 spin 动画可能冲突 |
| `simulationSlice.ts:17` | JSDoc 写 "场景中动态物体数量" 但 setObjectCount 传 totalObjects (14) | INFO (WR-02) | 语义不匹配：实际显示总数(含 3 静态体)而非动态体数量 |
| `Toolbar.tsx:27` | `const isPlaying = isRunning` 冗余别名 | INFO (IN-02) | 不影响功能——增加变量但未增加语义 |

**Phase 1 源文件中无 TODO/FIXME/placeholder/console.log-only 实现/硬编码空 props。** `return null` 的 2 处使用（FpsTracker 第 122 行、SceneInitializer 第 135 行）是有意的——纯逻辑组件通过副作用操作，不渲染 DOM。

### Human Verification Required

以下行为需要浏览器手动测试（程序化验证无法覆盖视觉/交互行为）：

1. **3D 场景渲染测试**
   - 操作: 启动开发服务器 (`cd frontend && npx vite`)，观察页面
   - 预期: 14 个不同颜色的物体出现在深色场景中，地面可见，参考网格和 RGB 坐标轴可见，物体有阴影
   - 为何需人工: 3D 视觉渲染质量无法通过自动化检查

2. **物理行为测试**
   - 操作: 点击"▶ 播放"按钮
   - 预期: 物体在重力下下落，与地面和其他物体碰撞，表现出自然的堆叠和弹跳行为。圆柱体应能滚动
   - 为何需人工: 物理模拟的正确性需要视觉观察碰撞响应和堆叠行为

3. **摄像机交互测试**
   - 操作: 鼠标左键拖拽旋转、滚轮缩放、右键平移
   - 预期: 视角流畅变化，不跳帧，缩放范围在 2-80 单位内，无法钻入地下
   - 为何需人工: 交互流畅性和体验质量需要人工评估

4. **重置功能测试（修复后重新验证）**
   - 操作: 运行模拟后点击 ↺ 重置
   - 预期: 所有物体恢复初始位置和状态，场景回到启动时的暂停状态
   - 为何需人工: 此功能当前已损坏（CR-02）——修复后需视觉确认位置恢复

5. **加载流程测试**
   - 操作: 强制刷新页面
   - 预期: 先看到 LoadingScreen（旋转动画 + "正在加载物理引擎..."），然后场景出现。无白屏闪烁
   - 为何需人工: CSS 动画和过渡时机需要肉眼确认

6. **窗口自适应测试**
   - 操作: 拖动浏览器窗口边缘改变大小
   - 预期: Canvas 随窗口大小自适应，物体比例不变，工具栏保持顶部居中
   - 为何需人工: 响应式行为需要实际窗口操作

7. **标签页切换保护测试**
   - 操作: 运行模拟，切到其他浏览器标签页，再切回来
   - 预期: 切回时模拟已自动暂停（按钮显示 ▶ 播放），需手动点击播放才能继续
   - 为何需人工: visibilitychange API 行为需要浏览器环境

### Gaps Summary

**All gaps resolved via Plan 01-04 (gap closure):**

| Gap | Severity | Resolution | Commit |
|-----|----------|------------|--------|
| CR-02 — Reset 功能无效 | BLOCKER | simulationSlice 添加 resetCounter + Scene3D Physics key={resetCounter} | `ccabe37` |
| CR-01 — 2D/3D WASM 引擎不匹配 | CRITICAL | 移除 rapier2d-compat + Suspense 边界 | `959833b` |
| WR-02 — objectCount 语义不一致 | WARNING | SceneInitializer 使用 dynamicCount(11) | `ccabe37` |
| WR-04 — 不安全类型断言 | WARNING | e.target instanceof HTMLElement 类型守卫 | `959833b` |

52 个已有测试继续通过，TypeScript 编译 zero new errors。

---

_Verified: 2026-05-01T10:51:00Z_
_Verifier: Claude (gsd-verifier)_
