/**
 * doubleArcGeometry — 双弧圆轨道几何核心（纯函数）
 *
 * 双弧圆轨道 = 同圆心的内/外两道环壁，在 XY 竖直平面内形成环形通道
 * （弧关于 +Y 轴对称，arcAngleDeg=360 时为整环）。
 * 通道宽度 channelGap 即「内径」：直径等于它的球应顺畅通过。
 *
 * 防卡顿设计（紧配球同时接触两壁，面片错位会改变有效通道宽度 → 夹死）：
 * 1. 内外壁楔块同相位分段（相同 θ 步进与边界角）→ 通道宽度沿弧恒定
 * 2. 外环壁内接触面用外接弦：顶点半径 R/cos(δ)（δ=半段角），弦中点与
 *    理想圆相切 → 通道宽度处处 ≥ 名义值，永不夹球（仅剩毫米级外凸小坎）
 * 3. 内环壁外接触面用内接弦（顶点在理想圆上）→ 微内凹坑，滚动比凸坎平滑
 * 4. 接触面 = ARC_SKIN 薄壳楔块 + 主体楔块的双层结构（同 arcGeometry）
 */

import { ARC_SKIN, arcAngles, arcSectorOutline, wedgePoints, type ArcParams } from './arcGeometry';

export const DOUBLEARC_DEFAULT_SEGMENTS = 48;

/**
 * 内径游隙（防紧配预紧/摩擦锁死）：
 * 直径恰等于 channelGap 的球若零间隙夹在两面之间，接触求解会产生预紧力，
 * 摩擦随之放大数倍把球锁死（用户反馈的「莫名其妙的卡顿」）。
 * 对策：外环壁接触面外移 ε（视觉同步外移），保证直径=内径的球始终有真实游隙。
 * ε = max(5mm, 2% × channelGap)——对 0.6m 内径仅 +12mm，视觉不可辨。
 */
export const DOUBLEARC_CLEARANCE_RATIO = 0.02;
export const DOUBLEARC_MIN_CLEARANCE = 0.005;

export function channelClearance(channelGap: number): number {
  return Math.max(DOUBLEARC_MIN_CLEARANCE, channelGap * DOUBLEARC_CLEARANCE_RATIO);
}

export interface DoubleArcParams {
  innerR: number;       // 内环壁接触面半径（通道内界, m）
  channelGap: number;   // 通道宽度 = 内外环壁间距（内径, m）
  thickness: number;    // 每道环壁的径向厚度 (m)
  arcAngleDeg: number;  // 弧角（度，对称于 +Y 轴；360 = 整环）
  width: number;        // 轨道宽度（Z 方向, m）
  segments?: number;    // 分解段数（默认 48）
}

export type DoubleArcFaceId = 'innerWall' | 'outerWall' | 'body';

export interface DoubleArcWedge {
  faceId: DoubleArcFaceId;
  /** 3D 顶点集（8 点：剖面 4 点 × ±width/2），供 convexHull collider */
  points: Float32Array;
}

/**
 * 双弧圆轨道楔块分解：4×segments 个凸棱柱
 * （内环壁 壳+主体、外环壁 壳+主体，同相位分段）。
 */
export function computeDoubleArcWedges(params: DoubleArcParams): DoubleArcWedge[] {
  const { innerR, channelGap, thickness, arcAngleDeg, width } = params;
  const segments = Math.max(8, Math.round(params.segments ?? DOUBLEARC_DEFAULT_SEGMENTS));
  const [t0, t1] = arcAngles(arcAngleDeg);
  const step = (t1 - t0) / segments;
  const delta = step / 2; // 半段角（外接弦修正用）

  // 外环壁内接触面（有效半径）= 名义 rOut + 内径游隙 ε（防紧配预紧，见 channelClearance）
  const rOut = innerR + channelGap + channelClearance(channelGap);
  const rOutCirc = rOut / Math.cos(delta);   // 外接弦顶点半径（弦中点与理想圆相切）

  const wedges: DoubleArcWedge[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = t0 + i * step;
    const a1 = a0 + step;

    // 内环壁：壳层 [innerR−SKIN, innerR]（内接弦接触面）+ 主体 [innerR−thickness, innerR−SKIN]
    wedges.push({
      faceId: 'innerWall',
      points: wedgePoints(a0, a1, innerR - ARC_SKIN, innerR, width),
    });
    wedges.push({
      faceId: 'body',
      points: wedgePoints(a0, a1, innerR - thickness, innerR - ARC_SKIN, width),
    });

    // 外环壁：壳层 [rOutCirc, rOut+SKIN]（外接弦接触面，弦中点半径 = rOut）
    // 与主体 [rOut+SKIN, rOut+thickness]（壳层内端嵌入主体，同体重叠无自碰）
    wedges.push({
      faceId: 'outerWall',
      points: wedgePoints(a0, a1, rOutCirc, rOut + ARC_SKIN, width),
    });
    wedges.push({
      faceId: 'body',
      points: wedgePoints(a0, a1, rOut + ARC_SKIN, rOut + thickness, width),
    });
  }
  return wedges;
}

/**
 * 两条环带的完整扇区剖面（视觉 ExtrudeGeometry 用）：
 * 内环带 [innerR−thickness, innerR]，外环带 [rOut, rOut+thickness]。
 */
export function doubleArcBandOutlines(
  params: DoubleArcParams,
): { inner: [number, number][]; outer: [number, number][] } {
  const { innerR, channelGap, thickness, arcAngleDeg, width } = params;
  const segments = Math.max(8, Math.round(params.segments ?? DOUBLEARC_DEFAULT_SEGMENTS));
  const arcSteps = Math.max(48, segments);
  const rOut = innerR + channelGap + channelClearance(channelGap); // 与碰撞一致（含游隙）
  const mk = (bandInnerR: number): [number, number][] =>
    arcSectorOutline(
      { innerR: bandInnerR, thickness, arcAngleDeg, width } satisfies ArcParams,
      arcSteps,
    );
  return {
    inner: mk(innerR - thickness),
    outer: mk(rOut),
  };
}

/**
 * 双弧圆轨道面拾取：命中点+法线 → 'innerWall' | 'outerWall' | 'body'。
 * 按点半径分区（< 通道中径 → 内壁区），法线径向点积判方向：
 * 内壁区法线背向圆心（dot > 0.3）→ 内环壁；外壁区法线指向圆心（dot < −0.3）→ 外环壁。
 */
export function pickDoubleArcFace(
  params: Pick<DoubleArcParams, 'innerR' | 'channelGap'>,
  localPoint: [number, number, number],
  localNormal: [number, number, number],
): DoubleArcFaceId {
  const r = Math.hypot(localPoint[0], localPoint[1]);
  if (r < 1e-6) return 'body';
  const radialDot = (localNormal[0] * localPoint[0] + localNormal[1] * localPoint[1]) / r;
  const midR = params.innerR + (params.channelGap + channelClearance(params.channelGap)) / 2;
  if (r <= midR && radialDot > 0.3) return 'innerWall';
  if (r > midR && radialDot < -0.3) return 'outerWall';
  return 'body';
}
