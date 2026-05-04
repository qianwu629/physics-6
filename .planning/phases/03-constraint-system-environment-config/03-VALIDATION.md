---
phase: 03
slug: constraint-system-environment-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
inherits_from: .planning/phases/02-entity-component-system-property-editing/02-VALIDATION.md
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Built on Phase 2 testing infrastructure (Vitest + RTL); inherits sampling-rate conventions.

---

## 0. Inheritance Note

Phase 03 直接复用 Phase 2 已落地的测试基础设施：

- Vitest 4.1.5 + jsdom 29.1.1 + @testing-library/react 16.3.2
- Vite test config inline 在 `vite.config.ts` 中
- React 19 兼容性已在 Phase 2 验证（包含 02-radix-react19 / radix-zustand-react19 等回归集）

**Phase 03 仅在此基础上新增弹簧物理 + 环境系统的覆盖**，不引入新测试框架。

---

## 1. Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| **Config file** | `frontend/vite.config.ts` (inline test config) |
| **Quick run command** | `npx vitest run --reporter=verbose <pattern>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds（继 Phase 2 ~15s 后增长一倍） |
| **Coverage target** | 新增代码 ≥ 75% line coverage（不含 SpringRenderer 的 useFrame 体——纯渲染逻辑手动 UAT） |

**新增测试基础设施需求**（Wave 0）：
- Rapier headless 物理验证助手 `src/test/helpers/rapierHeadless.ts`（如不存在）：在 jsdom 中创建 Rapier World 并跑 N 步——用于物理正确性单元测试
- Rapier WASM 在 jsdom 中加载需 `import { ... } from '@dimforge/rapier3d-compat'` 直接走 compat path——已通过 `@react-three/rapier` peer 依赖间接可用

---

## 2. Sampling Rate

| 触发时机 | 命令 | 期望 |
|---------|------|------|
| **每个 task commit 后** | `npx vitest run --reporter=verbose <相关测试>` | 该子集全绿 |
| **每个 plan wave 完成后** | `npx vitest run` | 全集全绿 |
| **进入 `/gsd-verify-work` 前** | `npx vitest run` 全集 + 手动 UAT 单 | 全绿 + UAT 全勾 |
| **Max feedback latency** | 120 秒 | 单一文件测试 ≤ 5 秒；全集 ≤ 30 秒 |

---

## 3. Five Validation Pillars (Nyquist 5 Dimensions)

### 3.1 Algorithmic Correctness — 物理正确性

**目的**：验证物理公式与 Rapier 集成的数值正确性。

| 验证项 | 测试类型 | 测试文件 | 验证方法 | 期望 |
|-------|---------|---------|---------|------|
| 弹簧简谐运动 | unit (headless physics) | `src/__tests__/physics/spring-oscillator.test.ts` | m=1, k=10, L0=5, damping=0; 1000 步; 取 entityB.x 序列 | 满足 x(t) ≈ A·cos(√(k/m)·t)，周期误差 < 5% |
| 倍率叠加正确性 | unit | `src/components/__tests__/EntityRenderer.spec.tsx` | mock store with frictionScale=2.0 + entity.friction=0.5; render → 取 RigidBody friction prop | prop 等于 1.0 |
| 倍率夹紧上限 | unit | 同上 | scale=5 + entity.friction=0.8 → friction prop | 被夹紧到 2.0（Rapier 摩擦上限） |
| 重力立即生效 | unit (headless physics) | `src/__tests__/physics/gravity-hot-swap.test.ts` | 创建 1 球 + dynamic; setGravity([0,0,0]); step 60 帧 | 球的 y 速度 ≈ 0（停止下落） |
| 空气阻力衰减曲线 | unit (headless physics) | `src/__tests__/physics/drag-decay.test.ts` | drag=1.0; 给球 vx=10; step 1s | vx ≈ 10·exp(-1) ≈ 3.68，误差 < 10% |
| Reset 不清环境 | unit | `src/store/__tests__/simulationSlice.spec.ts` | setGravity([0,1,0]); reset(); 取 environment.gravity | [0, 1, 0] 保持 |
| 级联删除原子性 | unit | `src/store/__tests__/entitySlice.cascade.spec.ts` | 创建 entityA, entityB, spring(A,B); removeEntity(A); 取 entities Map | spring 实体不在 Map 中 |

### 3.2 Integration Correctness — 集成正确性

**目的**：验证组件 → store → Rapier 的端到端数据流。

| 验证项 | 测试类型 | 测试文件 | 期望 |
|-------|---------|---------|------|
| EnvironmentPanel ↔ store gravity | integration (RTL) | `src/components/__tests__/EnvironmentPanel.spec.tsx` | 输入 X=1.5 → store.environment.gravity[0] === 1.5 |
| EnvironmentPanel 摩擦预设胶囊 | integration | 同上 | 点击"超滑"胶囊 → frictionScale 变为预设值（如 0.1） |
| Spring Creation 状态机端到端 | integration | `src/components/__tests__/SpringCreation.flow.spec.tsx` | 点击 Toolbox 弹簧 → 点击 entityA → 点击 entityB → SpringDialog visible，端点正确 |
| SpringDialog 提交创建 spring entity | integration | 同上 | 提交后 entities Map 含 ConstraintComponent 含 entityAId/entityBId |
| 重力变化触发 Scene3D Physics prop 更新 | integration | `src/components/__tests__/Scene3D.gravity.spec.tsx` | mock `<Physics>` ; setGravity → mock 收到新 gravity prop |
| frictionScale 变化触发 EntityRenderer 重渲染 | integration | `src/components/__tests__/EntityRenderer.scaling.spec.tsx` | scale 变化后 mock RigidBody 的 friction 属性变化 |

### 3.3 Presentation Consistency — UI 一致性

**目的**：验证视觉规范与暂停/运行态切换。

| 验证项 | 测试类型 | 测试文件 | 期望 |
|-------|---------|---------|------|
| 运行时只读 — Slider disabled | unit | `src/components/__tests__/EnvironmentPanel.spec.tsx` | mock isRunning=true; render | 所有 Slider/Input 的 disabled=true |
| 运行时只读 — 提示横幅可见 | unit | 同上 | mock isRunning=true | "运行中，请暂停后编辑" 文字可见 |
| 立即生效高亮（300ms） | unit | 同上 | 暂停态改 X 分量 → check className | 出现 highlight class，~300ms 后移除 |
| 运行时只读 — SpringPropertyEditor disabled | unit | `src/components/__tests__/PropertyPanel.spring.spec.tsx` | 选中 spring + isRunning=true | k/L0/damping 输入 disabled |
| Spring 选中态颜色 | manual UAT | UAT-04 | 点击弹簧 → tube material color | #3299ff（与实体一致） |
| EnvironmentPanel 玻璃态视觉 | manual UAT | UAT-01 | 截图 vs UI-SPEC mockup | 视觉相似（< 1% 差异） |

### 3.4 Persistence/State Integrity — 数据完整性

**目的**：验证 store 状态更新的不变量。

| 验证项 | 测试类型 | 测试文件 | 期望 |
|-------|---------|---------|------|
| MAX_ENTITIES 上限（含弹簧） | unit | `src/store/__tests__/entitySlice.spec.ts` | 创建 50 entities + 1 spring → 第 51 操作 | addEntity 返回 false |
| Spring 端点引用完整性 | unit | 同上 | createSpringEntity(A, B) → 取出 spring entity | constraint.entityAId === A.id |
| ConstraintKind union TypeScript safety | static | `tsc --noEmit` | 编译期 | 无 `any` 类型，kind 严格匹配 'spring' |
| setGravity 创建新数组引用 | unit | `src/store/__tests__/simulationSlice.spec.ts` | const before = store.environment.gravity; setGravity([1,2,3]); after | before !== after（引用不同） |
| selectEntity 在级联删除后清空 | unit | `src/store/__tests__/entitySlice.cascade.spec.ts` | selectEntity(spring); removeEntity(A) → spring 被级联 | selectedEntityId === null |

### 3.5 User Experience — 可观察性

**目的**：手动 UAT 覆盖物理与视觉行为，无法 jsdom 自动化。

| UAT ID | 验证场景 | 步骤 | 期望 |
|--------|---------|------|------|
| UAT-01 | EnvironmentPanel 视觉规范 | 启动 → 点 Toolbar 环境按钮 | Popover 320px 宽，玻璃态 + 三段（重力/摩擦/弹性/空气阻力） |
| UAT-02 | 月球重力实验 | 暂停 → 选月球预设 → 添加球体 → 播放 | 下落明显比地球慢（约 1/6 加速度） |
| UAT-03 | 弹簧振子简谐运动 | 添加球 A 在 (0,5,0) + 球 B 在 (0,3,0) → 进入弹簧模式选 A→B → k=50, L0=2 → 给 B 一个 vy=2 → 播放 | B 上下振荡，周期约 2π/√(50/m) |
| UAT-04 | 弹簧选中视觉 | 创建弹簧后点击螺旋线 | tube 颜色变蓝色 (#3299ff)，PropertyPanel 显示弹簧属性 |
| UAT-05 | 级联删除 | 创建球 + 弹簧引用此球 → 删除球 | 弹簧自动消失，无悬空引用 |
| UAT-06 | 运行时只读提示 | 播放仿真 → 打开 EnvironmentPanel | 顶部显示"运行中，请暂停后编辑"，控件全部 disabled 变灰 |
| UAT-07 | 立即生效高亮 | 暂停 → 拖动重力 X 滑块 | 滑块对应 DOM 短暂高亮（~300ms） |
| UAT-08 | Reset 不清环境 | 设月球重力 → 添加 5 球 → reset | 球全部消失，重力仍是月球档 |
| UAT-09 | 多弹簧串联 | 添加 4 球 + 3 弹簧组成"链" → 给端点球速度 → 播放 | 链状传递振动，无穿插或爆炸 |
| UAT-10 | 性能边界 spike | 添加 50 实体 + 20 弹簧 → 播放 | FPS ≥ 60（120Hz 物理 + 60Hz 渲染目标） |

---

## 4. Per-Plan Verification Map

> **Plan IDs are placeholders** — exact task IDs to be filled in by Plan phase.
> 每个 plan 内的 task 都需对应至少一个 automated 或 manual verify。

| Plan | Wave | Requirement | Test Type | Automated Command | Manual UAT |
|------|------|-------------|-----------|-------------------|-----------|
| **03-01** ECS + Slice 扩展 | 1 | SIM-04 (data model) | unit | `npx vitest run src/ecs src/store` | — |
| **03-02** EnvironmentPanel + 倍率叠加 | 2 | SIM-02, SIM-05 | unit + integration | `npx vitest run src/components/__tests__/EnvironmentPanel src/components/__tests__/EntityRenderer.scaling` | UAT-01, UAT-02, UAT-06, UAT-07, UAT-08 |
| **03-03** Spring 渲染 + 创建状态机 | 2 | SIM-04 | unit + integration + headless physics | `npx vitest run src/__tests__/physics/spring-oscillator src/components/__tests__/SpringCreation` | UAT-03, UAT-09 |
| **03-04** PropertyPanel 多态 + 级联删除 | 3 | SIM-04, REN-03 | unit + integration | `npx vitest run src/components/__tests__/PropertyPanel.spring src/store/__tests__/entitySlice.cascade` | UAT-04, UAT-05 |
| **03-05** （可选）集成与性能 spike | 3 | All | full suite + manual | `npx vitest run` + DevTools profile | UAT-10 |

---

## 5. Wave 0 Requirements

> **Wave 0 = 测试基础设施先行**——必须在 plan 任务实施前到位，否则后续 task 无法 verify。

- [ ] `src/test/helpers/rapierHeadless.ts` — 创建 Rapier World + 跑 step 的 helper（如不存在）
- [ ] `src/__tests__/physics/spring-oscillator.test.ts` — 弹簧振子物理正确性
- [ ] `src/__tests__/physics/gravity-hot-swap.test.ts` — 重力热更新
- [ ] `src/__tests__/physics/drag-decay.test.ts` — 空气阻力衰减
- [ ] `src/store/__tests__/simulationSlice.spec.ts` — environment 字段 CRUD（如不存在）
- [ ] `src/store/__tests__/entitySlice.cascade.spec.ts` — 级联删除单元测试
- [ ] `src/components/__tests__/EnvironmentPanel.spec.tsx` — 环境面板 UI 测试
- [ ] `src/components/__tests__/EntityRenderer.scaling.spec.tsx` — 倍率叠加传递测试
- [ ] `src/components/__tests__/SpringCreation.flow.spec.tsx` — Spring 创建状态机集成
- [ ] `src/components/__tests__/PropertyPanel.spring.spec.tsx` — PropertyPanel 多态分发
- [ ] `src/components/__tests__/Scene3D.gravity.spec.tsx` — 重力 prop 接入测试

**新增依赖检查**：
- [ ] `@dimforge/rapier3d-compat` — 通过 `@react-three/rapier` peer 应已可用；检查 `node_modules/@dimforge/rapier3d-compat` 存在
- [ ] Radix Popover — 检查 `radix-ui` 包是否包含 `@radix-ui/react-popover`，否则 `npx shadcn add popover`

---

## 6. Manual-Only Verifications

> 无法 jsdom 自动化，需在真实浏览器中验证。

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|-----------|-------------------|
| Spring helix tube 视觉 | SC-2 | TubeGeometry + CatmullRomCurve3 在 jsdom 无 WebGL，无法验证视觉 | UAT-03 + UAT-09 |
| 月球重力下落感受 | SC-3 | 物理感官需真实运行 | UAT-02 |
| 多弹簧链振动 | SC-5 | 多体动力学需 60+ 帧观察 | UAT-09 |
| 50+20 性能边界 | (内部目标) | 性能仅在真实 GPU 显现 | UAT-10 |
| EnvironmentPanel 玻璃态 backdrop-filter | SC-1 | jsdom 不渲染 CSS filter | UAT-01 截图比对 |
| 立即生效高亮 300ms 时序 | UI-SPEC | jsdom 的 raf timing 不准确 | UAT-07 |

---

## 7. Validation Sign-Off Checklist

- [ ] All plan tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files
- [ ] No watch-mode flags（CI 兼容）
- [ ] Feedback latency < 120s
- [ ] All 10 UAT scenarios documented with steps + expectations
- [ ] `nyquist_compliant: true` set in frontmatter (after sign-off)

**Approval status**: pending — to be re-validated after PLAN.md generated and Per-Plan Verification Map task IDs are filled in.

---

*Phase 03 Validation Strategy — 2026-05-02*
*Source: 03-RESEARCH.md § 6 Validation Architecture*
*Inheritance: 02-VALIDATION.md (Phase 2 testing baseline)*
