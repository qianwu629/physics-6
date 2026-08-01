/**
 * doubleArcGeometry 单元测试 — 双弧圆轨道楔块分解 / 通道宽度恒定 / 面拾取
 */
import { describe, it, expect } from 'vitest';
import {
  computeDoubleArcWedges,
  doubleArcBandOutlines,
  pickDoubleArcFace,
  channelClearance,
  DOUBLEARC_DEFAULT_SEGMENTS,
  type DoubleArcParams,
} from '../doubleArcGeometry';
import { ARC_SKIN } from '../arcGeometry';

const params: DoubleArcParams = {
  innerR: 3,
  channelGap: 0.6,
  thickness: 0.5,
  arcAngleDeg: 360,
  width: 2,
  segments: 48,
};

const rOut = params.innerR + params.channelGap; // 3.6（名义）
const eps = channelClearance(params.channelGap); // 0.012（游隙）
const rOutEff = rOut + eps; // 3.612（有效外环壁内表面）

/** 第 i 个顶点的半径（XY 平面） */
function radiusOf(points: Float32Array, i: number): number {
  return Math.hypot(points[i * 3], points[i * 3 + 1]);
}

/** 第 i 个顶点的角度 */
function angleOf(points: Float32Array, i: number): number {
  return Math.atan2(points[i * 3 + 1], points[i * 3]);
}

describe('computeDoubleArcWedges', () => {
  it('Test 1: 楔块数 = 4×segments，faceId 按 innerWall/body/outerWall/body 循环', () => {
    const wedges = computeDoubleArcWedges(params);
    expect(wedges).toHaveLength(4 * 48);
    for (let i = 0; i < wedges.length; i += 4) {
      expect(wedges[i].faceId).toBe('innerWall');
      expect(wedges[i + 1].faceId).toBe('body');
      expect(wedges[i + 2].faceId).toBe('outerWall');
      expect(wedges[i + 3].faceId).toBe('body');
    }
  });

  it('Test 2: 每楔块 8 个 3D 顶点，z = ±width/2', () => {
    const wedges = computeDoubleArcWedges(params);
    for (const w of [wedges[0], wedges[2], wedges[wedges.length - 1]]) {
      expect(w.points.length).toBe(24);
      for (let i = 0; i < 8; i++) {
        expect(Math.abs(w.points[i * 3 + 2])).toBeCloseTo(1, 10);
      }
    }
  });

  it('Test 3: 内环壁壳层外表面顶点恰好在 innerR 上（内接弦）', () => {
    const skin = computeDoubleArcWedges(params)[0]; // innerWall 壳层
    // quad 顶点序：内θ0, 内θ1, 外θ1, 外θ0（+4 为 −z 侧）
    for (const vi of [2, 3, 6, 7]) {
      expect(radiusOf(skin.points, vi)).toBeCloseTo(params.innerR, 5);
    }
    for (const vi of [0, 1, 4, 5]) {
      expect(radiusOf(skin.points, vi)).toBeCloseTo(params.innerR - ARC_SKIN, 5);
    }
  });

  it('Test 4: 外环壁壳层内表面为外接弦（含游隙）— 顶点 > rOutEff 且弦中点半径 ≈ rOutEff', () => {
    const segments = 48;
    const delta = (2 * Math.PI) / segments / 2;
    const rOutCirc = rOutEff / Math.cos(delta);
    const skin = computeDoubleArcWedges(params)[2]; // outerWall 壳层
    // 内侧两顶点（0,1）半径 = rOutCirc
    expect(radiusOf(skin.points, 0)).toBeCloseTo(rOutCirc, 6);
    expect(radiusOf(skin.points, 1)).toBeCloseTo(rOutCirc, 6);
    // 弦中点（顶点 0/1 连线中点）半径 = rOutCirc·cos(δ) = rOutEff（通道不变窄）
    const mx = (skin.points[0] + skin.points[3]) / 2;
    const my = (skin.points[1] + skin.points[4]) / 2;
    expect(Math.hypot(mx, my)).toBeGreaterThanOrEqual(rOutEff - 1e-9);
    expect(Math.hypot(mx, my)).toBeCloseTo(rOutEff, 6);
  });

  it('Test 5: 内外壁同相位分段 — 对应楔块边界角一致', () => {
    const wedges = computeDoubleArcWedges(params);
    for (let i = 0; i < 4 * 4; i += 4) {
      const inner = wedges[i];
      const outer = wedges[i + 2];
      expect(angleOf(inner.points, 0)).toBeCloseTo(angleOf(outer.points, 0), 5);
      expect(angleOf(inner.points, 1)).toBeCloseTo(angleOf(outer.points, 1), 5);
    }
  });

  it('Test 6: 有效通道宽度处处 ≥ 名义 gap + 游隙修正（紧配球有真实游隙）', () => {
    const wedges = computeDoubleArcWedges(params);
    const segments = 48;
    const delta = (2 * Math.PI) / segments / 2;
    for (let i = 0; i < segments; i++) {
      const innerSkin = wedges[i * 4].points;
      const outerSkin = wedges[i * 4 + 2].points;
      // 内壁接触面弦中点（顶点 2/3 中点）半径
      const inMx = (innerSkin[2 * 3] + innerSkin[3 * 3]) / 2;
      const inMy = (innerSkin[2 * 3 + 1] + innerSkin[3 * 3 + 1]) / 2;
      const rInMid = Math.hypot(inMx, inMy);
      expect(rInMid).toBeCloseTo(params.innerR * Math.cos(delta), 6);
      // 外壁接触面弦中点（顶点 0/1 中点）半径（含游隙）
      const outMx = (outerSkin[0] + outerSkin[3]) / 2;
      const outMy = (outerSkin[1] + outerSkin[4]) / 2;
      const rOutMid = Math.hypot(outMx, outMy);
      // 弦中点处通道宽度 = rOutMid − rInMid ≥ gap（游隙保证 > 名义值）
      expect(rOutMid - rInMid).toBeGreaterThanOrEqual(params.channelGap);
      expect(rOutMid).toBeCloseTo(rOutEff, 6);
    }
  });

  it('Test 7: 部分弧角（90°）与默认段数（48）均可用', () => {
    const partial = computeDoubleArcWedges({ ...params, arcAngleDeg: 90, segments: 16 });
    expect(partial).toHaveLength(4 * 16);
    const def = computeDoubleArcWedges({ innerR: 2, channelGap: 0.5, thickness: 0.4, arcAngleDeg: 180, width: 1.5 });
    expect(def).toHaveLength(4 * DOUBLEARC_DEFAULT_SEGMENTS);
  });
});

