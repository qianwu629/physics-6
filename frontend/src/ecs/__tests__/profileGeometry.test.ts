/**
 * profileGeometry 单元测试 — 凸性校验 / 挤出 / 质心
 */
import { describe, it, expect } from 'vitest';
import { isConvexProfile, extrudeProfile, profileCentroid, type ProfilePoint } from '../profileGeometry';

const squareCCW: ProfilePoint[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const squareCW: ProfilePoint[] = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
const star: ProfilePoint[] = [
  [0, 2], [0.5, 0.5], [2, 0.5], [0.8, -0.3], [1.2, -2],
  [0, -1], [-1.2, -2], [-0.8, -0.3], [-2, 0.5], [-0.5, 0.5],
];
const lShape: ProfilePoint[] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];

describe('isConvexProfile', () => {
  it('Test 1: 凸四边形（顺/逆时针）→ true', () => {
    expect(isConvexProfile(squareCCW)).toBe(true);
    expect(isConvexProfile(squareCW)).toBe(true);
  });

  it('Test 2: 三角形 → true', () => {
    expect(isConvexProfile([[0, 0], [2, 0], [1, 1.5]])).toBe(true);
  });

  it('Test 3: 五角星 → false', () => {
    expect(isConvexProfile(star)).toBe(false);
  });

  it('Test 4: L 形 → false', () => {
    expect(isConvexProfile(lShape)).toBe(false);
  });

  it('Test 5: 少于 3 点 → false；全共线 → false', () => {
    expect(isConvexProfile([])).toBe(false);
    expect(isConvexProfile([[0, 0], [1, 1]])).toBe(false);
    expect(isConvexProfile([[0, 0], [1, 1], [2, 2]])).toBe(false);
  });

  it('Test 6: 边上的共线点不破坏凸性', () => {
    const withCollinear: ProfilePoint[] = [[-1, -1], [0, -1], [1, -1], [1, 1], [-1, 1]];
    expect(isConvexProfile(withCollinear)).toBe(true);
  });
});

describe('extrudeProfile', () => {
  it('Test 7: 顶点数 = 2N，z = ±t/2，x/y 原样保留', () => {
    const pts = extrudeProfile(squareCCW, 2);
    expect(pts.length).toBe(squareCCW.length * 2 * 3);
    // 顶环第一点
    expect([pts[0], pts[1], pts[2]]).toEqual([-1, -1, 1]);
    // 底环第一点（索引 N*3）
    const b = squareCCW.length * 3;
    expect([pts[b], pts[b + 1], pts[b + 2]]).toEqual([-1, -1, -1]);
  });

  it('Test 8: 厚度参数正确进入 z 值', () => {
    const pts = extrudeProfile([[0, 0], [1, 0], [1, 1]], 0.5);
    expect(pts[2]).toBeCloseTo(0.25, 10);
    expect(pts[3 * 3 + 2]).toBeCloseTo(-0.25, 10);
  });
});

describe('profileCentroid', () => {
  it('Test 9: 正方形质心 = 中心', () => {
    const [cx, cy] = profileCentroid(squareCCW);
    expect(cx).toBeCloseTo(0, 10);
    expect(cy).toBeCloseTo(0, 10);
  });

  it('Test 10: 偏移三角形质心 = 顶点均值', () => {
    const [cx, cy] = profileCentroid([[1, 0], [3, 0], [2, 3]]);
    expect(cx).toBeCloseTo(2, 10);
    expect(cy).toBeCloseTo(1, 10);
  });
});
