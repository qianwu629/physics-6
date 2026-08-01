/**
 * 面摩擦几何 — 把每个形状的「面」分解为独立 collider 规格（纯函数核心）
 *
 * 物理模型（W3）：
 * - 每个面一个独立 collider，各自携带摩擦系数；接触摩擦 = 两面系数相乘
 *   （Rapier CoefficientCombineRule.Multiply，由 EntityRenderer 统一设置）。
 * - 固定面（pinned）摩擦系数取 ∞（实现 1e6），接触点不发生相对滑动。
 * - 分解方式：
 *   cuboid       → 6 个薄板（壳层近似；同体 collider 之间不自碰）
 *   cylinder     → 上/下薄板 + 中段圆柱（上底/下底/侧面）
 *   sphere       → 1 个 ball（光滑曲面无法分面）
 *   convexProfile→ 每面多边形 + 质心构成凸锥（凸分解，数学上严格铺满体积）
 *   arc          → 2×segments 凸楔块（内弧壳层滑动面 + 主体）
 *   doubleArc    → 4×segments 凸楔块（内外环壁 壳+主体；外壁内表面外接弦防夹球）
 * - 面 collider 密度为 0，质量完全来自 setAdditionalMass（手填质量语义不变）。
 */

import type { ColliderShape, ColliderParams } from './types';
import { extrudeProfile, profileCentroid, revolveProfile } from './profileGeometry';
import { computeArcWedges } from './arcGeometry';
import { computeDoubleArcWedges } from './doubleArcGeometry';

// ── 面定义（UI 列表） ──

export interface FaceDefinition {
  id: string;
  label: string;
}

export function getShapeFaces(shape: ColliderShape, params: ColliderParams): FaceDefinition[] {
  switch (shape) {
    case 'sphere':
      return [{ id: 'surface', label: '球面' }];
    case 'cuboid':
      return [
        { id: 'top', label: '上面' },
        { id: 'bottom', label: '底面' },
        { id: 'front', label: '前面' },
        { id: 'back', label: '后面' },
        { id: 'right', label: '右面' },
        { id: 'left', label: '左面' },
      ];
    case 'cylinder':
      return [
        { id: 'top', label: '上底面' },
        { id: 'bottom', label: '下底面' },
        { id: 'side', label: '侧面' },
      ];
    case 'convexProfile': {
      // 车削（revolve）：回转面光滑，整面处理（同球体）
      if (params.mode === 'revolve') {
        return [{ id: 'surface', label: '回转面' }];
      }
      const n = params.profile?.length ?? 0;
      return [
        { id: 'top', label: '顶面' },
        { id: 'bottom', label: '底面' },
        ...Array.from({ length: n }, (_, i) => ({ id: `side-${i}`, label: `侧面 ${i + 1}` })),
      ];
    }
    case 'arc':
      // 圆弧轨道：内弧滑动面 + 主体（外弧/端面/侧面合并）
      return [
        { id: 'inner', label: '内弧面' },
        { id: 'outer', label: '主体面' },
      ];
    case 'doubleArc':
      // 双弧圆轨道：内环壁（通道内界）+ 外环壁（通道外界）+ 主体（端面/侧面/背面合并）
      return [
        { id: 'innerWall', label: '内环壁' },
        { id: 'outerWall', label: '外环壁' },
        { id: 'body', label: '主体' },
      ];
    default:
      return [];
  }
}

// ── 面 collider 分解 ──

export type FaceColliderSpec =
  | { faceId: string; shape: 'ball'; args: [radius: number]; position?: [number, number, number] }
  | { faceId: string; shape: 'cuboid'; args: [number, number, number]; position: [number, number, number] }
  | { faceId: string; shape: 'cylinder'; args: [halfHeight: number, radius: number]; position: [number, number, number] }
  | { faceId: string; shape: 'convexHull'; args: [Float32Array]; position?: [number, number, number] };

/** 面壳厚度（m） */
export const FACE_SKIN = 0.02;

