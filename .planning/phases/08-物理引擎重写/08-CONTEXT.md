# Phase 8: 物理引擎重写 - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

**在范围内：**
- 物理引擎技术评估：候选引擎调研（Cannon.js/Ammo.js/PhysX.js/Jolt/Planck.js等）
- 电磁学支持能力评估：场-源关系、时变电磁场支持程度
- 性能基准测试：50实体场景@100fps目标
- 概念验证（PoC）：在候选引擎上实现代表性电磁学场景
- 如评估通过，完成从Rapier到新引擎的完整迁移实施
- 保持UI交互流程和力场系统API向后兼容

**不在范围内：**
- UI层重构（PropertyPanel拆分、对话框重构）— 属于UI阶段
- 非物理相关的死代码删除、工具链引入 — 属于工程化阶段
- 完整Maxwell方程组数值求解（FDTD/FEM）— 计算量过大，超出Web端物理引擎常规能力
- 多物理场耦合（光学、热力学）— v3.0+愿景
- 如果评估不通过，本阶段终止，电磁学深度扩展推迟到v3.0
</domain>

<decisions>
## Implementation Decisions

### 目标引擎选择 [已修订 — 调研后]
- **D-08-01:** 痛点 = **电磁学功能缺失**。Rapier作为刚体动力学引擎，缺少内置电磁学模型，需完全通过自定义力场workaround实现。**[调研结论：无需更换引擎，Rapier + 自定义力场层即可满足所有电磁学需求]**
- **D-08-02:** ~~评估范围 = 轻量纯JS + 功能丰富WASM 两类都评估~~ **[已否定]** 调研已完成（Cannon.js/Matter.js/Planck.js/Ammo.js/PhysX.js/Jolt），结论：无 Web 物理引擎支持电磁学原生功能。保持 Rapier。
- **D-08-03:** ~~评估维度优先级 = 电磁学支持深度 > 与R3F/现有架构集成难度 > 生态与维护状态~~ **[已否定]** 不再评估引擎，聚焦 Rapier 自定义力场层增强。
- **D-08-04:** ~~迁移策略 = 大爆炸替换~~ **[已否定]** 无迁移。在 Rapier 上增量式增强电磁学功能。

### 电磁学支持深度
- **D-08-05:** 新增需求 = **场-源关系**。电荷产生电场（库仑定律推广）、电流产生磁场（毕奥-萨伐尔定律），而非仅预设外场。
- **D-08-06:** 时变电磁场 = **简化模型**（暂定，待研究细化）。支持法拉第电磁感应定律（变化磁场→感应电场）和安培-麦克斯韦定律（变化电场→磁场）。完整Maxwell方程组数值求解（电磁波传播、辐射、散射）暂不涉及。
- **D-08-07:** 场-源计算方案 = **由planner决定**。实时N体计算（O(N²)精确但性能差）、预计算场网格（牺牲精度换性能）、混合方案（近场实时+远场网格），planner根据引擎能力和架构一致性选择。
- **D-08-08:** 性能约束 = **≤50实体，目标100fps**。这是一个高约束，可能限制引擎选择范围。

### 评估与实施边界
- **D-08-09:** 交付物 = **场-源关系计算引擎 + 时变电磁场简化模型 + 性能优化 + 序列化适配 + UI控制面板**。Phase 8 从 Rapier 上的自定义力场层增强角度实施，不评估/迁移引擎。
- **D-08-10:** ~~Fallback = 如评估不通过，推迟到后续里程碑（v3.0）~~ **[已不适用]** 调研已确认无需换引擎，Phase 8 直接进入实施。
- **D-08-11:** 验收标准 = **四项全过**：场-源关系正确运行（电荷相互吸引/排斥）、时变场模型稳定（正弦时变 + 感应电场）、50实体@120fps性能达标、向后兼容（所有现有功能等价运行）。
- **D-08-12:** 向后兼容 = **UI交互流程** 和 **力场系统API** 必须保持。用户创建/编辑实体、添加力场的操作流程不变；ForceField组件框架和forceFieldCalc.ts接口保持稳定。场景JSON序列化格式可变更（新增 fieldSource 组件字段）。

### Claude's Discretion
- **场-源计算方案**：用户选择"由planner决定"——planner在实时N体/预计算网格/混合方案之间选择，需考虑引擎能力和架构一致性
- **时变电磁场具体范围**：用户暂定为"简化模型"，研究阶段细化具体支持哪些时变场景
- **候选引擎初筛**：planner可根据评估维度（电磁学/集成难度/生态）先做一轮筛选，排除明显不合适的选项

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 8 — 本阶段目标与边界
- `.planning/REQUIREMENTS.md` — v2.0需求清单（FIELD-01..04, EXPR-01..02）
- `.planning/PROJECT.md` — ECS架构、技术栈、核心设计决策
- `.planning/STATE.md` — 里程碑状态与路线图演变

