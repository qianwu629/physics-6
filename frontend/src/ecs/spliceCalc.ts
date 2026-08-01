/**
 * spliceCalc — 轨道拼接计算核心（纯函数，P5）
 *
 * 拼接面定义（轨道局部系）：
 * - plane：四个竖直侧边（left/right/front/back）
 * - slope：低端侧面（end-low，+x 端）与高端侧面（end-high，−x 端）（斜面绕 z 旋转前的局部系）
 * - arc：两个端面（end-0/end-1，弧角两端，法线径向）
 *
 * 拼接位姿：新轨道的「入口面」（entry face）与母版被点面重合、法线反向共线：
 *   R = quaternion(entryNormal → −masterNormal)
 *   newCenter = masterCenter − R · entryCenter
 */

import * as THREE from 'three';
import type { ColliderShape, ColliderParams } from './types';
import { arcAngles } from './arcGeometry';
import { profileCentroid } from './profileGeometry';

export type Vec3Tuple = [number, number, number];

export interface SpliceFace {
  faceId: string;
  label: string;
  center: Vec3Tuple;  // 局部坐标
  normal: Vec3Tuple;  // 局部单位法线
  width: number;      // 面宽（接缝检测盒横向尺寸）
}

/** 各轨道类型的拼接面（局部系） */
export function getSpliceFaces(shape: ColliderShape, params: ColliderParams): SpliceFace[] {
  switch (shape) {
    case 'cuboid': {
      const hw = params.halfWidth ?? 1;
      const hd = params.halfDepth ?? 1;
      // 斜面与平面同为 cuboid：四个竖直侧边都可拼（斜面通常只用 ±x 两端，但四边定义一致更通用）
      return [
        { faceId: 'left', label: '左端', center: [-hw, 0, 0], normal: [-1, 0, 0], width: hd * 2 },
        { faceId: 'right', label: '右端', center: [hw, 0, 0], normal: [1, 0, 0], width: hd * 2 },
        { faceId: 'front', label: '前端', center: [0, 0, hd], normal: [0, 0, 1], width: hw * 2 },
        { faceId: 'back', label: '后端', center: [0, 0, -hd], normal: [0, 0, -1], width: hw * 2 },
      ];
    }
    case 'arc': {
      const midR = (params.innerR ?? 3) + (params.thickness ?? 0.5) / 2;
      const [t0, t1] = arcAngles(params.arcAngle ?? 90);
      const w = params.width ?? 2;
      return [
        {
          faceId: 'end-0',
          label: '端面 1',
          center: [Math.cos(t0) * midR, Math.sin(t0) * midR, 0],
          normal: [Math.cos(t0), Math.sin(t0), 0],
          width: w,
        },
        {
          faceId: 'end-1',
          label: '端面 2',
          center: [Math.cos(t1) * midR, Math.sin(t1) * midR, 0],
          normal: [Math.cos(t1), Math.sin(t1), 0],
          width: w,
        },
      ];
    }
    case 'doubleArc': {
      // 双弧圆轨道：通道口两端面（通道中径处，法线径向朝外）
      const midR = (params.innerR ?? 3) + (params.channelGap ?? 0.6) / 2;
      const [t0, t1] = arcAngles(params.arcAngle ?? 360);
      const w = params.width ?? 2;
      return [
        {
          faceId: 'end-0',
          label: '通道口 1',
          center: [Math.cos(t0) * midR, Math.sin(t0) * midR, 0],
          normal: [Math.cos(t0), Math.sin(t0), 0],
          width: w,
        },
        {
          faceId: 'end-1',
          label: '通道口 2',
          center: [Math.cos(t1) * midR, Math.sin(t1) * midR, 0],
          normal: [Math.cos(t1), Math.sin(t1), 0],
          width: w,
        },
      ];
    }
    case 'convexProfile': {
      // 楔形斜面（梯形轮廓）：薄端 = 边 1，厚端 = 边 3（其余轮廓不定义拼接面）
      const profile = params.profile ?? [];
      const thickness = params.thickness ?? 1;
      if (profile.length !== 4) return [];
      const centroid = profileCentroid(profile);
      const mk = (edgeIdx: number, faceId: string, label: string): SpliceFace => {
        const [x0, y0] = profile[edgeIdx];
        const [x1, y1] = profile[(edgeIdx + 1) % 4];
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        // 外法线 = 边方向旋转 -90°（背离质心校正）
        const ex = x1 - x0;
        const ey = y1 - y0;
        let nx = ey;
        let ny = -ex;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        if (nx * (cx - centroid[0]) + ny * (cy - centroid[1]) < 0) {
          nx = -nx;
          ny = -ny;
        }
        return { faceId, label, center: [cx, cy, 0], normal: [nx, ny, 0], width: thickness };
      };
      return [mk(1, 'thin-end', '薄端'), mk(3, 'thick-end', '厚端')];
    }
    default:
      return [];
  }
}

