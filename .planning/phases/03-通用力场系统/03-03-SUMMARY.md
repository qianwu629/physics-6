---
phase: 03-通用力场系统
plan: 03
status: completed
completed_at: 2026-05-17
---

# Plan 03-03 SUMMARY — 力场 UI（对话框 + 工具箱 + 属性面板）

## 完成范围

### Task 1：UI Store + Toolbox 按钮组（D-03-04 / D-03-05）
- `frontend/src/store/uiSlice.ts`：
  - 新增 `forceFieldDialogOpen: boolean`、`forceFieldDialogKind: ForceFieldKind | null` 两个状态字段。
  - 新增 `openForceFieldDialog(kind)` / `closeForceFieldDialog()` 两个 action（开关 + kind 同步置位/清空）。
  - 从 `../ecs/types` 导入 `ForceFieldKind` 类型，复用 03-01 的契约。
- `frontend/src/components/Toolbox.tsx`：
  - 引入 lucide-react 图标 `ArrowUp / Crosshair / Zap / Magnet`。
  - 弹簧按钮分隔线下方新增 `FORCE_FIELDS` 数组与渲染循环 —— 均匀方向场 / 点引力源 / 点电荷电场 / 均匀磁场。
  - 按钮点击调用 `openForceFieldDialog(kind)`，预选 kind；样式（w-10 h-10、hover/active）与原有形状按钮一致。

### Task 2：ForceFieldDialog（D-03-04）
- 新文件 `frontend/src/components/ForceFieldDialog.tsx`：
  - `z.discriminatedUnion('kind', [...])` 定义 4 种 kind 的字段验证（position/range/strength/direction/charge/decay）。
  - 4 图标顶部选择器（点击 `reset(getDefaultFormValues(kind))` 切换 schema 与默认值）。
  - 三段式布局：力场类型选择器 → 通用参数（中心位置 Vector3 + 作用范围 Slider） → 类型专用参数（按 selectedKind 动态显示 strength/direction/charge/decay）。
  - 确认调用 `createForceFieldEntity(kind, position, range, params)` + `addEntity(entity)`；返回 `false` 时 `setError('root', ...)`，root error 文案"场景已达到最大实体数量 (50 个)"。
  - useEffect 监听 `dialogOpen && dialogKind`，重置表单；onChange 模式实时校验，按钮按 `isFormValid` 启用。
- `frontend/src/components/App.tsx`：与 `<SpringCreationDialog />` 相邻处挂载 `<ForceFieldDialog />`（保持 dialog 模块化、独立 z-index 管理）。

### Task 3：PropertyPanel 力场分支 + rigidBody charge（D-03-06）
- `frontend/src/components/PropertyPanel.tsx`：
  - 引入 `ForceFieldComponent` / `ForceFieldKind` 类型；定义 `FORCE_FIELD_KIND_LABELS` 中文映射。
  - 提取 `forceField` 组件后置位 `isForceField = !!forceField`，**在 `isSpring` 分支之前**插入 `isForceField` 分支。
  - 力场分支渲染：
    - 类型只读显示（中文 label）。
    - 中心位置 Vector3Field（同步更新 `forceField.position` 与 `transform.position`）。
    - 作用范围 PhysicsField（0.1–100，米）。
    - 按 kind 动态显示：
      - uniform：方向 Vector3Field + 强度 Slider（-1000~1000 N）。
      - gravity：G·M 强度 Slider（0~10000）+ 1/r² 衰减 Switch。
      - electric：场源电荷 Slider（-100~100 C）+ 1/r² 衰减 Switch。
      - magnetic：B 场方向 Vector3Field + B 场强度 Slider（0~1000 T）。
    - 删除按钮（复用 `openDeleteDialog`）。
    - 所有字段通过 `updateComponent(id, 'forceField', partial)` 写回（共 6 处调用）。
  - 形状实体物理参数区（mass/restitution/friction 下方）新增电荷 PhysicsField（unit="C"，-10~10，step=0.1），通过 `updateComponent(id, 'rigidBody', { charge })` 写回。
  - 运行中（`disabled = isRunning`）所有字段自动只读（复用 PhysicsField/Vector3Field disabled 渲染）。

## 验证