export function computeFaceColliders(shape: ColliderShape, params: ColliderParams): FaceColliderSpec[] {
  const t = FACE_SKIN;
  const half = t / 2;

  switch (shape) {
    case 'sphere':
      return [{ faceId: 'surface', shape: 'ball', args: [params.radius ?? 1] }];

    case 'cuboid': {
      const hw = params.halfWidth ?? 1;
      const hh = params.halfHeight ?? 1;
      const hd = params.halfDepth ?? 1;
      return [
        { faceId: 'top', shape: 'cuboid', args: [hw, half, hd], position: [0, hh - half, 0] },
        { faceId: 'bottom', shape: 'cuboid', args: [hw, half, hd], position: [0, -(hh - half), 0] },
        { faceId: 'front', shape: 'cuboid', args: [hw, hh, half], position: [0, 0, hd - half] },
        { faceId: 'back', shape: 'cuboid', args: [hw, hh, half], position: [0, 0, -(hd - half)] },
        { faceId: 'right', shape: 'cuboid', args: [half, hh, hd], position: [hw - half, 0, 0] },
        { faceId: 'left', shape: 'cuboid', args: [half, hh, hd], position: [-(hw - half), 0, 0] },
      ];
    }

    case 'cylinder': {
      const hh = params.halfHeight ?? 1;
      const r = params.radius ?? 0.5;
      return [
        { faceId: 'top', shape: 'cylinder', args: [half, r], position: [0, hh - half, 0] },
        { faceId: 'bottom', shape: 'cylinder', args: [half, r], position: [0, -(hh - half), 0] },
        // 中段圆柱：侧面即原侧面；平顶/底被薄板内面覆盖（同体不自碰）
        { faceId: 'side', shape: 'cylinder', args: [Math.max(hh - t, half), r], position: [0, 0, 0] },
      ];
    }

    case 'convexProfile': {
      // 车削（revolve）：单个整体凸包 collider，面 = 回转面
      if (params.mode === 'revolve') {
        const pts = revolveProfile(params.profile ?? []);
        if (pts.length < 12) return [];
        return [{ faceId: 'surface', shape: 'convexHull', args: [pts] }];
      }

      const profile = params.profile ?? [];
      const thickness = params.thickness ?? 1;
      const n = profile.length;
      if (n < 3) return [];
      const halfT = thickness / 2;
      const [cx, cy] = profileCentroid(profile);
      const apex: [number, number, number] = [cx, cy, 0];

      const specs: FaceColliderSpec[] = [];

      // 顶/底面：轮廓环 + 质心 → 凸锥
      for (const [faceId, z] of [['top', halfT], ['bottom', -halfT]] as const) {
        const pts = new Float32Array((n + 1) * 3);
        for (let i = 0; i < n; i++) {
          pts[i * 3] = profile[i][0];
          pts[i * 3 + 1] = profile[i][1];
          pts[i * 3 + 2] = z;
        }
        pts[n * 3] = apex[0];
        pts[n * 3 + 1] = apex[1];
        pts[n * 3 + 2] = apex[2];
        specs.push({ faceId, shape: 'convexHull', args: [pts] });
      }

      // 侧面：每条轮廓边是一个四边形（±t/2 两个端点 ×2）+ 质心 → 凸锥
      for (let i = 0; i < n; i++) {
        const [x0, y0] = profile[i];
        const [x1, y1] = profile[(i + 1) % n];
        const pts = new Float32Array(5 * 3);
        pts.set([x0, y0, halfT, x1, y1, halfT, x1, y1, -halfT, x0, y0, -halfT, ...apex], 0);
        specs.push({ faceId: `side-${i}`, shape: 'convexHull', args: [pts] });
      }

      return specs;
    }

    case 'arc': {
      // 圆弧轨道：2×segments 凸楔块（inner 内壳滑动面 + outer 主体）
      const wedges = computeArcWedges({
        innerR: params.innerR ?? 3,
        thickness: params.thickness ?? 0.5,
        arcAngleDeg: params.arcAngle ?? 90,
        width: params.width ?? 2,
        segments: params.segments,
      });
      return wedges.map((w) => ({ faceId: w.faceId, shape: 'convexHull' as const, args: [w.points] as [Float32Array] }));
    }

    case 'doubleArc': {
      // 双弧圆轨道：4×segments 凸楔块（内外环壁 壳+主体，同相位；外壁内表面外接弦防夹球）
      const wedges = computeDoubleArcWedges({
        innerR: params.innerR ?? 3,
        channelGap: params.channelGap ?? 0.6,
        thickness: params.thickness ?? 0.5,
        arcAngleDeg: params.arcAngle ?? 360,
        width: params.width ?? 2,
        segments: params.segments,
      });
      return wedges.map((w) => ({ faceId: w.faceId, shape: 'convexHull' as const, args: [w.points] as [Float32Array] }));
    }

    default:
      return [];
  }
}

/** 供序列化/测试/渲染用的完整顶点集（按成型方式派生） */
export function computeHullPoints(shape: ColliderShape, params: ColliderParams): Float32Array {
  if (shape === 'convexProfile') {
    if (params.mode === 'revolve') {
      return revolveProfile(params.profile ?? []);
    }
    return extrudeProfile(params.profile ?? [], params.thickness ?? 1);
  }
  return new Float32Array(0);
}
