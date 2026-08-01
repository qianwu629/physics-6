/**
 * arcGeometry — 圆弧轨道几何核心（纯函数）
 *
 * 圆弧面 = 内半径 innerR 的凹形滑动面 + 厚度 thickness 的实心环扇。
 * 剖面（XY 平面，圆心在原点，弧关于 +Y 轴对称，凹面朝上）非凸，
 * 物理上按 segments 分解为凸梯形楔块（每块 extrude 成凸棱柱）：
 * - 内壳楔块 [innerR, innerR+SKIN]：滑动面 collider（面 id 'inner'）
 * - 主体楔块 [innerR+SKIN, innerR+thickness]：主体 collider（面 id 'outer'）
 * 视觉用完整扇区 ExtrudeGeometry（凹面光滑显示，与楔块近似一致）。
 */

export const ARC_SKIN = 0.02; // 内壳厚度 (m)
export const ARC_DEFAULT_SEGMENTS = 12;

export interface ArcParams {
  innerR: number;      // 内弧半径 (m)
  thickness: number;   // 环扇厚度 (m)
  arcAngleDeg: number; // 弧角（度，对称于 +Y 轴）
  width: number;       // 轨道宽度（Z 方向, m）
  segments?: number;   // 分解段数（默认 12）
}

export interface ArcWedge {
  faceId: 'inner' | 'outer';
  /** 3D 顶点集（8 点：剖面 4 点 × ±width/2），供 convexHull collider */
  points: Float32Array;
}

/** 角度 → 单位向量（XY 平面，0°=+X，逆时针） */
function dir(theta: number): [number, number] {
  return [Math.cos(theta), Math.sin(theta)];
}

/** 生成一个楔块（θ0→θ1、r0→r1 的梯形环段）的 3D 挤出顶点集 */
export function wedgePoints(theta0: number, theta1: number, r0: number, r1: number, width: number): Float32Array {
  const [c0, s0] = dir(theta0);
  const [c1, s1] = dir(theta1);
  // 剖面 4 点（梯形）：内θ0 → 内θ1 → 外θ1 → 外θ0
  const quad: [number, number][] = [
    [c0 * r0, s0 * r0],
    [c1 * r0, s1 * r0],
    [c1 * r1, s1 * r1],
    [c0 * r1, s0 * r1],
  ];
  const half = width / 2;
  const pts = new Float32Array(8 * 3);
  for (let i = 0; i < 4; i++) {
    pts[i * 3] = quad[i][0];
    pts[i * 3 + 1] = quad[i][1];
    pts[i * 3 + 2] = half;
    pts[(i + 4) * 3] = quad[i][0];
    pts[(i + 4) * 3 + 1] = quad[i][1];
    pts[(i + 4) * 3 + 2] = -half;
  }
  return pts;
}

/** 起始角/终止角（rad，关于 +Y 轴对称） */
export function arcAngles(arcAngleDeg: number): [number, number] {
  const half = (arcAngleDeg * Math.PI) / 360;
  return [Math.PI / 2 - half, Math.PI / 2 + half];
}

/**
 * 圆弧轨道楔块分解：2×segments 个凸棱柱。
 */
export function computeArcWedges(params: ArcParams): ArcWedge[] {
  const { innerR, thickness, arcAngleDeg, width } = params;
  const segments = Math.max(3, Math.round(params.segments ?? ARC_DEFAULT_SEGMENTS));
  const [t0, t1] = arcAngles(arcAngleDeg);
  const step = (t1 - t0) / segments;

  const wedges: ArcWedge[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = t0 + i * step;
    const a1 = a0 + step;
    wedges.push({
      faceId: 'inner',
      points: wedgePoints(a0, a1, innerR, innerR + ARC_SKIN, width),
    });
    wedges.push({
      faceId: 'outer',
      points: wedgePoints(a0, a1, innerR + ARC_SKIN, innerR + thickness, width),
    });
  }
  return wedges;
}

/**
 * 完整扇区剖面（视觉用）：内弧 θ0→θ1（半径 innerR）+ 外弧 θ1→θ0（半径 innerR+thickness）。
 * 返回闭合折线（XY 平面）。
 */
export function arcSectorOutline(params: ArcParams, arcSteps = 24): [number, number][] {
  const { innerR, thickness, arcAngleDeg } = params;
  const [t0, t1] = arcAngles(arcAngleDeg);
  const outerR = innerR + thickness;
  const pts: [number, number][] = [];
  for (let i = 0; i <= arcSteps; i++) {
    const t = t0 + ((t1 - t0) * i) / arcSteps;
    const [c, s] = dir(t);
    pts.push([c * innerR, s * innerR]);
  }
  for (let i = arcSteps; i >= 0; i--) {
    const t = t0 + ((t1 - t0) * i) / arcSteps;
    const [c, s] = dir(t);
    pts.push([c * outerR, s * outerR]);
  }
  return pts;
}

/**
 * 圆弧面拾取：命中点+法线 → 'inner' | 'outer'。
 * 内弧面法线指向圆心（法线·径向 < -0.3）；其余（外弧/端面/侧面）→ 'outer'。
 */
export function pickArcFace(localPoint: [number, number, number], localNormal: [number, number, number]): 'inner' | 'outer' {
  const r = Math.hypot(localPoint[0], localPoint[1]);
  if (r < 1e-6) return 'outer';
  const dot = (localNormal[0] * localPoint[0] + localNormal[1] * localPoint[1]) / r;
  return dot < -0.3 ? 'inner' : 'outer';
}
