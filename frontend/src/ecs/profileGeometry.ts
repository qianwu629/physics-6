/**
 * 2D 轮廓几何 — 自定义凸形（挤出）的纯函数核心
 *
 * 轮廓定义在 XY 平面（[x, y] 顶点序列，顺/逆时针均可），
 * 挤出沿 Z 轴 ±thickness/2。顶点集同时供 THREE.ConvexGeometry（视觉）
 * 和 Rapier ConvexHullCollider（碰撞）使用——同一份数据保证所见即所得。
 */

export type ProfilePoint = [number, number];

const EPS = 1e-9;

/** 相邻三点 (a→b→c) 的 z 向叉积（>0 左转，<0 右转，0 共线） */
function crossZ(a: ProfilePoint, b: ProfilePoint, c: ProfilePoint): number {
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
}

/**
 * 凸性校验：所有相邻叉积符号一致（允许共线点）。
 * 少于 3 个顶点 → false；顺/逆时针任意；星形/L 形等凹轮廓 → false。
 */
export function isConvexProfile(points: ProfilePoint[]): boolean {
  const n = points.length;
  if (n < 3) return false;

  let sign = 0;
  for (let i = 0; i < n; i++) {
    const cross = crossZ(points[i], points[(i + 1) % n], points[(i + 2) % n]);
    if (Math.abs(cross) < EPS) continue; // 共线点不影响凸性判定
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0; // 全部共线（退化）→ false
}

/**
 * 挤出：2D 轮廓 → 3D 顶点集（顶环 + 底环，共 2N 点）。
 * 顶环 z=+thickness/2，底环 z=-thickness/2。
 */
export function extrudeProfile(profile: ProfilePoint[], thickness: number): Float32Array {
  const n = profile.length;
  const half = thickness / 2;
  const out = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = profile[i][0];
    out[i * 3 + 1] = profile[i][1];
    out[i * 3 + 2] = half;
    out[(n + i) * 3] = profile[i][0];
    out[(n + i) * 3 + 1] = profile[i][1];
    out[(n + i) * 3 + 2] = -half;
  }
  return out;
}

/** 轮廓质心（ shoelace 面积加权；退化时回退为顶点均值） */
export function profileCentroid(profile: ProfilePoint[]): ProfilePoint {
  const n = profile.length;
  if (n === 0) return [0, 0];
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = profile[i];
    const [x1, y1] = profile[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < EPS) {
    const mx = profile.reduce((s, p) => s + p[0], 0) / n;
    const my = profile.reduce((s, p) => s + p[1], 0) / n;
    return [mx, my];
  }
  area /= 2;
  return [cx / (6 * area), cy / (6 * area)];
}

// ── 车削（Revolve）— 二期 ──

/** 车削分段数（固定，二期不支持自定义） */
export const REVOLVE_SEGMENTS = 24;

/**
 * 车削：2D 轮廓（XY 平面，x ≥ 0）绕局部 Y 轴旋转 → 3D 顶点集。
 * 每个轮廓顶点 (x, y) 生成一个高度为 y、半径为 x 的环：
 * 点 = (x·cosθ, y, x·sinθ)，θ 均分 2π，共 n × segments 点。
 * 顶点集同时供 THREE.ConvexGeometry（视觉）和 ConvexHullCollider（碰撞）。
 */
export function revolveProfile(profile: ProfilePoint[], segments = REVOLVE_SEGMENTS): Float32Array {
  const n = profile.length;
  const out = new Float32Array(n * segments * 3);
  let w = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = profile[i];
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      out[w++] = x * Math.cos(theta);
      out[w++] = y;
      out[w++] = x * Math.sin(theta);
    }
  }
  return out;
}

/**
 * 车削轮廓合法性：全部顶点 x ≥ 0（轴的一侧）且闭合轮廓为凸形。
 */
export function isValidRevolveProfile(profile: ProfilePoint[]): boolean {
  if (profile.some(([x]) => x < -EPS)) return false;
  return isConvexProfile(profile);
}

// ── 楔形斜面（TrackBuilder/拼接用） ──

/**
 * 楔形斜面轮廓：梯形，薄端在 +x、厚端在 −x，顶面为斜坡。
 * profile（CCW）：(0,0) → (L,0) → (L,t) → (0,H)
 *   L = 2·halfWidth（弦长），H = L·tan(θ)（厚端高度），t = 薄端厚度
 * 薄端 = profile 边 1（(L,0)→(L,t)），厚端 = 边 3（(0,H)→(0,0)）。
 */
export function slopeWedgeProfile(halfWidth: number, angleDeg: number, thinT: number): ProfilePoint[] {
  const L = halfWidth * 2;
  const H = L * Math.tan((angleDeg * Math.PI) / 180);
  return [
    [0, 0],
    [L, 0],
    [L, thinT],
    [0, H],
  ];
}
