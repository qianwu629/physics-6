/**
 * pickFace 单元测试 — 3D 命中 → 逻辑面 id
 */
import { describe, it, expect } from 'vitest';
import { pickFace } from '../pickFace';

const Z: [number, number, number] = [0, 0, 0];

describe('pickFace', () => {
  it('Test 1: cuboid — 六面按法线主轴映射', () => {
    expect(pickFace('cuboid', {}, Z, [0, 1, 0])).toBe('top');
    expect(pickFace('cuboid', {}, Z, [0, -1, 0])).toBe('bottom');
    expect(pickFace('cuboid', {}, Z, [1, 0, 0])).toBe('right');
    expect(pickFace('cuboid', {}, Z, [-1, 0, 0])).toBe('left');
    expect(pickFace('cuboid', {}, Z, [0, 0, 1])).toBe('front');
    expect(pickFace('cuboid', {}, Z, [0, 0, -1])).toBe('back');
  });

  it('Test 2: cuboid — 斜法线按主轴归属（|y| 最大 → top）', () => {
    expect(pickFace('cuboid', {}, Z, [0.3, 0.9, 0.2])).toBe('top');
    expect(pickFace('cuboid', {}, Z, [0.9, 0.3, 0.2])).toBe('right');
  });

  it('Test 3: cylinder — 顶/底/侧', () => {
    expect(pickFace('cylinder', {}, Z, [0, 1, 0])).toBe('top');
    expect(pickFace('cylinder', {}, Z, [0, -1, 0])).toBe('bottom');
    expect(pickFace('cylinder', {}, Z, [0.7, 0.1, 0.7])).toBe('side');
  });

  it('Test 4: sphere / revolve → surface', () => {
    expect(pickFace('sphere', {}, Z, [1, 0, 0])).toBe('surface');
    expect(pickFace('convexProfile', { mode: 'revolve', profile: [[0, 0], [1, 0], [0, 2]] }, Z, [1, 0, 0])).toBe('surface');
  });

  it('Test 5: convexProfile(extrude) — 顶/底面按法线 z', () => {
    const params = { profile: [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][], thickness: 1 };
    expect(pickFace('convexProfile', params, Z, [0, 0, 1])).toBe('top');
    expect(pickFace('convexProfile', params, Z, [0, 0, -1])).toBe('bottom');
  });

  it('Test 6: convexProfile(extrude) — 侧面按外法线最大点积', () => {
    // 正方形轮廓：side-0 = 底边 (-1,-1)→(1,-1)，外法线 (0,-1)
    //            side-1 = 右边 (1,-1)→(1,1)，外法线 (1,0)
    const params = { profile: [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][], thickness: 1 };
    expect(pickFace('convexProfile', params, Z, [0, -1, 0.1])).toBe('side-0');
    expect(pickFace('convexProfile', params, Z, [1, 0, 0.1])).toBe('side-1');
    expect(pickFace('convexProfile', params, Z, [0.9, 0.4, 0])).toBe('side-1'); // 斜但最接近右边
  });

  it('Test 7: 退化输入 → null（轮廓 < 3 点）', () => {
    expect(pickFace('convexProfile', { profile: [[0, 0], [1, 1]], thickness: 1 }, Z, [0, 1, 0])).toBeNull();
  });
});