- `cd frontend && npx tsc --noEmit --skipLibCheck`：通过（exit 0，无输出）。
- Done grep 标准全部达成：
  - `forceFieldDialogOpen` in uiSlice.ts：4 次（>=1 ✓）
  - `openForceFieldDialog` in uiSlice.ts：2 次（>=1 ✓）
  - `ArrowUp|Crosshair|Zap|Magnet` in Toolbox.tsx：5 次（>=4 ✓）
  - `ForceFieldDialog` in App.tsx：2 次（>=1 ✓，import + 挂载）
  - `z.discriminatedUnion` in ForceFieldDialog.tsx：1 次（>=1 ✓）
  - `createForceFieldEntity` in ForceFieldDialog.tsx：5 次（>=1 ✓）
  - `forceField` in PropertyPanel.tsx：42 次（>=3 ✓）
  - `charge` in PropertyPanel.tsx：5 次（>=2 ✓）
  - `updateComponent.*forceField` in PropertyPanel.tsx：6 次（>=1 ✓）
  - `updateComponent.*rigidBody.*charge` in PropertyPanel.tsx：1 次（>=1 ✓）

## 文件变更

| 文件 | 性质 | 说明 |
|------|------|------|
| `frontend/src/store/uiSlice.ts` | 修改 | +24 行 力场对话框状态 + actions |
| `frontend/src/components/Toolbox.tsx` | 修改 | +30 行 力场按钮组 + 分隔线 |
| `frontend/src/components/ForceFieldDialog.tsx` | 新增 | 440 行 Zod + react-hook-form 创建对话框 |
| `frontend/src/components/App.tsx` | 修改 | +2 行 挂载 ForceFieldDialog |
| `frontend/src/components/PropertyPanel.tsx` | 修改 | +258 行 力场分支 + charge 字段 + 6 个处理器 |
| `.planning/phases/03-通用力场系统/03-03-SUMMARY.md` | 新增 | 本文档 |

## 决策与偏差

### 1. 力场分支位置：放在 `isSpring` 之前
PLAN 写"在 isSpring 分支之前插入 isForceField 分支"。实际实现严格遵循，因为：
- ForceField 实体没有 constraint，原 isSpring 检测不会误触发；但显式按声明顺序前置可读性更好。
- 力场没有 collider，shape switch 分支若进入会显示"未知" — 把 isForceField 提前可彻底规避。
- 决策标记：`isForceField && forceField ? <力场UI> : isSpring ? <弹簧UI> : <形状UI>`。

### 2. 力场中心位置同步 transform.position
03-01 已确认力场实体的 `transform.position` 与 `forceField.position` 共享同一份数据（力场位置 = 实体的 transform）。PropertyPanel 在编辑力场中心位置时同时调用：
```ts
updateComponent(id, 'forceField', { position: newPos });
if (transform) updateComponent(id, 'transform', { position: newPos });
```
保持 transform/forceField 一致，避免可视化层 / 计算层读到不同位置。

### 3. position 字段精度：-100~100, step 0.1（PLAN 内未限制）
PLAN 未给中心位置 min/max。复用 Vector3Field 默认参数 range -100~100 step 0.1，与其他场景内坐标使用范围保持一致（场景大小约 100 m）。

### 4. 类型断言 `as Partial<ForceFieldComponent>`
`ForceFieldComponent` 是 4 种 kind 的联合（discriminated union），部分字段只在特定 kind 下存在（如 `decay` 不在 uniform/magnetic）。直接传 `{ decay: val }` 会触发 TS narrowing 错误，加 `as Partial<ForceFieldComponent>` 让 updateComponent 接受。这是 store 端 partial-update 模式的安全约束（运行时由调用方控制只在合法 kind 时调用对应 handler）。

### 5. 工具栏图标选择
PLAN 列出图标但没具体到图形——选用：
- 均匀方向场 → ArrowUp（方向感最强）
- 点引力源 → Crosshair（中心吸引隐喻）
- 点电荷电场 → Zap（电气标识）
- 均匀磁场 → Magnet（磁铁意象，最直观）
全部来自已使用的 lucide-react 库，不引入新依赖。

## 下游影响

- **03-04（力场可视化）**：UI 已能创建 forceField 实体并在 PropertyPanel 编辑全部参数；可视化层只需 read `forceField` 组件画箭头矩阵 / 半透明球体。
- **03-05（持久化）**：scene serializer 需要新增 `forceField` 组件序列化路径（已有 charge 字段在 RigidBody 中由 03-01 处理）。
- **后续 phase**：编辑器 UI 模式（创建对话框 → store action → entity factory）已稳定，可在 phase 5/6 复用。
