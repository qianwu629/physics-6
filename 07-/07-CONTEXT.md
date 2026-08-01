---
phase: 7
phase_name: 底层引擎重构
milestone: v2.0 力场与多维模拟
date_created: "2026-05-30"
status: Draft
---

# Phase 7 上下文 — 底层引擎重构

## 上游参考

- ROADMAP: `.planning/ROADMAP.md` (v2.0 路线图)
- REQUIREMENTS: `.planning/REQUIREMENTS.md`
- PROJECT: `.planning/PROJECT.md` — ECS 架构、技术栈
- STATE: `.planning/STATE.md` — 当前里程碑状态
- Phase 3 CONTEXT: `.planning/phases/03-通用力场系统/03-CONTEXT.md` — ForceFieldSystem useBeforeStep 注入、RigidBodyComponent 扩展模式
- Phase 3.5 CONTEXT: `.planning/phases/03.5-力场系统修复/03.5-CONTEXT.md` — 力场系统修复决策
- Phase 4 CONTEXT: `.planning/phases/04-表达式驱动外加力/04-CONTEXT.md` — 表达式力叠加模式
- Codebase: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`

---

<domain>
## Phase Boundary

**在范围内：**
- 物理引擎集成层：Rapier ↔ R3F 桥接（`RigidBodyRefContext`、`EntityRenderer`、`ForceFieldSystem`、`VectorRenderer`）
- ECS 核心类型安全修复：扩展 `RigidBodyAPI`、消除 6 处 `as any` 逃逸
- 力场计算管道优化：ForceField 双源位置统一、VectorRenderer 性能瓶颈修复、ForceFieldSystem 遍历优化
- 渲染层优化：SpringRenderer 每帧内存分配修复
- 环境同步优化：EntityRenderer environment slider 全量重同步修复
- 新增 Playwright 集成测试（真实 WASM 物理测试）

**不在范围内：**
- 更换底层物理引擎（Rapier → 其他引擎）— 重大架构变更，需独立阶段评估
- UI 层重构（PropertyPanel 拆分、对话框重构）— 属于 UI 阶段
- 非物理相关的死代码删除（`api.ts`、`simulation/types.ts`）— 属于清理阶段
- 工具链引入（Biome/ESLint/Prettier）— 属于工程化阶段
- React 19 StrictMode 单例稳定性（chartBuffers、contactForceMap）— 当前范围外
</domain>

<decisions>
## Implementation Decisions

### 重构范围与策略
- **D-07-01:** 范围 = **物理引擎集成层**。聚焦 Rapier ↔ R3F 桥接、ECS 核心、力场计算管道。不触碰 UI 层、不更换物理引擎。
- **D-07-02:** 策略 = **增量式重构**。逐个模块重构（RigidBodyRefContext → ForceFieldSystem → VectorRenderer → EntityRenderer → SpringRenderer），每次保持测试通过，可回滚。

### 核心优先级（按执行顺序）
- **D-07-03:** 四个核心问题按以下优先级处理：
  1. **RigidBodyRefContext 生命周期** — 5 个系统共享的 entity-body 桥接存在竞态条件，快速拆卸时崩溃
  2. **ForceField position 双源** — transform 和 forceField 组件各有一个 position，PropertyPanel 同时更新两者
  3. **VectorRenderer 性能瓶颈** — 每 20ms 重复计算 O(entities×fields) 力场求和
  4. **SpringRenderer 内存分配** — 每帧 `new TubeGeometry()`，GPU 内存抖动

### 类型安全
- **D-07-04:** **一并修复类型定义**。扩展 `RigidBodyAPI` 声明（`setAngularDamping`、`collider(index)`、`numColliders()` 等），消除全部 6 处 `as any` 逃逸。

### 测试策略
- **D-07-05:** **新增 Playwright 集成测试**。在真实浏览器中加载 Rapier WASM，验证至少一个端到端物理场景（如弹簧振子），作为重构安全网。

### 环境同步
- **D-07-06:** **store 中缓存环境快照**。EntityRenderer 当前在 environment slider 拖拽时触发所有 entity 的 `useEffect` 重同步。修复：store 中维护当前环境快照，EntityRenderer 用 `useMemo` 减少依赖变化。

### Claude's Discretion
- **ForceFieldSystem 遍历优化方案**：订阅 entity add/remove 事件维护缓存 vs 分层索引，由 planner 根据架构一致性确定
- **ForceField position 双源修复方案**：从 forceField 组件中移除 position vs 仅 UI 隐藏，由 planner 根据迁移成本确定

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 7 — 本阶段目标
- `.planning/REQUIREMENTS.md` — FIELD-01..04, EXPR-01..02
- `.planning/PROJECT.md` — ECS 架构、技术栈、废案教训
- `.planning/STATE.md` — 里程碑状态

### 上游阶段上下文（已锁定决策）
- `.planning/phases/03-通用力场系统/03-CONTEXT.md` — ForceFieldSystem useBeforeStep 注入、RigidBodyComponent 扩展模式（charge 字段）、独立 store 模式
- `.planning/phases/03.5-力场系统修复/03.5-CONTEXT.md` — 力场系统修复决策
- `.planning/phases/04-表达式驱动外加力/04-CONTEXT.md` — 表达式力叠加模式、useBeforeStep 参考实现

### 架构与代码审计
- `.planning/codebase/ARCHITECTURE.md` — 4 层分离架构、组件职责
- `.planning/codebase/CONCERNS.md` — 完整技术债务审计（类型安全、性能瓶颈、竞态条件）
- `.planning/codebase/STACK.md` — 技术栈详情

### 核心代码文件
- `frontend/src/components/RigidBodyRefContext.tsx` — entity-body 注册表桥接
- `frontend/src/components/ForceFieldSystem.tsx` — 每步力注入
- `frontend/src/components/VectorRenderer.tsx` — 力矢量渲染
- `frontend/src/components/SpringRenderer.tsx` — 弹簧可视化
- `frontend/src/components/EntityRenderer.tsx` — 实体渲染
- `frontend/src/components/Scene3D.tsx` — 场景根组件
- `frontend/src/ecs/forceFieldCalc.ts` — 力场计算
- `frontend/src/ecs/types.ts` — ECS 组件类型定义
- `frontend/src/store/entitySlice.ts` — 实体 CRUD
- `frontend/src/store/simulationSlice.ts` — 环境参数
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **RigidBodyRefContext** (`RigidBodyRefContext.tsx`): entityId → RigidBody ref 注册表 — 当前存在竞态条件，需引入生命周期所有权
- **ForceFieldSystem** (`ForceFieldSystem.tsx`): useBeforeStep 力注入模式 — VectorRenderer 应复用其计算结果
- **forceFieldCalc** (`frontend/src/ecs/forceFieldCalc.ts`): 多力场矢量和叠加模式 — VectorRenderer 当前重复计算

### Established Patterns
- **PITFALLS #6:** Per-frame 物理数据绕过 Zustand。重构需保持此原则
- **120Hz 固定时间步长:** 所有力注入在 useBeforeStep 中执行
- **NaN/Infinity 防御:** `isFiniteVec` 兜底模式 — 重构后仍需保持
- **独立 store 模式 (Phase 2):** chartDataStore / contactForceStore — ForceField 计算结果可共享存储

### Integration Points
- **RigidBodyRefContext** → 5 个消费者：ForceFieldSystem、VectorRenderer、TrajectoryRenderer、SpringRenderer、ChartSampler
- **EntityRenderer** → 环境参数变化触发全量 body 重同步
- **ForceFieldSystem** → VectorRenderer（力计算结果共享）
- **SpringRenderer** → TubeGeometry 每帧分配（需改为 BufferGeometry 原位更新）
</code_context>

<specifics>
## Specific Ideas

- **RigidBodyRefContext 竞态修复方向：** 引入引用计数或所有权模型，确保 unmount 时正确清理
- **VectorRenderer 性能修复方向：** 与 ForceFieldSystem 共享 `Map<entityId, Vec3>` 缓存，类似 `contactForceStore.ts` 模式
- **SpringRenderer 内存优化方向：** 预分配 `BufferGeometry`，每帧更新 `position` attribute + `setNeedsUpdate`
- **EnvironmentSync 修复方向：** store 中维护 `environmentSnapshot`，EntityRenderer 用 `useMemo` 比较快照变化
</specifics>

<deferred>
## Deferred Ideas

- ~~更换底层物理引擎（Rapier → Cannon.js/Ammo.js/PhysX.js）~~ **[已解决 2026-07-27]** — 电磁学支持已通过 Rapier 上的自定义力场层实现，无需更换引擎：场-源关系（charge≠0 的实体自动成为库仑场源；currentSource 组件实体等效无限长直导线产生环形磁场），见 `frontend/src/ecs/fieldSourceCalc.ts` 与 `frontend/src/components/ForceFieldSystem.tsx`。旧 Phase 8 的 7 个 plan（基于已过时的 addForce 注入设计）已废弃，不执行。
- **React 19 StrictMode 单例稳定性** — chartBuffers、contactForceMap 等模块级单例在 dev 双挂载下可能累积状态。属于稳定性阶段。
- **Biome/ESLint 工具链引入** — 工程化阶段，不属于物理集成层。
- **PropertyPanel 文件拆分** — UI 重构阶段（01.1 或后续）。
- **react-draggable → @dnd-kit/core 迁移** — React 19 兼容性阶段。

### Reviewed Todos (not folded)
无 — 本阶段无跨阶段 TODO 需要折叠。
</deferred>

---

*Phase: 07-底层引擎重构*
*Context gathered: 2026-05-30*
