/**
 * arcGeometry 单元测试 — 圆弧轨道楔块分解 / 剖面 / 面拾取
 */
import { describe, it, expect } from 'vitest';
import { computeArcWedges, arcSectorOutline, pickArcFace, arcAngles, ARC_SKIN } from '../arcGeometry';

const params = { innerR: 3, thickness: 0.5, arcAngleDeg: 90, width: 2, segments: 12 };

describe('computeArcWedges', () => {
  it('Test 1: 楔块数 = 2×segments，inner/outer 交替成对', () => {
    const wedges = computeArcWedges(params);
    expect(wedges).toHaveLength(24);
    expect(wedges[0].faceId).toBe('inner');
    expect(wedges[1].faceId).toBe('outer');
    expect(wedges[2].faceId).toBe('inner');
  });

  it('Test 2: 每楔块 8 个 3D 顶点，z = ±width/2', () => {
    const wedges = computeArcWedges(params);
    const w = wedges[0];
    expect(w.points.length).toBe(24);
    for (let i = 0; i < 8; i++) {
      expect(Math.abs(w.points[i * 3 + 2])).toBeCloseTo(1, 10);
    }
  });

  it('Test 3: inner 楔块半径在 [innerR, innerR+SKIN]，outer 在 [innerR+SKIN, innerR+thickness]', () => {
    const wedges = computeArcWedges(params);
    const inner = wedges[0];
    const outer = wedges[1];
    for (let i = 0; i < 8; i++) {
      const ri = Math.hypot(inner.points[i * 3], inner.points[i * 3 + 1]);
      expect(ri).toBeGreaterThanOrEqual(3 - 1e-6);
      expect(ri).toBeLessThanOrEqual(3 + ARC_SKIN + 1e-6);
      const ro = Math.hypot(outer.points[i * 3], outer.points[i * 3 + 1]);
      expect(ro).toBeGreaterThanOrEqual(3 + ARC_SKIN - 1e-6);
      expect(ro).toBeLessThanOrEqual(3.5 + 1e-6);
    }
  });

  it('Test 4: 90° 弧关于 +Y 轴对称 — 首尾楔块角度边界正确', () => {
    const [t0, t1] = arcAngles(90);
    expect(t0).toBeCloseTo(Math.PI / 4, 10);
    expect(t1).toBeCloseTo((3 * Math.PI) / 4, 10);
    const wedges = computeArcWedges(params);
    // 第一个楔块第一点角度 = t0
    const w = wedges[0];
    expect(Math.atan2(w.points[1], w.points[0])).toBeCloseTo(t0, 6);
    // 最后一个楔块第二点角度 ≈ t1
    const last = wedges[wedges.length - 1];
    expect(Math.atan2(last.points[4], last.points[3])).toBeCloseTo(t1, 6);
  });
});

describe('arcSectorOutline', () => {
  it('Test 5: 剖面闭合且点数 = 2×(arcSteps+1)，内外半径正确', () => {
    const outline = arcSectorOutline(params, 24);
    expect(outline).toHaveLength(50);
    const first = outline[0];
    expect(Math.hypot(first[0], first[1])).toBeCloseTo(3, 6);
    const mid = outline[25];
    expect(Math.hypot(mid[0], mid[1])).toBeCloseTo(3.5, 6);
  });
});

describe('pickArcFace', () => {
  it('Test 6: 法线指向圆心 → inner；背向 → outer', () => {
    // 命中内弧面点 (0, 3, 0)，法线指向圆心 (0,-1,0)
    expect(pickArcFace([0, 3, 0], [0, -1, 0])).toBe('inner');
    // 外弧面点，法线背向圆心
    expect(pickArcFace([0, 3.5, 0], [0, 1, 0])).toBe('outer');
    // 端面（法线沿切向）→ outer
    expect(pickArcFace([2.1, 2.1, 0], [0.7, -0.7, 0])).toBe('outer');
    // 侧面（法线沿 z）→ outer
    expect(pickArcFace([0, 3, 1], [0, 0, 1])).toBe('outer');
  });
});
