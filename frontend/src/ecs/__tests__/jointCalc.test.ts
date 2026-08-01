/**
 * jointCalc 单元测试 — 固定关节锚点/相对坐标架计算
 */
import { describe, it, expect } from 'vitest';
import { computeFixedJointParams, computeRevoluteParams, computeSphericalParams, midpoint } from '../jointCalc';

const I: [number, number, number] = [0, 0, 0];

describe('computeFixedJointParams', () => {
  it('Test 1: 两体无旋转、锚点取中点 → 锚点为各自到中点的偏移，frameB 为单位四元数', () => {
    const p = computeFixedJointParams([0, 0, 0], I, [4, 0, 0], I, [2, 0, 0]);
    expect(p.anchorA).toEqual([2, 0, 0]);
    expect(p.anchorB).toEqual([-2, 0, 0]);
    expect(p.frameB[3]).toBeCloseTo(1, 10); // w=1
    expect(p.frameB[0]).toBeCloseTo(0, 10);
  });

  it('Test 2: 锚点取 A 中心 → anchorA 为零向量', () => {
    const p = computeFixedJointParams([1, 2, 3], I, [7, 2, 3], I, [1, 2, 3]);
    expect(p.anchorA).toEqual([0, 0, 0]);
    expect(p.anchorB).toEqual([-6, 0, 0]);
  });

  it('Test 3: A 绕 z 旋转 90°，锚点取世界 (1,1,0) → anchorA 被逆旋转，frameB 保持相对旋转', () => {
    // qA = rotz(90°)，pA = (1, 0, 0)；世界锚点 (1, 1, 0) → 世界偏移 (0, 1, 0)
    // anchorA = qA⁻¹·(0,1,0) = (1, 0, 0)（逆旋转 -90°）
    const p = computeFixedJointParams([1, 0, 0], [0, 0, Math.PI / 2], [3, 0, 0], I, [1, 1, 0]);
    expect(p.anchorA[0]).toBeCloseTo(1, 8);
    expect(p.anchorA[1]).toBeCloseTo(0, 8);
    expect(p.anchorA[2]).toBeCloseTo(0, 8);
    // frameB = qB⁻¹·qA = qA（qB=I）→ z 轴 90° 四元数：z=sin45°, w=cos45°
    expect(p.frameB[2]).toBeCloseTo(Math.SQRT1_2, 8);
    expect(p.frameB[3]).toBeCloseTo(Math.SQRT1_2, 8);
  });

  it('Test 4: 锚点取 B 中心、B 有旋转 → anchorB 为零向量', () => {
    const p = computeFixedJointParams([0, 0, 0], I, [2, 2, 0], [0, 0, Math.PI / 2], [2, 2, 0]);
    expect(p.anchorB).toEqual([0, 0, 0]);
  });
});

describe('midpoint', () => {
  it('Test 5: 中点计算', () => {
    expect(midpoint([0, 0, 0], [4, 6, 8])).toEqual([2, 3, 4]);
  });
});

// ── 二期：铰链 / 球窝参数计算 ──

describe('computeRevoluteParams', () => {
  it('Test 6: 无旋转 — 锚点偏移 + 轴原样（Y 轴）', () => {
    const p = computeRevoluteParams([0, 0, 0], I, [4, 0, 0], I, [2, 0, 0], [0, 1, 0]);
    expect(p.anchorA).toEqual([2, 0, 0]);
    expect(p.anchorB).toEqual([-2, 0, 0]);
    expect(p.axisA).toEqual([0, 1, 0]);
    expect(p.axisB).toEqual([0, 1, 0]);
  });

  it('Test 7: A 绕 z 转 90° — axisA 为逆旋转后的局部轴', () => {
    // 世界轴 +y；qA = rotz(90°) → axisA = qA⁻¹·(0,1,0) = (1,0,0)
    const p = computeRevoluteParams([0, 0, 0], [0, 0, Math.PI / 2], [4, 0, 0], I, [2, 0, 0], [0, 1, 0]);
    expect(p.axisA[0]).toBeCloseTo(1, 8);
    expect(p.axisA[1]).toBeCloseTo(0, 8);
    expect(p.axisB).toEqual([0, 1, 0]); // B 无旋转，局部轴 = 世界轴
  });

  it('Test 8: 非单位轴被归一化；零轴回退 Y 轴', () => {
    const p = computeRevoluteParams([0, 0, 0], I, [2, 0, 0], I, [1, 0, 0], [0, 0, 5]);
    expect(p.axisA).toEqual([0, 0, 1]);
    const q = computeRevoluteParams([0, 0, 0], I, [2, 0, 0], I, [1, 0, 0], [0, 0, 0]);
    expect(q.axisA).toEqual([0, 1, 0]);
  });
});

describe('computeSphericalParams', () => {
  it('Test 9: 无旋转 — 锚点偏移', () => {
    const p = computeSphericalParams([0, 0, 0], I, [0, 4, 0], I, [0, 2, 0]);
    expect(p.anchorA).toEqual([0, 2, 0]);
    expect(p.anchorB).toEqual([0, -2, 0]);
  });

  it('Test 10: B 绕 z 转 90° — anchorB 逆旋转', () => {
    // 世界锚点 = B 中心正上方 1m：B(0,0,0)，锚点 (0,1,0)；qB = rotz(90°) → anchorB = qB⁻¹·(0,1,0) = (1,0,0)
    const p = computeSphericalParams([0, 3, 0], I, [0, 0, 0], [0, 0, Math.PI / 2], [0, 1, 0]);
    expect(p.anchorB[0]).toBeCloseTo(1, 8);
    expect(p.anchorB[1]).toBeCloseTo(0, 8);
  });
});
