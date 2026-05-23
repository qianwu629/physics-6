---
phase: 03-通用力场系统
plan: 05
subsystem: frontend
---

# Phase 3 Plan 5: 力线可视化 + 序列化支持 + 点电荷预设场景

## 一句话总结

Toolbar 新增「力线」toggle 控制全局力线显示（LineSegments 静态几何），sceneSerializer 完整支持 forceField 组件和 charge 字段的序列化/反序列化，并新增点电荷力场教学预设场景。

## 任务完成情况

| # | 任务 | 状态 | Commit |
|---|------|------|--------|
| 1 | 力线可视化 + Toolbar toggle | 完成 | `51f26fd` |
| 2 | 序列化支持扩展 | 完成 | `84bccaa` |
| 3 | 点电荷力场预设场景 | 完成 | `2b27370` |
| - | Zod union 修复 + mock 补全 | 完成 | `af9d482` |

## 新增/修改文件

### Task 1: 力线可视化
- `src/store/visualizationStore.ts` — 新增 `showForceLines` / `toggleForceLines`
- `src/components/Toolbar.tsx` — 新增「力线」toggle 按钮
- `src/components/ForceFieldLines.tsx` — 新建：4 种力场的 LineSegments 渲染
- `src/components/Scene3D.tsx` — 挂载 `<ForceFieldLines />`

### Task 2: 序列化支持
- `src/utils/sceneValidation.ts` — 新增 ForceField Zod schemas、charge 字段、KNOWN_COMPONENT_TYPES 扩展
- `src/utils/sceneSerializer.ts` — KNOWN_COMPONENT_TYPES 追加 'forceField'
- `src/utils/sceneSerializer.test.ts` — 新增 3 个力场/电荷序列化测试

### Task 3: 预设场景
- `src/presets/point-charge.json` — 新建：2 带电球体 + 1 点电荷电场
- `src/components/PresetSelector.tsx` — 第 6 个预设卡片（Zap 图标）

### 修复
- `src/utils/sceneValidation.ts` — Zod discriminatedUnion 去重（forceField 用 kind 区分）
- `src/components/Scene3D.test.tsx` — mock 补全 `useBeforePhysicsStep`

## 关键决策

1. **力线数量上限（T-03-11）**：uniform/gravity/magnetic 各最多 64 条线，electric 最多 32 条（∝ |charge|，min 8），每条 20 段。用斐波那契球面分布保证均匀性。
2. **Zod schema 设计**：forceField 的 4 个子类型共用 `type: 'forceField'`，无法用单一层 discriminatedUnion('type') 区分；改为 `discriminatedUnion('kind')` 嵌套在 `z.union()` 中。
3. **静态几何策略**：`useMemo` 仅在力场实体变化时重建 BufferGeometry，避免每帧重算。

## 偏差记录

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod discriminatedUnion 重复 discriminator**
- **发现于**：Task 2 测试阶段
- **问题**：4 个 forceField schema 都使用 `type: z.literal('forceField')`，放入同一个 `z.discriminatedUnion('type')` 导致 Zod v4 抛 "Duplicate discriminator value"
- **修复**：将 forceField 子类型拆分为独立的 `z.discriminatedUnion('kind')`，再用 `z.union([BaseComponentSchema, ForceFieldSchema])` 合并
- **文件**：`src/utils/sceneValidation.ts`
- **Commit**：`af9d482`

**2. [Rule 1 - Bug] Scene3D 测试 mock 缺失 useBeforePhysicsStep**
- **发现于**：Task 2 全量测试阶段
- **问题**：`ForceFieldSystem` 组件（03-04 引入）使用 `@react-three/rapier` 的 `useBeforePhysicsStep`，但 Scene3D.test.tsx 的 mock 未导出该函数
- **修复**：在 mock 对象中添加 `useBeforePhysicsStep: vi.fn()`
- **文件**：`src/components/Scene3D.test.tsx`
- **Commit**：`af9d482`

## 验证结果

- TypeScript 编译通过（`tsc --noEmit --skipLibCheck`）
- 全部 309 个测试通过（1 todo）
- `point-charge.json` JSON 有效
- sceneSerializer.test.ts 新增 3 个测试全部通过

## 威胁标志

无新增威胁面。力线数量已按 T-03-11 限制，预设 JSON 为构建时内嵌不可写。

## 已知 Stub

无。所有功能已完整实现并测试通过。
