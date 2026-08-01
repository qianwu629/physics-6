/**
 * generateWireLines 单元测试 — 载流导线磁感线几何（Phase 8）
 *
 * 只测外部行为：圆环几何、箭头手性（右手定则）、负电流翻转、防御性短路。
 */
import { describe, it, expect } from 'vitest';
import { generateWireLines } from '../ForceFieldLines';

/** 每圆环点数：33（闭合折线）+ 4 箭头 × 2 = 41；每截面 4 半径；共 3 截面 */
const EXPECTED_POINTS = 41 * 4 * 3;

/** 从 positions 提取第 i 个点的 [x, y, z] */
function pointAt(positions: Float32Array, i: number): [number, number, number] {
  return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
}

describe('generateWireLines', () => {
  it('Test 1: current=0 或 direction 为零向量 → 空几何', () => {
    expect(generateWireLines([0, 0, 0], 0, [0, 1, 0]).positions.length).toBe(0);
    expect(generateWireLines([0, 0, 0], 10, [0, 0, 0]).positions.length).toBe(0);
    expect(generateWireLines([0, 0, 0], 0, [0, 1, 0]).colors.length).toBe(0);
  });

  it('Test 2: 点数与颜色数组长度符合布局（3 截面 × 4 半径 × 41 点）', () => {
    const { positions, colors } = generateWireLines([0, 0, 0], 10, [0, 1, 0]);
    expect(positions.length).toBe(EXPECTED_POINTS * 3);
    expect(colors.length).toBe(EXPECTED_POINTS * 3);
  });

  it('Test 3: 沿 +y 导线的圆环位于 xz 平面，半径正确', () => {
    // halfExtent=0 → 所有截面重合于中心平面，圆环点 y 应全为 0
    const { positions } = generateWireLines([0, 0, 0], 10, [0, 1, 0], 0);
    const radii = new Set<number>();
    // 每圆环前 33 个点是圆环折线；仅采样第一个圆环（索引 0..32）
    for (let s = 0; s <= 32; s++) {
      const [x, y, z] = pointAt(positions, s);
      expect(y).toBeCloseTo(0, 10);
      radii.add(Math.round(Math.hypot(x, z) * 1000) / 1000);
    }
    expect(radii.size).toBe(1);
    expect([...radii][0]).toBeCloseTo(0.75, 3);
  });

  it('Test 4: 截面偏移 — halfExtent=2 时存在 y=±2 的圆环点', () => {
    const { positions } = generateWireLines([0, 0, 0], 10, [0, 1, 0], 2);
    const ys = new Set<number>();
    for (let i = 0; i < positions.length / 3; i++) {
      ys.add(Math.round(positions[i * 3 + 1] * 1000) / 1000);
    }
    expect(ys.has(-2)).toBe(true);
    expect(ys.has(0)).toBe(true);
    expect(ys.has(2)).toBe(true);
  });

  it('Test 5: 箭头方向符合右手定则（+y 电流 → +x 处 B 指向 -z）', () => {
    // 第一圆环的折线点后紧跟 4 个箭头（8 点 = 4 段）
    const { positions } = generateWireLines([0, 0, 0], 10, [0, 1, 0], 0);
    for (let k = 0; k < 4; k++) {
      const start = pointAt(positions, 33 + k * 2);
      const tip = pointAt(positions, 33 + k * 2 + 1);
      // radial（轴线 → 起点，圆心在平面原点）
      const rLen = Math.hypot(start[0], start[2]);
      const radial = [start[0] / rLen, 0, start[2] / rLen];
      // B 方向 = d × r̂，d = (0,1,0)
      // d × r̂ = (1*r̂z*1... 展开: (dy*rz - dz*ry, dz*rx - dx*rz, dx*ry - dy*rx) = (r̂z, 0, -r̂x)
      const bDir = [radial[2], 0, -radial[0]];
      // 箭头向量应与 B 方向平行且同向
      const arrow = [tip[0] - start[0], tip[1] - start[1], tip[2] - start[2]];
      const aLen = Math.hypot(arrow[0], arrow[1], arrow[2]);
      expect(aLen).toBeCloseTo(0.3, 5);
      const dot = arrow[0] * bDir[0] + arrow[1] * bDir[1] + arrow[2] * bDir[2];
      expect(dot).toBeGreaterThan(0.99 * aLen); // 几乎完全同向
    }
  });

  it('Test 6: 负电流 → 箭头翻转', () => {
    const pos = generateWireLines([0, 0, 0], 10, [0, 1, 0], 0).positions;
    const neg = generateWireLines([0, 0, 0], -10, [0, 1, 0], 0).positions;
    for (let k = 0; k < 4; k++) {
      const ps = pointAt(pos, 33 + k * 2);
      const pt = pointAt(pos, 33 + k * 2 + 1);
      const ns = pointAt(neg, 33 + k * 2);
      const nt = pointAt(neg, 33 + k * 2 + 1);
      // 起点相同，箭头向量反向
      expect(ns).toEqual(ps);
      expect(nt[0] - ns[0]).toBeCloseTo(-(pt[0] - ps[0]), 8);
      expect(nt[2] - ns[2]).toBeCloseTo(-(pt[2] - ps[2]), 8);
    }
  });
});