### 上游阶段上下文（已锁定决策）
- `.planning/phases/07-底层引擎重构/07-CONTEXT.md` — 触发Phase 8的原因（电磁学功能缺失）、Rapier集成层现状、Phase 7范围明确排除引擎迁移
- `.planning/phases/03-通用力场系统/03-CONTEXT.md` — ForceField框架设计、useBeforeStep注入模式、RigidBodyComponent扩展模式（charge字段）
- `.planning/phases/03.5-力场系统修复/03.5-CONTEXT.md` — 力场系统修复决策
- `.planning/phases/04-表达式驱动外加力/04-CONTEXT.md` — 表达式力叠加模式

### 架构与代码审计
- `.planning/codebase/ARCHITECTURE.md` — 4层分离架构、组件职责、RigidBodyRefContext桥接设计
- `.planning/codebase/CONCERNS.md` — 技术债务审计（类型安全、性能瓶颈、竞态条件、as any逃逸）
- `.planning/codebase/STACK.md` — 技术栈详情（Rapier WASM + React Three Fiber + Zustand + Vite）

### 核心代码文件
- `frontend/src/components/RigidBodyRefContext.tsx` — entity-body注册表桥接
- `frontend/src/components/ForceFieldSystem.tsx` — useBeforeStep力注入模式
- `frontend/src/ecs/forceFieldCalc.ts` — 力场计算（多力场矢量和叠加）
- `frontend/src/ecs/types.ts` — ECS组件类型定义（含ForceField组件）
- `frontend/src/store/entitySlice.ts` — 实体CRUD
- `frontend/src/components/VectorRenderer.tsx` — 力矢量渲染
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ForceField框架** (`ForceFieldSystem.tsx` + `forceFieldCalc.ts`): 通用力场组件框架 + 多力场矢量和叠加模式。迁移后需保持API兼容。
- **RigidBodyRefContext** (`RigidBodyRefContext.tsx`): entityId → RigidBody ref注册表。迁移后需替换为新引擎的等效桥接。
- **ECS实体系统** (`Entity.ts` + `types.ts`): 实体-组件架构。迁移后组件定义可能需要适配新引擎的body类型。
- **力场可视化** (`VectorRenderer.tsx`, `ForceFieldRenderer.tsx`): 力矢量和力场体积渲染。逻辑层（计算）与渲染层已分离，渲染层可复用。

### Established Patterns
- **PITFALLS #6:** Per-frame物理数据绕过Zustand。迁移后仍需保持此原则，避免re-render storm。
- **120Hz固定时间步长:** 所有力注入在useBeforeStep中执行。新引擎需支持等效的pre-step钩子或固定步长循环。
- **NaN/Infinity防御:** `isFiniteVec`兜底模式。迁移后仍需保持。
- **独立store模式:** chartDataStore/contactForceStore。场-源计算结果可共享存储。

### Integration Points
- **Rapier ↔ R3F桥接:** `@react-three/rapier`提供RigidBody组件和World上下文。迁移需替换为新引擎的React绑定（如有）或自建桥接。
- **力场计算管道:** `forceFieldCalc.ts` → `ForceFieldSystem.tsx` → Rapier body.applyForce。迁移后只需替换最后一环（body施加力的API）。
- **序列化系统:** `sceneSerializer.ts` + `sceneValidation.ts`。如引擎数据模型不同，序列化格式可能需要版本升级。
- **5个消费者共享RigidBodyRefContext:** ForceFieldSystem、VectorRenderer、TrajectoryRenderer、SpringRenderer、ChartSampler。迁移后全部需适配。
</code_context>

<specifics>
## Specific Ideas

- **代表性PoC场景建议：** 两个点电荷相互排斥/吸引（验证场-源关系）+ 磁场中带电粒子的圆周运动（验证洛伦兹力）。这两个场景覆盖了核心电磁学功能且可视化效果好。
- **场-源关系实现方向：** 电荷/电流作为新的ECS组件类型（或扩展现有RigidBodyComponent），每帧计算所有源对所有实体的场贡献，再通过现有力场注入管道施加力。
- **性能优化预期：** 50实体@100fps要求极高。如果纯N体O(N²)不可行，考虑Barnes-Hut近似（O(N log N)）或空间哈希网格。
- **序列化格式变更策略：** 如果新引擎的body参数格式不同，可在序列化JSON中增加`engineVersion`字段，加载时根据版本做适配转换。
</specifics>

<deferred>
## Deferred Ideas

- **完整Maxwell方程组数值求解（FDTD/FEM）** — 电磁波传播、辐射、散射等。计算量超出Web端物理引擎常规能力，v3.0+评估是否需要专门电磁仿真引擎或WebGPU加速。
- **多物理场耦合（光学、热力学、流体力学）** — v3.0+长期愿景，超出v2.0范围。
- **场景JSON序列化向后兼容** — 用户允许格式变更，如需适配新引擎数据模型，可引入版本字段做迁移。
- **双引擎并行过渡** — 用户明确拒绝，选择大爆炸替换策略。

### Reviewed Todos (not folded)
无 — 本阶段无跨阶段TODO需要折叠。
</deferred>

---

*Phase: 08-物理引擎重写*
*Context gathered: 2026-05-31*
