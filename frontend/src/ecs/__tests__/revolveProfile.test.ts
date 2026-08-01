/**
 * revolveProfile / isValidRevolveProfile 单元测试 — 车削成型（二期）
 */
import { describe, it, expect } from 'vitest';
import { revolveProfile, isValidRevolveProfile, REVOLVE_SEGMENTS, type ProfilePoint } from '../profileGeometry';

const coneProfile: ProfilePoint[] = [[0, 0], [1.5, 0], [0, 2]]; // 直角三角形 → 圆锥

describe('revolveProfile', () => {
  it('Test 1: 顶点数 = n × segments', () => {
    const pts = revolveProfile(coneProfile);
    expect(pts.length).toBe(coneProfile.length * REVOLVE_SEGMENTS * 3);
  });

  it('Test 2: 环几何 — 轮廓点 (1.5, 0) 的环半径 1.5、高度 y=0', () => {
    const pts = revolveProfile(coneProfile, 24);
    // 第二个轮廓点（索引 1）的环：点数 24，每点 (1.5·cosθ, 0, 1.5·sinθ)
    const ringStart = 1 * 24 * 3;
    for (let s = 0; s < 24; s++) {
      const x = pts[ringStart + s * 3];
      const y = pts[ringStart + s * 3 + 1];
      const z = pts[ringStart + s * 3 + 2];
      expect(Math.hypot(x, z)).toBeCloseTo(1.5, 6);
      expect(y).toBe(0);
    }
  });

  it('Test 3: 轴上点（x=0）退化为重复单点', () => {
    const pts = revolveProfile(coneProfile, 24);
    // 第一个轮廓点 (0,0) 的环：所有点都在原点
    for (let s = 0; s < 24; s++) {
      expect(pts[s * 3]).toBeCloseTo(0, 10);
      expect(pts[s * 3 + 1]).toBeCloseTo(0, 10);
      expect(pts[s * 3 + 2]).toBeCloseTo(0, 10);
    }
  });

  it('Test 4: 自定义 segments 生效', () => {
    const pts = revolveProfile(coneProfile, 8);
    expect(pts.length).toBe(coneProfile.length * 8 * 3);
  });
});

describe('isValidRevolveProfile', () => {
  it('Test 5: 合法的半轮廓（x≥0 且凸）→ true', () => {
    expect(isValidRevolveProfile(coneProfile)).toBe(true);
    expect(isValidRevolveProfile([[0, -1], [1, -1], [1, 1], [0, 1]])).toBe(true);
  });

  it('Test 6: 含 x<0 顶点 → false', () => {
    expect(isValidRevolveProfile([[-0.5, 0], [1, 0], [0, 2]])).toBe(false);
  });

  it('Test 7: 非凸轮廓 → false', () => {
    // L 形（x 均 ≥0 但凹）
    expect(isValidRevolveProfile([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]])).toBe(false);
  });

  it('Test 8: 少于 3 点 → false', () => {
    expect(isValidRevolveProfile([[0, 0], [1, 1]])).toBe(false);
  });
});
