---
phase: 01-持久化与场景库
plan: 01
subsystem: 持久化引擎
tags: [serialization, deserialization, zod, validation, json, ecs]
requires: [Entity.ts, types.ts, simulationSlice.ts]
provides: [sceneSerializer.ts, sceneValidation.ts]
affects: []
tech-stack:
  added: []
  patterns: [Zod discriminatedUnion, Zod .default() fallback, tolerant JSON loading, Map-to-Object conversion, createEntity factory deserialization]
key-files:
  created:
    - frontend/src/utils/sceneValidation.ts (Zod Schema + 校验函数, 207 lines)
    - frontend/src/utils/sceneValidation.test.ts (10 tests)
    - frontend/src/utils/sceneSerializer.ts (序列化/反序列化引擎, 265 lines)
    - frontend/src/utils/sceneSerializer.test.ts (14 tests)
  modified: []
decisions:
  - "schemaVersion 不匹配使用宽容模式加载（D-01-02）: validateSceneJSON 和 deserializeScene 均返回 success=true + warnings"
  - "trail/vector 组件不序列化（D-01-01）: serializeScene 显式跳过 trail 和 vector 组件"
  - "反序列化使用 createEntity 工厂（安全构造，D-01-03）: 自动附加 trail/vector 默认组件"
  - "约束实体引用失效跳过（D-01-08）: 失效的 entityAId/entityBId 记录警告并删除约束实体"
  - "5MB 文件大小硬限制（D-01-08）: importJSONToScene 入口处检查 jsonString.length > 5MB"
metrics:
  duration: ~27 min
  completed_date: "2026-05-04"
---

# Phase 1 Plan 1: 场景序列化/反序列化引擎 Summary

构建 ECS 状态与 JSON 之间的双向转换引擎，提供 Zod Schema 校验和宽容加载逻辑，为导出/导入/快照/预设提供统一数据转换层。

---

## One-Liner

"场景 JSON 序列化/反序列化引擎 — 将 ECS Map 状态转换为 D-01-01 Schema JSON，从 JSON 还原为 Entity Map，包含 Zod Schema 验证和分级错误处理（版本不匹配宽容模式、5MB 硬限制、约束引用失效跳过）。"

---

## Tasks Executed

| # | Name | Type | TDD | Commit | Files |
|---|------|------|-----|--------|-------|
| 1 | 定义场景序列化类型 + Zod Schema + 校验函数 | auto | yes | `b942b58` | sceneValidation.ts, sceneValidation.test.ts |
| 2 | 实现场景序列化/反序列化引擎 | auto | yes | `c5a0945` | sceneSerializer.ts, sceneSerializer.test.ts |

---

## Verification Results

```
npx vitest run src/utils/sceneSerializer.test.ts src/utils/sceneValidation.test.ts
✓ 2 test files passed (2)
✓ 24 tests passed (24)
  - sceneValidation: 10 tests PASS
  - sceneSerializer: 14 tests PASS
```

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `serializeScene(storeState)` 返回符合 D-01-01 Schema 的 SceneData（不含 trail/vector） | PASS |
| 2 | `deserializeScene(validJSON)` 成功还原 Entity Map，数量与类型一致 | PASS |
| 3 | `deserializeScene(invalidJSON)` 返回 success=false + errors（不抛异常） | PASS |
| 4 | `deserializeScene(mismatchedVersion)` 返回 success=true + warnings（D-01-02） | PASS |
| 5 | 往返序列化幂等：serialize(deserialize(serialize(state))) === serialize(state) | PASS |
| 6 | 24 个单元测试全部 PASS | PASS |

---

## Exports

### sceneValidation.ts

