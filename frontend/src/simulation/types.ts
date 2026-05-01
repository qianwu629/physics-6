/**
 * 物理场景类型定义
 *
 * Phase 1: 硬编码场景的数据结构。
 * 注意：这些类型在 Phase 2 将被组件化 ECS 系统取代（ARCHITECTURE.md Pattern 1）。
 * 当前设计保持简洁以服务引擎验证目的（D-12: 严禁模板模式）。
 */

/** 刚体类型 */
export type RigidBodyKind = 'dynamic' | 'fixed';

/** 碰撞体形状 */
export type ColliderShape = 'sphere' | 'cuboid' | 'cylinder';

/** 单个场景物体的初始定义 */
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
