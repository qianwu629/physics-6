/**
 * 物理场景类型定义 — @deprecated
 *
 * Phase 1: 硬编码场景的数据结构。
 * Phase 2: 被 ECS 组件化架构取代 (src/ecs/types.ts)。
 * 此文件仅保留用于向后参考，所有类型应在 Phase 3+ 移除。
 *
 * 迁移指南:
 * - SceneObject → Entity (src/ecs/types.ts)
 * - SceneObject.shape → ColliderComponent.shape (src/ecs/components/Collider.ts)
 * - SceneObject.kind → RigidBodyComponent.kind (src/ecs/components/RigidBody.ts)
 * - SceneObject.position → TransformComponent.position (src/ecs/components/Transform.ts)
 * - SceneObject.color → MaterialComponent.color (src/ecs/components/Material.ts)
 */

/** @deprecated Use RigidBodyKind from src/ecs/types.ts */
export type RigidBodyKind = 'dynamic' | 'fixed';

/** @deprecated Use ColliderShape from src/ecs/types.ts */
export type ColliderShape = 'sphere' | 'cuboid' | 'cylinder';

/** @deprecated Use Entity from src/ecs/types.ts */
export interface SceneObject {
  /** 唯一标识 */
  id: string;
  /** 显示名称（调试用） */
  name: string;
  /** 刚体类型: dynamic=受重力影响, fixed=静态（地面/斜面） */
  kind: RigidBodyKind;
  /** 碰撞体形状 */
  shape: ColliderShape;
  /** 形状参数 — 球体: [radius], 方块: [halfWidth, halfHeight, halfDepth], 圆柱: [halfHeight, radius] */
  shapeArgs: [number, number, number];
  /** 初始位置 [x, y, z] */
  position: [number, number, number];
  /** 初始旋转 [x, y, z]（欧拉角，弧度） — 例如斜面需要绕 Z 轴旋转 */
  rotation: [number, number, number];
  /** 物体颜色 (hex 字符串，如 '#7eb8da') — D-03: 随机柔和色彩 */
  color: string;
  /** 弹性系数 (restitution), 0=完全非弹性, 1=完全弹性 */
  restitution: number;
}
