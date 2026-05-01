export type { ColliderComponent, ColliderShape, ColliderParams } from '../types';

/** 默认球体碰撞参数 (radius=1.0) */
export const SPHERE_DEFAULT_PARAMS = { radius: 1.0 };
/** 默认方块碰撞参数 (1x1x1 立方体 half-extents) */
export const CUBOID_DEFAULT_PARAMS = { halfWidth: 1.0, halfHeight: 1.0, halfDepth: 1.0 };
/** 默认圆柱碰撞参数 (halfHeight=1.0, radius=0.5) */
export const CYLINDER_DEFAULT_PARAMS = { halfHeight: 1.0, radius: 0.5 };
