---
phase: 03-通用力场系统
plan: 04
subsystem: ui
tags: [three.js, instancedMesh, shaderMaterial, react-three-fiber, force-field, visualization]

requires:
  - phase: 03-01
    provides: ECS ForceField types + Entity factory
  - phase: 03-02
    provides: ForceFieldSystem physics injection
  - phase: 03-03
    provides: ForceFieldDialog UI + store integration

provides:
  - ForceFieldRenderer.tsx: 4-kind force field 3D visualization
  - Scene3D.tsx: ForceFieldRenderer mounted outside Physics
  - EntityRenderer.tsx: forceField entity early-return skip

affects:
  - 03-05 (force line serialization + presets)

tech-stack:
  added: []
  patterns:
    - "InstancedMesh for batched arrow rendering (uniform/magnetic fields)"
    - "ShaderMaterial with radial alpha falloff for point-source fields"
    - "Physics-external JSX for non-physical visual-only entities"

key-files:
  created:
    - frontend/src/components/ForceFieldRenderer.tsx
  modified:
    - frontend/src/components/Scene3D.tsx
    - frontend/src/components/EntityRenderer.tsx

key-decisions:
  - "ForceFieldRenderer placed OUTSIDE Physics component — force fields have no colliders/rigidBodies"
  - "EntityRenderer early-returns null for forceField entities — dual guard with Scene3D filter"
  - "InstancedMesh with 200-instance cap (T-03-09) — auto density reduction when exceeded"
  - "Radial transparency shader: alpha = 0.35 * (1 - smoothstep(0, 1, dist/radius))"

patterns-established:
  - "Visualization-only ECS entities: no rigidBody/collider, rendered by dedicated component outside Physics"
  - "InstancedMesh batching for uniform grid patterns with density cap"

requirements-completed:
  - FIELD-03

metrics:
  duration: 5min
  completed: 2026-05-23
---

# Phase 03 Plan 04: 力场 3D 可视化 Summary

**InstancedMesh arrow grids for uniform/magnetic fields + ShaderMaterial radial spheres for gravity/electric fields, mounted outside Physics with EntityRenderer skip guard**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-23T12:05:38Z
- **Completed:** 2026-05-23T12:10:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ForceFieldRenderer component rendering all 4 force field kinds with correct visual metaphors
- Arrow matrix (InstancedMesh) for uniform direction fields and magnetic fields
- Radial transparency spheres (ShaderMaterial) for gravity sources and electric charges
- Color coding: uniform=blue, magnetic=purple, gravity=light blue-gray, electric=red/blue/gray by charge sign
- Scene3D mounts ForceFieldRenderer outside Physics (no physical body needed)
- EntityRenderer skips forceField entities to avoid missing collider/material warnings

## Task Commits

1. **Task 1: ForceFieldRenderer 组件** - `b5cf781` (feat)
2. **Task 2: Scene3D 挂载 + EntityRenderer 跳过力场实体** - `895a7c9` (feat)

## Files Created/Modified
- `frontend/src/components/ForceFieldRenderer.tsx` - 新组件：4 种力场 3D 可视化渲染
  - UniformFieldArrows: InstancedMesh 箭头矩阵（2m 间距，max 200 实例）
  - GravityFieldSphere: 径向透明度衰减半透明球体
  - ElectricFieldSphere: 电荷正负色区分（红/蓝/灰）
  - ShaderMaterial: 顶点/片段着色器实现中心 opacity 0.35 向边缘衰减到 0
- `frontend/src/components/Scene3D.tsx` - 挂载 ForceFieldRenderer 在 Physics 外部
- `frontend/src/components/EntityRenderer.tsx` - 力场实体 early-return null（避免 collider 缺失警告）

## Decisions Made
- ForceFieldRenderer 放在 Physics 外部：力场实体没有 rigidBody/collider，不需要物理世界参与
- EntityRenderer 双重保险：Scene3D 的 filter 已排除 constraint 实体，EntityRenderer 再对 forceField 做 early-return
- 箭头长度固定 0.8m（不随强度变化）：均匀场强度处处相等，视觉一致性优先
- T-03-09 防护：实例数上限 200，超出时自动增大间距降低密度

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- npm install 需要运行以恢复 typescript 依赖（node_modules 缺失），安装后 tsc 编译通过
- Windows 平台 tsc 路径问题：使用 `npx tsc` 在依赖安装后正常工作

## Next Phase Readiness

- 03-05（力线 + 序列化 + 预设）可继续执行
- ForceFieldRenderer 已提供可视化基础，03-05 可在此基础上添加力线（line segments）和预设场景

## Self-Check

- [x] `frontend/src/components/ForceFieldRenderer.tsx` 存在
- [x] `frontend/src/components/Scene3D.tsx` 包含 ForceFieldRenderer 引用
- [x] `frontend/src/components/EntityRenderer.tsx` 包含 forceField 跳过逻辑
- [x] TypeScript 编译通过（`npx tsc --noEmit --skipLibCheck`）
- [x] 提交 `b5cf781` 存在
- [x] 提交 `895a7c9` 存在

---
*Phase: 03-通用力场系统*
*Completed: 2026-05-23*
