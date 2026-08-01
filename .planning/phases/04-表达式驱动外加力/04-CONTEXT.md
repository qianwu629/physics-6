---
phase: 4
phase_name: 表达式驱动外加力
milestone: v2.0 力场与多维模拟
date_created: "2026-05-24"
status: Locked (12 decisions confirmed)
---

# Phase 4 上下文 — 表达式驱动外加力

## 上游参考

- ROADMAP: `.planning/ROADMAP.md` (v2.0 路线图)
- REQUIREMENTS: `.planning/REQUIREMENTS.md` — 需求编号 EXPR-01, EXPR-02
- Phase 1 CONTEXT: `.planning/phases/01-持久化与场景库/01-CONTEXT.md` (Zod + react-hook-form 表单验证模式)
- Phase 3 CONTEXT: `.planning/phases/03-通用力场系统/03-CONTEXT.md` (ForceFieldSystem useBeforeStep 注入、RigidBodyComponent 扩展模式、独立 store 模式)
- Milestone 状态: `.planning/STATE.md`

## 本阶段目标

用户可为任意实体绑定数学表达式，每帧根据实体状态（位置 px/py/pz、速度 vx/vy/vz、时间 t、质量 m）计算外加力矢量（fx/fy/fz）。表达式语法错误即时反馈，性能目标 50+ 实体每帧 <2ms 解析开销。

---

<domain>
## Phase Boundary

**在范围内：**
- 表达式解析器集成（mathjs / expr-eval / 其他）
- 新 ECS 组件 `expressionForce`（或扩展 RigidBodyComponent）存储 fx/fy/fz 表达式字符串
- 独立表达式对话框（ExpressionDialog），含语法高亮、实时预览、速查表
- PropertyPanel 中表达式摘要显示（只读）+ 编辑/删除按钮
- 每帧表达式求值并通过 `useBeforeStep` 注入为外加力
- 语法错误即时 UI 反馈（红框禁用）
- 运行时错误自动暂停表达式 + PropertyPanel 警告图标
- 表达式力与力场力矢量和叠加
- sceneSerializer 序列化/反序列化支持

**不在范围内：**
- 表达式力可视化（矢量叠加层显示，属于 Phase 3 可视化扩展，planner 酌情决定）
- 预设物理公式模板（违背 Physis 自由组合理念，明确拒绝）
- 表达式数据导出 / CSV（ANL-02，v3）
- 时间操控（慢动作/逐帧/回放）— ANL-03, v3
- 多行/复杂条件表达式（单行输入已锁定，不支持 `?:` 条件运算符）
</domain>

<decisions>
## Implementation Decisions

### 表达式输入界面
- **D-04-01:** 独立表达式对话框（ExpressionDialog），非 PropertyPanel 内联输入。PropertyPanel 仅通过按钮触发对话框。
- **D-04-02:** 对话框采用「完整版」辅助信息设计：变量速查表（px/py/pz/vx/vy/vz/t/m）、函数速查表（sin/cos/tan/exp/log）、常量（pi/e/g）、实时预览、错误提示。
- **D-04-03:** fx/fy/fz 各一个单行输入框。不支持多行 textarea 或条件表达式语法。
- **D-04-04:** 对话框底部显示实时数值预览（当前仿真时间下三个分量的数值），帮助用户确认公式效果。

### 表达式辅助功能
- **D-04-05:** **不提供预设公式快捷插入。** 坚持 Physis "自由组合" 核心理念，不预设任何模板公式（如简谐振动、阻尼力）。用户完全自由输入。
- **D-04-06:** 速查表中的变量名和函数名**可点击自动插入**到光标位置；输入框支持**语法高亮**（数字、变量、函数、运算符颜色区分）。
- **D-04-07:** 对话框底部显示**迷你力矢量示意图**，用箭头直观展示当前表达式在三个分量上的方向和大小。
- **D-04-08:** PropertyPanel 中只显示表达式**简短摘要**（如 "表达式力: sin(t),0,0"），右侧配编辑/删除按钮。不嵌入完整输入框。