describe('doubleArcBandOutlines', () => {
  it('Test 8: 内环带半径 [innerR−thickness, innerR]，外环带 [rOutEff, rOutEff+thickness]', () => {
    const { inner, outer } = doubleArcBandOutlines(params);
    expect(inner.length).toBeGreaterThan(0);
    expect(outer.length).toBeGreaterThan(0);
    for (const [x, y] of inner) {
      const r = Math.hypot(x, y);
      expect(r).toBeGreaterThanOrEqual(params.innerR - params.thickness - 1e-6);
      expect(r).toBeLessThanOrEqual(params.innerR + 1e-6);
    }
    for (const [x, y] of outer) {
      const r = Math.hypot(x, y);
      expect(r).toBeGreaterThanOrEqual(rOutEff - 1e-6);
      expect(r).toBeLessThanOrEqual(rOutEff + params.thickness + 1e-6);
    }
  });
});

describe('channelClearance（内径游隙）', () => {
  it('Test 10: ε = max(5mm, 2%×gap)', () => {
    expect(channelClearance(0.6)).toBeCloseTo(0.012, 10);
    expect(channelClearance(0.2)).toBeCloseTo(0.005, 10); // 2% < 5mm → 取下限
    expect(channelClearance(2)).toBeCloseTo(0.04, 10);
  });
});

describe('pickDoubleArcFace', () => {
  const p = { innerR: 3, channelGap: 0.6 };

  it('Test 9: 内壁区法线背向圆心 → innerWall；外壁区指向圆心 → outerWall；其余 → body', () => {
    // 内环壁接触面点（r=3，法线背向圆心 +Y）
    expect(pickDoubleArcFace(p, [0, 3, 0], [0, 1, 0])).toBe('innerWall');
    // 外环壁接触面点（r=3.6，法线指向圆心 −Y）
    expect(pickDoubleArcFace(p, [0, 3.6, 0], [0, -1, 0])).toBe('outerWall');
    // 内环带外圆背面（r=2.5，法线指向圆心）→ body
    expect(pickDoubleArcFace(p, [0, 2.5, 0], [0, -1, 0])).toBe('body');
    // 端面（切向法线）→ body
    expect(pickDoubleArcFace(p, [3.3, 0, 0], [0, -1, 0])).toBe('body');
    // 侧面（z 法线）→ body
    expect(pickDoubleArcFace(p, [0, 3.3, 1], [0, 0, 1])).toBe('body');
  });
});
