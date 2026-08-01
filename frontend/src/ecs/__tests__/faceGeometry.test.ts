/**
 * faceGeometry 单元测试 — 面划分与面 collider 分解
 */
import { describe, it, expect } from 'vitest';
import { getShapeFaces, computeFaceColliders, FACE_SKIN } from '../faceGeometry';

describe('getShapeFaces', () => {
  it('Test 1: cuboid → 6 面', () => {
    const faces = getShapeFaces('cuboid', {});
    expect(faces.map((f) => f.id)).toEqual(['top', 'bottom', 'front', 'back', 'right', 'left']);
  });

  it('Test 2: cylinder → 3 面；sphere → 1 面', () => {
    expect(getShapeFaces('cylinder', {}).map((f) => f.id)).toEqual(['top', 'bottom', 'side']);
    expect(getShapeFaces('sphere', {}).map((f) => f.id)).toEqual(['surface']);
  });

  it('Test 3: convexProfile → 顶/底 + N 侧', () => {
    const faces = getShapeFaces('convexProfile', { profile: [[-1, -1], [1, -1], [1, 1], [-1, 1]] });
    expect(faces.map((f) => f.id)).toEqual(['top', 'bottom', 'side-0', 'side-1', 'side-2', 'side-3']);
  });
});

describe('computeFaceColliders', () => {
  it('Test 4: cuboid 薄板位置与尺寸 — 顶板贴顶、薄厚 FACE_SKIN', () => {
    const specs = computeFaceColliders('cuboid', { halfWidth: 2, halfHeight: 1, halfDepth: 3 });
    expect(specs).toHaveLength(6);
    const top = specs[0];
    if (top.shape !== 'cuboid') throw new Error('unexpected');
    expect(top.args).toEqual([2, FACE_SKIN / 2, 3]);
    expect(top.position).toEqual([0, 1 - FACE_SKIN / 2, 0]);
    const right = specs[4];
    if (right.shape !== 'cuboid') throw new Error('unexpected');
    expect(right.args[0]).toBeCloseTo(FACE_SKIN / 2, 10);
    expect(right.position[0]).toBeCloseTo(2 - FACE_SKIN / 2, 10);
  });

  it('Test 5: cylinder 三段 — 顶/底薄板 + 中段侧面', () => {
    const specs = computeFaceColliders('cylinder', { halfHeight: 2, radius: 0.5 });
    expect(specs).toHaveLength(3);
    const [top, bottom, side] = specs;
    if (top.shape !== 'cylinder' || side.shape !== 'cylinder') throw new Error('unexpected');
    expect(top.args).toEqual([FACE_SKIN / 2, 0.5]);
    expect(top.position).toEqual([0, 2 - FACE_SKIN / 2, 0]);
    expect(bottom.position[1]).toBeCloseTo(-(2 - FACE_SKIN / 2), 10);
    expect(side.args[0]).toBeCloseTo(2 - FACE_SKIN, 10);
    expect(side.args[1]).toBe(0.5);
  });

  it('Test 6: sphere → 单 ball', () => {
    const specs = computeFaceColliders('sphere', { radius: 2 });
    expect(specs).toEqual([{ faceId: 'surface', shape: 'ball', args: [2] }]);
  });

  it('Test 7: convexProfile 分解 — 每面一个凸锥，顶点数正确且含质心', () => {
    const profile: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const specs = computeFaceColliders('convexProfile', { profile, thickness: 2 });
    expect(specs).toHaveLength(6); // 顶/底 + 4 侧
    const top = specs[0];
    if (top.shape !== 'convexHull') throw new Error('unexpected');
    // 顶面锥：4 轮廓点 + 质心 = 5 点
    expect(top.args[0].length).toBe(15);
    // 顶面点 z 全为 +1（顶环），质心 z=0
    expect(top.args[0][2]).toBe(1);
    expect(top.args[0][14]).toBe(0);
    // 侧面锥：5 点
    const side = specs[2];
    if (side.shape !== 'convexHull') throw new Error('unexpected');
    expect(side.args[0].length).toBe(15);
    expect(side.faceId).toBe('side-0');
  });

  it('Test 8: convexProfile 顶点 < 3 → 空', () => {
    expect(computeFaceColliders('convexProfile', { profile: [[0, 0], [1, 1]], thickness: 1 })).toEqual([]);
  });
});
