/**
 * placementCalc 单元测试 — 虚影放置：AABB 角点 / 支撑距离 / 虚影位置合成
 */
import { describe, it, expect } from 'vitest';
import { boundsCorners, supportDistance, ghostPosition } from '../placementCalc';

describe('boundsCorners', () => {
  it('Test 1: 球体 → (±r, ±r, ±r)', () => {
    const corners = boundsCorners('sphere', { radius: 2 });
    expect(corners).toHaveLength(8);
    for (const c of corners) {
      expect(Math.abs(c[0])).toBe(2);
      expect(Math.abs(c[1])).toBe(2);
      expect(Math.abs(c[2])).toBe(2);
    }
  });

  it('Test 2: 方块 → half extents；圆柱 → (r, hh, r)', () => {
    const box = boundsCorners('cuboid', { halfWidth: 1, halfHeight: 2, halfDepth: 3 });
    expect(box[0]).toEqual([1, 2, 3]);
    expect(box[7]).toEqual([-1, -2, -3]);
    const cyl = boundsCorners('cylinder', { radius: 0.5, halfHeight: 2 });
    expect(cyl[0]).toEqual([0.5, 2, 0.5]);
  });

  it('Test 3: convexProfile 挤出 → 轮廓 AABB + ±thickness/2；车削 → 半径包络', () => {
    const profile: [number, number][] = [[-1, 0], [2, 0], [2, 1], [-1, 1]];
    const ext = boundsCorners('convexProfile', { profile, thickness: 2, mode: 'extrude' });
    expect(ext[0]).toEqual([2, 1, 1]);
    expect(ext[7]).toEqual([-2, -1, -1]);
    const rev = boundsCorners('convexProfile', { profile, thickness: 0, mode: 'revolve' });
    expect(rev[0]).toEqual([2, 1, 2]);
  });
});

describe('supportDistance', () => {
  it('Test 4: 单位立方角点 — 法线 +Y → 1；对角法线 → √2', () => {
    const corners = boundsCorners('cuboid', { halfWidth: 1, halfHeight: 1, halfDepth: 1 });
    expect(supportDistance(corners, [0, 1, 0])).toBe(1);
    const d = Math.SQRT1_2;
    expect(supportDistance(corners, [d, d, 0])).toBeCloseTo(Math.SQRT2, 6);
  });

  it('Test 5: 法线朝下（吸附到天花板）→ 取最大投影（底面朝上贴）', () => {
    const corners = boundsCorners('sphere', { radius: 0.5 });
    expect(supportDistance(corners, [0, -1, 0])).toBeCloseTo(0.5, 10);
  });
});

describe('ghostPosition', () => {
  it('Test 6: 命中点 + 法线支撑 + 滚轮高度合成', () => {
    const corners = boundsCorners('sphere', { radius: 1 });
    // 平面命中 (1,2,3)，法线 +Y，球支撑 1，滚轮 +0.5 → y = 2+1+0.5 = 3.5
    expect(ghostPosition([1, 2, 3], [0, 1, 0], corners, 0.5)).toEqual([1, 3.5, 3]);
  });

  it('Test 7: 斜面法线 — 沿法线偏移，滚轮始终竖直', () => {
    const corners = boundsCorners('cuboid', { halfWidth: 0.5, halfHeight: 0.5, halfDepth: 0.5 });
    const d = Math.SQRT1_2;
    const pos = ghostPosition([0, 1, 0], [d, d, 0], corners, 1);
    // 支撑 = √2·0.5 ≈ 0.707；x 偏移 = d·√2·0.5 = 0.5；y = 1 + 0.5 + 1(滚轮)
    expect(pos[0]).toBeCloseTo(0.5, 6);
    expect(pos[1]).toBeCloseTo(2.5, 6);
    expect(pos[2]).toBe(0);
  });
});