/** 新轨道的默认入口面（拼接时被贴合到母版上的那个面） */
export function getEntryFace(shape: ColliderShape, params: ColliderParams): SpliceFace | null {
  switch (shape) {
    case 'cuboid': {
      const faces = getSpliceFaces(shape, params);
      return faces.find((f) => f.faceId === 'left') ?? null;
    }
    case 'arc': {
      const faces = getSpliceFaces(shape, params);
      return faces.find((f) => f.faceId === 'end-0') ?? null;
    }
    case 'doubleArc': {
      // 双弧圆轨道：通道口 1 对接母版
      const faces = getSpliceFaces(shape, params);
      return faces.find((f) => f.faceId === 'end-0') ?? null;
    }
    case 'convexProfile': {
      // 楔形斜面：薄端对接母版（低边连续到母版表面）
      const faces = getSpliceFaces(shape, params);
      return faces.find((f) => f.faceId === 'thin-end') ?? null;
    }
    default:
      return null;
  }
}

/** 世界系拼接面（母版 transform 作用后） */
export function toWorldFace(
  face: SpliceFace,
  position: Vec3Tuple,
  eulerRotation: Vec3Tuple,
): SpliceFace {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...eulerRotation, 'XYZ'));
  const c = new THREE.Vector3(...face.center).applyQuaternion(q).add(new THREE.Vector3(...position));
  const n = new THREE.Vector3(...face.normal).applyQuaternion(q).normalize();
  return { ...face, center: [c.x, c.y, c.z], normal: [n.x, n.y, n.z] };
}

export interface SplicePose {
  position: Vec3Tuple;
  rotation: Vec3Tuple; // 欧拉角 XYZ (rad)
}

/**
 * 计算新轨道的拼接位姿：
 * 入口面法线 → −母版面法线（最短弧），入口面心落到母版面心。
 * 特例：法线反向（≈180°）时强制绕世界 Y 轴翻转——
 * setFromUnitVectors 对反向向量取任意垂直轴，可能把楔形翻成底朝天。
 */
export function computeSplicePose(
  masterFaceWorld: { center: Vec3Tuple; normal: Vec3Tuple },
  entryFace: SpliceFace,
): SplicePose {
  const entryN = new THREE.Vector3(...entryFace.normal).normalize();
  const targetN = new THREE.Vector3(...masterFaceWorld.normal).normalize().negate();

  let q: THREE.Quaternion;
  if (entryN.dot(targetN) < -0.999) {
    // 反向：绕竖直轴翻 180°，保证楔形/轨道保持正立（所有拼接面法线均水平）
    q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  } else {
    q = new THREE.Quaternion().setFromUnitVectors(entryN, targetN);
  }

  const entryC = new THREE.Vector3(...entryFace.center).applyQuaternion(q);
  const masterC = new THREE.Vector3(...masterFaceWorld.center);
  const newPos = masterC.clone().sub(entryC);

  const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return {
    position: [newPos.x, newPos.y, newPos.z],
    rotation: [euler.x, euler.y, euler.z],
  };
}

/**
 * 命中点（轨道局部系）→ 最近拼接面：
 * 取 dot(normal, point − face.center) 最大的面（点最强烈地处于该面外侧）。
 */
export function pickSpliceFace(
  faces: SpliceFace[],
  localPoint: Vec3Tuple,
): SpliceFace | null {
  let best: SpliceFace | null = null;
  let bestScore = -Infinity;
  for (const f of faces) {
    const score =
      f.normal[0] * (localPoint[0] - f.center[0]) +
      f.normal[1] * (localPoint[1] - f.center[1]) +
      f.normal[2] * (localPoint[2] - f.center[2]);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

/** 接缝检测盒（seam 局部系：x=法线方向薄壳，y=竖直，z=面宽） */
export function computeSeamBox(
  masterFaceWorld: { center: Vec3Tuple; normal: Vec3Tuple },
  entryFace: SpliceFace,
): { center: Vec3Tuple; normal: Vec3Tuple; halfExtents: Vec3Tuple; quaternion: [number, number, number, number] } {
  const n = new THREE.Vector3(...masterFaceWorld.normal).normalize();
  // seam 局部 x 轴 = 法线；构造旋转把 +x 对齐到法线
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), n);
  return {
    center: [...masterFaceWorld.center],
    normal: [n.x, n.y, n.z],
    halfExtents: [0.3, 2, entryFace.width / 2 + 0.2],
    quaternion: [q.x, q.y, q.z, q.w],
  };
}
