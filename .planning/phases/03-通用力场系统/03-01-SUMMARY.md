---
phase: 03-通用力场系统
plan: 01
status: completed
completed_at: 2026-05-17
---

# Plan 03-01 SUMMARY — ECS 类型扩展 + Entity 工厂

## 完成范围

### Task 1: ECS 类型定义（`frontend/src/ecs/types.ts`）
- `ComponentType` union 追加 `'forceField'`。
- `RigidBodyComponent` 新增 `charge: number` 必需字段（D-03-02）。
- 新增 ForceField 判别联合（D-03-01 / D-03-03）：
  - `ForceFieldKind = 'uniform' | 'gravity' | 'electric' | 'magnetic'`
  - `BaseForceFieldComponent`（含 `position`, `range`）
  - `UniformFieldComponent`、`GravityFieldComponent`、`ElectricFieldComponent`、`MagneticFieldComponent`
  - `ForceFieldComponent` 判别联合（kind 为辨别器）
- `AnyComponent` 追加 `ForceFieldComponent`。

### Task 2: Entity 工厂（`frontend/src/ecs/Entity.ts`）
- 四个形状工厂（`createSphereEntity` / `createBoxEntity` / `createCylinderEntity` / `createSlopeEntity`）的 `RigidBodyComponent` 字面量统一注入 `charge: 0`。
- 新增 `createForceFieldEntity<K extends ForceFieldKind>(kind, position, range, params)`：
  - ID 前缀 `forcefield-${n}`，name 格式 `力场-${kind}-${n}`，使用全局 `nextNumber()`。
  - 装配 `transform + forceField` 组件，复用 `createEntity`（默认带 `trail/vector` 不再多余）。
- 导出 `ForceFieldKindParams` 类型映射，供 03-03 对话框确认回调使用。

### 测试同步
- `types.test.ts`：原 RigidBody 测试补 `charge: 0`，新增 charge 非零用例 + 6 个 ForceField 判别联合用例。
- `Entity.test.ts`：补 sphere `charge=0` 默认值用例 + 两个 `createForceFieldEntity` 用例（ID 前缀、组件构成）。
- `runtime-prop-sync.test.tsx`：手工构造的 `RigidBodyComponent` 补 `charge: 0`（次生影响）。

## 验证

- `cd frontend && npx tsc --noEmit --skipLibCheck` — 通过。
- `cd frontend && npx vitest run src/ecs/__tests__/` — **43 passed / 0 failed**（types + Entity + 现有 Component 测试）。

## 文件变更

| 文件 | 性质 |
|------|------|
| `frontend/src/ecs/types.ts` | 修改 |
| `frontend/src/ecs/Entity.ts` | 修改 |
| `frontend/src/ecs/__tests__/types.test.ts` | 修改 |
| `frontend/src/ecs/__tests__/Entity.test.ts` | 修改 |
| `frontend/src/__tests__/runtime-prop-sync.test.tsx` | 修改（补 charge 默认） |

## 决策与偏差

- **`ForceFieldKindParams` 类型映射**：用泛型 `K extends ForceFieldKind` + 映射类型替代了 PLAN 中宽泛的 `params: ...` 描述。让 03-03 调用方在 TS 层就能精确约束 params 形状。
- **`runtime-prop-sync.test.tsx` 修改**未列入 PLAN files_modified，但是 D-03-02 把 `charge` 设为必需字段的连锁后果——只能在引用处加 `0`。
- **scene schema 与 serializer 暂未扩展 charge 字段**：留给 Plan 03-05（PLAN 自身已经包含 sceneSerializer/sceneValidation 扩展），03-01 不越界。

## 下游影响

- Plan 03-02 `forceFieldCalc.ts` 已可基于 `ForceFieldComponent` 判别联合按 kind 分派物理函数。
- Plan 03-03 `ForceFieldDialog` 可调用 `createForceFieldEntity` 工厂，参数类型由 `ForceFieldKindParams[K]` 提供。
- Plan 03-05 sceneSerializer 需在 `SerializedRigidBodyComponent` 增 `charge` 字段并补 schema validation。
