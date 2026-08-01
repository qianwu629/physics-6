/**
 * placementCalc — 虚影放置计算核心（纯函数）
 *
 * 流程：ObjectBuilder 配好物理量 → 虚影跟随鼠标在主场景中移动，
 * 吸附到已创建物体表面（含地面 y=0 兜底），滚轮微调高度，左键落位。
 *
 * 吸附模型：虚影中心 = 命中点 + 命中面法线 × 支撑距离 + (0, 滚轮高度, 0)。
 * 支撑距离 = 物体局部 AABB 角点沿法线方向的最大投影（物体「坐」在表面上）。
 */

import type { ColliderShape, ColliderParams } from './types';

export type Vec3Tuple = [number, number, number];

/** 物体局部系 AABB 的 8 个角点 */
export function boundsCorners(shape: ColliderShape, params: ColliderParams): Vec3Tuple[] {
  let hx = 1;
  let hy = 1;
  let hz = 1;

  switch (shape) {
    case 'sphere': {
      const r = params.radius ?? 1;
      hx = hy = hz = r;
      break;
    }
    case 'cuboid': {
      hx = params.halfWidth ?? 1;
      hy = params.halfHeight ?? 1;
      hz = params.halfDepth ?? 1;
      break;
    }
    case 'cylinder': {
      hx = hz = params.radius ?? 0.5;
      hy = params.halfHeight ?? 1;
      break;
    }
    case 'convexProfile': {
      // 轮廓点集 AABB（挤出 ±thickness/2；车削绕 Y 轴半径 = max|x|，y 为轮廓高）
      const profile = params.profile ?? [];
      if (profile.length === 0) break;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [x, y] of profile) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (params.mode === 'revolve') {
        const r = Math.max(Math.abs(minX), Math.abs(maxX));
        hx = hz = r;
        hy = Math.max(Math.abs(minY), Math.abs(maxY));
      } else {
        hx = Math.max(Math.abs(minX), Math.abs(maxX));
        hy = Math.max(Math.abs(minY), Math.abs(maxY));
        hz = (params.thickness ?? 1) / 2;
      }
      break;
    }
    default:
      break;
  }

  return [
    [hx, hy, hz],
    [hx, hy, -hz],
    [hx, -hy, hz],
    [hx, -hy, -hz],
    [-hx, hy, hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [-hx, -hy, -hz],
  ];
}

/** 支撑距离：角点沿法线方向的最大投影（物体底面贴合法线的偏移量） */
export function supportDistance(corners: Vec3Tuple[], normal: Vec3Tuple): number {
  let best = -Infinity;
  for (const c of corners) {
    const d = c[0] * normal[0] + c[1] * normal[1] + c[2] * normal[2];
    if (d > best) best = d;
  }
  return best === -Infinity ? 0 : best;
}

/**
 * 虚影中心位置：
 * hitPoint（世界）+ normal × supportDistance + (0, wheelHeight, 0)。
 * normal 需为单位向量（由调用方保证）。
 */
export function ghostPosition(
  hitPoint: Vec3Tuple,
  normal: Vec3Tuple,
  corners: Vec3Tuple[],
  wheelHeight: number,
): Vec3Tuple {
  const s = supportDistance(corners, normal);
  return [
    hitPoint[0] + normal[0] * s,
    hitPoint[1] + normal[1] * s + wheelHeight,
    hitPoint[2] + normal[2] * s,
  ];
}

/** 滚轮高度步进与上限 */
export const WHEEL_HEIGHT_STEP = 0.1;
export const WHEEL_HEIGHT_MAX = 50;