### 运行时错误行为
- **D-04-09:** **语法错误 → 红框 + 禁用。** 输入框边框变红，保存/启用按钮禁用，表达式不参与仿真。用户修正后自动恢复。
- **D-04-10:** **运行时错误 → 表达式自动暂停。** 当某帧求值出现异常（除零、sqrt负数、log(0) 等），该实体的表达式力被自动关闭（相当于开关关闭），不影响其他实体和力场。
- **D-04-11:** **错误展示 → 红色警告图标 + 悬停详情。** PropertyPanel 中表达式摘要旁显示 ⚠️ 红色图标，鼠标悬停弹出错误类型和发生时间。
- **D-04-12:** **表达式力与力场力完全叠加。** 一个实体上可同时受表达式力、力场力和重力，合力为三者矢量和。不引入互斥开关。

### Claude's Discretion
- **表达式解析器选择：** mathjs vs expr-eval vs 其他由 researcher 调研后确定。关键指标：bundle size、求值性能（预编译能力）、语法兼容性（是否支持要求的变量/函数集合）。
- **ECS 组件设计：** 新增 `expressionForce` 组件 vs 扩展 `RigidBodyComponent` 由 planner 根据架构一致性确定（参照 Phase 3 charge 字段扩展模式）。
- **表达式求值优化：** 是否预编译表达式为求值函数（避免每帧重新解析）由 planner 根据性能要求确定。
- **语法高亮实现：** 简单正则高亮 vs 引入轻量代码编辑器由 planner 根据复杂度权衡确定。
- **迷你矢量图实现：** Canvas 2D vs SVG vs 简单 CSS 箭头由 planner 确定。

### Folded Todos
无 — 本阶段无跨阶段 TODO 需要折叠。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与路线图
- `.planning/ROADMAP.md` §Phase 4 — 表达式驱动外加力目标与成功标准
- `.planning/REQUIREMENTS.md` — EXPR-01, EXPR-02

### 上游阶段上下文（已锁定决策）
- `.planning/phases/01-持久化与场景库/01-CONTEXT.md` — Zod + react-hook-form 验证模式、序列化架构
- `.planning/phases/03-通用力场系统/03-CONTEXT.md` — ForceFieldSystem useBeforeStep 注入模式、RigidBodyComponent 扩展模式（charge 字段）、独立 store 模式、PITFALLS #6 防护

### 架构与代码
- `.planning/PROJECT.md` — ECS 架构、技术栈、废案教训、mathjs vs expr-eval 待确认
- `.planning/phases/03-通用力场系统/03-RESEARCH.md` — useBeforeStep 集成方案、力场计算模式
- `frontend/src/ecs/types.ts` — ComponentType 联合、组件接口定义（参照 ForceFieldComponent discriminated union 模式）
- `frontend/src/ecs/Entity.ts` — 实体工厂函数模式
- `frontend/src/components/ForceFieldSystem.tsx` — useBeforeStep 力注入参考实现
- `frontend/src/components/PropertyPanel.tsx` — PropertyPanel 分支渲染模式（forceField / rigidBody 检测）
- `frontend/src/components/CreationDialog.tsx` — Zod+react-hook-form 对话框模式
- `frontend/src/utils/sceneSerializer.ts` — 序列化/反序列化架构
- `frontend/src/store/entitySlice.ts` — 实体 CRUD 操作 + MAX_ENTITIES
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CreationDialog / ForceFieldDialog** (`CreationDialog.tsx`, `ForceFieldDialog.tsx`): Zod schema + react-hook-form + 对话框架构 — ExpressionDialog 参照此模式
- **entitySlice** (`entitySlice.ts`): addEntity/removeEntity/updateComponent — 表达式力组件直接使用现有 CRUD
- **ForceFieldSystem** (`ForceFieldSystem.tsx`): useBeforeStep 力注入模式 — 表达式力计算可复用同一 hook 或独立组件
- **RigidBodyRefContext** (`RigidBodyRefContext.tsx`): entityId → RigidBody ref 注册表 — 表达式力求值需要读取实体位置和速度
- **forceFieldCalc** (`frontend/src/ecs/forceFieldCalc.ts`): 多力场矢量和叠加模式 — 表达式力应作为额外一项加入合力计算

