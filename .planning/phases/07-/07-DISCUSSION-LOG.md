# Phase 7: 底层引擎重构 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 07-底层引擎重构
**Areas discussed:** 重构范围, 重构策略, 优先级排序, 类型安全修复, 测试策略, ForceFieldSystem 遍历优化, EnvironmentSync, ForceField position 双源, 物理引擎迁移

---

## 重构范围

| Option | Description | Selected |
|--------|-------------|----------|
| 物理引擎集成层 | 聚焦 Rapier ↔ R3F 桥接层：RigidBodyRefContext 生命周期、useBeforePhysicsStep 注入模式、ForceField 双源位置、EntityRenderer imperative sync 等物理相关核心 | ✓ |
| 全栈架构清理 | 覆盖所有层级：类型安全、性能优化、文件拆分、死代码删除、工具链引入 | |
| 你决定 | 由规划代理根据技术债务优先级自行确定范围，先处理 High 严重度问题 | |

**User's choice:** 物理引擎集成层
**Notes:** 用户明确锁定范围为物理引擎集成层（Rapier ↔ R3F 桥接、ECS 核心、力场计算管道），不触碰 UI 层和工具链。

---

## 重构策略

| Option | Description | Selected |
|--------|-------------|----------|
| 增量式重构 | 逐个模块重构，每次保持测试通过，可回滚。适合高风险物理集成代码。 | ✓ |
| 系统性重构 | 按层（Simulation → Rendering → Store）一次性重构，允许阶段性 break，完成后统一修复测试。更快但风险更高。 | |
| 混合策略 | 先增量修复 High 严重度问题，再系统性优化性能瓶颈。由 planner 根据依赖关系调度。 | |

**User's choice:** 增量式重构
**Notes:** 用户选择最安全的策略，逐个模块重构保持测试通过。

---

## 优先级排序

| Option | Description | Selected |
|--------|-------------|----------|
| RigidBodyRefContext 生命周期 | 5个系统共享的 entity-body 桥接存在竞态条件，快速拆卸时崩溃。修复方案：引入所有权模型或引用计数。 | ✓ |
| ForceField position 双源 | transform 和 forceField 组件都有 position，PropertyPanel 同时更新两者。修复：统一从 transform 读取。 | ✓ |
| VectorRenderer 性能瓶颈 | 每20ms重复计算 O(entities×fields) 力场求和。修复：与 ForceFieldSystem 共享缓存。 | ✓ |
| SpringRenderer 内存分配 | 每帧 new TubeGeometry()。修复：预分配 BufferGeometry 原位更新。 | ✓ |

**User's choice:** 全部四个问题都纳入本次重构
**Notes:** 用户选择全部四个核心问题，按 CONCERNS.md 中的 High 严重度排序处理。

---

## 类型安全修复

| Option | Description | Selected |
|--------|-------------|----------|
| 一并修复 | 扩展 RigidBodyAPI 类型，消除所有 `as any`，恢复类型安全。 | ✓ |
| 跳过类型 | 类型修复单独作为 Phase 7.1 或归入后续阶段，本次只聚焦运行时行为。 | |
| 仅修复物理相关 | 只修复 RigidBodyRefContext 和 ForceFieldSystem 中的类型逃逸，其他文件不碰。 | |

**User's choice:** 一并修复
**Notes:** 用户希望趁重构机会一并解决所有 6 处 `as any` 逃逸。

---

## 测试策略

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现有测试 | 重构期间保持现有 mock 测试通过，不引入新测试基础设施。 | |
| 新增集成测试 | 引入 Playwright + 真实 WASM 的端到端物理测试，作为重构安全网。 | ✓ |
| 你决定 | 由 planner 根据工作量和风险评估决定。 | |

**User's choice:** 新增集成测试
**Notes:** 用户认识到当前 jsdom mock 测试无法覆盖物理集成层，明确要求引入 Playwright + 真实 WASM 测试。

---

## ForceFieldSystem 遍历优化

| Option | Description | Selected |
|--------|-------------|----------|
| 订阅式缓存 | 订阅 entity add/remove 事件，维护 fields/dynamicBodies 缓存数组，只在 entity Map 变化时重建。 | |
| 分层索引 | 在 store 中维护独立的 forceFieldIds 和 dynamicBodyIds 数组，组件直接读取。 | |
| 你决定 | 由 planner 根据架构一致性确定最佳方案。 | ✓ |

**User's choice:** 你决定
**Notes:** 用户将技术方案决策权交给 planner。

---

## EnvironmentSync

| Option | Description | Selected |
|--------|-------------|----------|
| 集中式 EnvironmentSync | 提取独立 EnvironmentSync 组件，用单个 useFrame 节流循环批量写入所有 body。 | |
| store 中缓存环境快照 | entitySlice 中维护当前环境快照，EntityRenderer 用 useMemo 减少依赖变化。 | ✓ |
| 你决定 | 由 planner 根据实现复杂度确定。 | |

**User's choice:** store 中缓存环境快照
**Notes:** 用户选择 store 层方案，避免引入新的组件层级。

---

## ForceField position 双源修复

| Option | Description | Selected |
|--------|-------------|----------|
| 从 forceField 组件中移除 position 字段 | 完全移除 Gravity/Electric/Uniform/MagneticFieldComponent 的 position，forceFieldCalc 统一从 transform 读取。破坏性变更，需要迁移序列化。 | |
| PropertyPanel 中只更新 transform | 保留 forceField 组件中的 position（用于兼容性），但 UI 中隐藏并只写 transform。非破坏性，但代码中有废弃字段。 | |
| 你决定 | 由 planner 根据架构一致性和迁移成本权衡。 | ✓ |

**User's choice:** 你决定
**Notes:** 用户将技术方案决策权交给 planner。

---

## 物理引擎迁移

| Option | Description | Selected |
|--------|-------------|----------|
| 现在就讨论迁移 | 评估从 Rapier 迁移到其他引擎的可行性、成本、收益。 | |
| 暂缓标记为后续阶段 | 当前先保持 Rapier，在独立阶段评估迁移可行性 | |
| 只是探索不决定 | 了解选项但不承诺，当前仍聚焦 Rapier 集成层重构 | |

**User's choice:** 用户最初想讨论迁移，但最终接受暂缓
**Notes:** 用户最初提出"讨论更换物理引擎"，核心关切是 Rapier 缺少电磁学支持。经过澄清——Rapier 之上已构建自定义力场系统（Phase 3），电磁场通过 `useBeforePhysicsStep` 注入实现，迁移引擎并不能直接解决此问题。用户最终接受将此标记为延期想法（Phase 8+）。

---

## Claude's Discretion

- **ForceFieldSystem 遍历优化方案**：用户选择"你决定"——planner 根据架构一致性在"订阅式缓存"和"分层索引"之间选择
- **ForceField position 双源修复方案**：用户选择"你决定"——planner 根据迁移成本在"完全移除"和"UI 隐藏"之间选择

---

## Deferred Ideas

- **更换底层物理引擎（Rapier → 其他）** — 用户关切功能缺失（电磁学支持），但澄清后确认为 Rapier 之上已构建自定义力场。标记为 Phase 8+ 独立评估。
- **React 19 StrictMode 单例稳定性** — 属于稳定性阶段。
- **Biome/ESLint 工具链引入** — 属于工程化阶段。
- **PropertyPanel 文件拆分** — UI 重构阶段。
- **react-draggable 迁移** — React 19 兼容性阶段。