| Export | Type | Description |
|--------|------|-------------|
| `SceneSchema` | Zod Schema | 场景整体 Schema（含 environment, entities, constraints） |
| `EntitySchema` | Zod Schema | 实体 Schema（discriminatedUnion 组件类型校验） |
| `validateSceneJSON` | Function | 宽容模式场景 JSON 校验 |
| `isVersionMismatch` | Function | 检查 schemaVersion 是否非 "1.0" |
| `SceneData` | Type | 序列化场景数据结构 |
| `SerializedEntity` | Type | 序列化实体类型 |
| `SerializedComponent` | Type | 序列化组件联合类型 |
| `ValidationResult` | Type | 校验结果结构 |

### sceneSerializer.ts

| Export | Type | Description |
|--------|------|-------------|
| `serializeScene` | Function | ECS 状态 → SceneData |
| `deserializeScene` | Function | JSON → ECS 状态 (entities Map + environment) |
| `exportSceneToJSON` | Function | ECS 状态 → 格式化 JSON 字符串 |
| `importJSONToScene` | Function | JSON 字符串 → ECS 状态（含 5MB 限制） |
| `ImportResult` | Type | 导入结果（entities Map + environment） |
| Re-exports | Types | SceneData, SerializedEntity, SerializedComponent, ValidationResult |

---

## Key Implementation Details

### 序列化流程

```
Map<string, Entity> + EnvironmentState
  → 遍历 entities，排除 trail/vector
  → 约束实体 → simulation.constraints
  → 非约束实体 → simulation.entities
  → 设置 schemaVersion="1.0" + savedAt=ISO 8601
```

### 反序列化流程

```
unknown JSON
  → validateSceneJSON (Zod 宽容校验)
  → createEntity(id, name, []) 工厂重建 Entity
  → 逐组件填充到 entity.components Map
  → 约束引用检查 (entityAId/entityBId 失效 → 警告 + 跳过)
  → 返回 { entities: Map, environment }
```

### 宽容模式 (D-01-02)

- `schemaVersion` 不匹配 → `success: true` + 警告
- 未知顶层字段 → 忽略 + 警告
- 未知组件类型 → 过滤 + 警告
- Zod 校验仅报告结构性错误为硬错误

---

## Deviations from Plan

### TDD Process

**1. [Process] TDD RED phase bypassed for Task 1**
- **Found during:** Task 1 implementation
- **Issue:** Implementation was written alongside tests, no standalone RED phase (tests never failed before implementation existed)
- **Fix:** Test file and implementation committed as a single `feat` commit. Tests validated as passing post-implementation.
- **Files modified:** N/A
- **Commit:** `b942b58` (combined implementation + tests for Task 1)

### Infrastructure

**2. [Rule 3 - Blocking] Worktree missing node_modules**
- **Found during:** Task 1 test execution
- **Issue:** Worktree at `.claude/worktrees/agent-*` had no node_modules, tests could not run
- **Fix:** Created symlink from worktree's `frontend/node_modules` to main repo's `frontend/node_modules`
- **Files modified:** N/A (symlink only)

---

## Known Stubs

None — all data flows are wired: serializeScene produces real SceneData, deserializeScene produces real Map<Entity>, no hardcoded empty/mock values flow to data paths.

---

## Threat Flags

None — implementation adheres to all mitigations in the plan's threat model. ZodsafeParse validates all fields (T-01-01), 5MB file size check at importJSONToScene entry (T-01-02), createEntity factory used for safe construction (T-01-03). No new network endpoints, auth paths, or trust boundaries introduced.

---

## Self-Check: PASSED

- [x] `frontend/src/utils/sceneValidation.ts` — FOUND
- [x] `frontend/src/utils/sceneValidation.test.ts` — FOUND
- [x] `frontend/src/utils/sceneSerializer.ts` — FOUND
- [x] `frontend/src/utils/sceneSerializer.test.ts` — FOUND
- [x] `.planning/phases/01-持久化与场景库/01-01-SUMMARY.md` — FOUND
- [x] Commit `b942b58` — FOUND (Task 1: scene validation)
- [x] Commit `c5a0945` — FOUND (Task 2: serialization engine)
- [x] All 24 tests PASS (2 suites)