### Established Patterns
- **PITFALLS #6:** Per-frame 物理数据绕过 Zustand。表达式求值在物理步进中直接读取 RigidBody ref，结果通过 applyForce 注入，不触发 React 重渲染
- **120Hz 固定时间步长:** 表达式力在 useBeforeStep 中注入，与物理步严格同步
- **组件检测分支 UI:** PropertyPanel 已按组件类型分支渲染（rigidBody / forceField）— 扩展为检测 expressionForce 组件
- **NaN/Infinity 防御:** forceFieldCalc.ts 中 `isFiniteVec` 兜底模式 — 表达式求值结果应遵循同样防御策略
- **独立 store 模式 (Phase 2):** chartDataStore — 表达式可能需要独立状态管理（如表达式启用/禁用开关、错误状态）

### Integration Points
- **PropertyPanel**: 检测到 `expressionForce` 组件 → 渲染表达式摘要 + 编辑按钮 + 错误警告图标
- **Scene3D / ForceFieldSystem**: 表达式力计算在 useBeforeStep 中与力场力叠加注入
- **sceneSerializer**: 新增 expressionForce 组件的序列化/反序列化
- **RigidBodyRefContext**: 表达式求值读取实体位置/速度/质量时通过 ref 直接访问
</code_context>

<specifics>
## Specific Ideas

- **表达式对话框速查表设计：** 变量区（px, py, pz, vx, vy, vz, t, m）和函数区（sin, cos, tan, exp, log）分两组排列，每个标签可点击插入到当前光标位置
- **实时预览格式：** `fx ≈ 1.23  fy ≈ 0.00  fz ≈ -2.45` + 迷你矢量箭头图
- **语法高亮配色：** 数字（蓝色）、变量（绿色）、函数（紫色）、运算符（灰色），与代码编辑器惯例一致
- **PropertyPanel 摘要格式：** `表达式力: sin(t), 0, cos(t)` 或 `表达式力: 未设置`（当无表达式时）
- **错误图标位置：** PropertyPanel 中表达式摘要行右侧，紧邻编辑/删除按钮
</specifics>

<deferred>
## Deferred Ideas

- **表达式力可视化（矢量叠加层）** — 在 VectorRenderer 中用不同颜色显示表达式力箭头。属于 Phase 3 可视化扩展，可由 planner 酌情纳入 Phase 4 或推迟。
- **预设物理公式模板** — 明确拒绝。违背 Physis "自由组合、无预设模板" 核心设计理念。
- **表达式 CSV 导出** — ANL-02，v3 需求。
- **时间操控（慢动作/逐帧/回放）** — ANL-03，v3 需求。

### Reviewed Todos (not folded)
无 — 本阶段无跨阶段 TODO。

</deferred>

---

## 成功标准

1. [ ] 用户在 PropertyPanel 中为实体启用表达式力，打开独立对话框输入 fx/fy/fz
2. [ ] 表达式支持四则运算、三角函数、指数对数、常量（pi/e/g）、变量（px/py/pz/vx/vy/vz/t/m）
3. [ ] 语法错误即时反馈：红框 + 禁用保存
4. [ ] 运行时错误自动暂停表达式，PropertyPanel 显示警告图标 + 悬停详情
5. [ ] 实时预览：对话框底部显示当前数值 + 迷你矢量图
6. [ ] 50+ 实体场景下每帧表达式解析+求值总开销 < 2ms
7. [ ] 表达式随场景导出/导入正确序列化
8. [ ] 表达式力与力场力正确叠加为合力

---

*Phase: 04-表达式驱动外加力*
*Context gathered: 2026-05-24*
