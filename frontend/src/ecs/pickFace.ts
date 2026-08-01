/**
 * pickFace — 3D 预览中 raycast 命中点/法线 → 逻辑面 id（纯函数核心）
 *
 * 约定与 faceGeometry.getShapeFaces 的面 id 一一对应：
 * - cuboid: 命中法线主轴 → top/bottom/right/left/front/back
 * - cylinder: 法线 |ny|≈1 → top/bottom；否则 side
 * - sphere / convexProfile(revolve): 唯一面 surface
 * - convexProfile(extrude): 法线 |nz|≈1 → top/bottom；否则与 N 个侧面外法线取最大点积 → side-i
 */

import type { ColliderShape, ColliderParams } from './types';
import { profileCentroid } from './profileGeometry';
import { pickArcFace } from './arcGeometry';
import { pickDoubleArcFace } from './doubleArcGeometry';

export type Vec3Tuple = [number, number, number];

/** 主轴方向（含符号）最大分量索引；ties 取先出现者 */
function dominantAxis(v: Vec3Tuple): { axis: 0 | 1 | 2; sign: 1 | -1 } {
  const ax = Math.abs(v[0]);
  const ay = Math.abs(v[1]);
  const az = Math.abs(v[2]);
  if (ay >= ax && ay >= az) return { axis: 1, sign: v[1] >= 0 ? 1 : -1 };
  if (ax >= az) return { axis: 0, sign: v[0] >= 0 ? 1 : -1 };
  return { axis: 2, sign: v[2] >= 0 ? 1 : -1 };
}

const CUBOID_FACE_BY_AXIS: Record<string, string> = {
  '0,1': 'right',
  '0,-1': 'left',
  '1,1': 'top',
  '1,-1': 'bottom',
  '2,1': 'front',
  '2,-1': 'back',
};

/** 挤出凸形第 i 条边的外法线（XY 平面内，背离质心） */
function sideOutwardNormal(
  profile: [number, number][],
  i: number,
  centroid: [number, number],
): [number, number] {
  const [x0, y0] = profile[i];
  const [x1, y1] = profile[(i + 1) % profile.length];
  const ex = x1 - x0;
  const ey = y1 - y0;
  let nx = ey;
  let ny = -ex;
  const len = Math.hypot(nx, ny);
  if (len < 1e-9) return [0, 0];
  nx /= len;
  ny /= len;
  // 边中点背离质心方向为外
  const mx = (x0 + x1) / 2 - centroid[0];
  const my = (y0 + y1) / 2 - centroid[1];
  if (nx * mx + ny * my < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [nx, ny];
}

export function pickFace(
  shape: ColliderShape,
  params: ColliderParams,
  localPoint: Vec3Tuple,
  localNormal: Vec3Tuple,
): string | null {
  switch (shape) {
    case 'sphere':
      return 'surface';

    case 'cuboid': {
      const { axis, sign } = dominantAxis(localNormal);
      return CUBOID_FACE_BY_AXIS[`${axis},${sign}`] ?? null;
    }

    case 'cylinder': {
      if (Math.abs(localNormal[1]) > 0.9) return localNormal[1] > 0 ? 'top' : 'bottom';
      return 'side';
    }

    case 'convexProfile': {
      if (params.mode === 'revolve') return 'surface';
      const profile = params.profile ?? [];
      if (profile.length < 3) return null;
      // 顶/底面：法线沿 z
      if (Math.abs(localNormal[2]) > 0.9) return localNormal[2] > 0 ? 'top' : 'bottom';
      // 侧面：与 N 个侧向外法线取最大点积
      const centroid = profileCentroid(profile);
      let best = -Infinity;
      let bestId: string | null = null;
      for (let i = 0; i < profile.length; i++) {
        const [nx, ny] = sideOutwardNormal(profile, i, centroid);
        const dot = nx * localNormal[0] + ny * localNormal[1];
        if (dot > best) {
          best = dot;
          bestId = `side-${i}`;
        }
      }
      return bestId;
    }

    case 'arc':
      return pickArcFace(localPoint, localNormal);

    case 'doubleArc':
      return pickDoubleArcFace(
        { innerR: params.innerR ?? 3, channelGap: params.channelGap ?? 0.6 },
        localPoint,
        localNormal,
      );

    default:
      return null;
  }
}
