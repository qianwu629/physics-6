/**
 * fieldSourceCalc 单元测试 — 场-源关系（Phase 8）
 *
 * 只测外部行为：库仑力方向/衰减/防御，导线 B 场公式/右手定则/钳位。
 */
import { describe, it, expect } from 'vitest';
import {
  computeCoulombForce,
  computeWireMagneticField,
  WIRE_B_K,
  type ChargeSource,
  type WireSource,
} from '../fieldSourceCalc';

const Z = { x: 0, y: 0, z: 0 };

describe('computeCoulombForce — 电荷源库仑力', () => {
  const src = (id: string, x: number, charge: number): ChargeSource => ({
    id,
    position: [x, 0, 0],
    charge,
  });

  it('Test 1: 同号相斥 — 源在原点 Q=1，目标 q=1 在 (2,0,0)，力沿 +x 远离源', () => {
    // |F| = 1000·1·1·2 / (2²+0.5²)^1.5 ≈ 228.27
    const F = computeCoulombForce([src('s1', 0, 1)], 't1', { x: 2, y: 0, z: 0 }, 1);
    expect(F.x).toBeCloseTo(228.27, 1);
    expect(F.y).toBe(0);
    expect(F.z).toBe(0);
  });

  it('Test 2: 异号相吸 — 目标 q=-1，力指向源（-x）', () => {
    const F = computeCoulombForce([src('s1', 0, 1)], 't1', { x: 2, y: 0, z: 0 }, -1);
    expect(F.x).toBeCloseTo(-228.27, 1);
    expect(F.y).toBe(0);
  });

  it('Test 3: 自相互作用排除 — 源 id 与 targetId 相同则忽略', () => {
    const F = computeCoulombForce([src('t1', 0, 1)], 't1', { x: 2, y: 0, z: 0 }, 1);
    expect(F).toEqual(Z);
  });

  it('Test 4: 目标电荷为 0 → 零力', () => {
    const F = computeCoulombForce([src('s1', 0, 1)], 't1', { x: 2, y: 0, z: 0 }, 0);
    expect(F).toEqual(Z);
  });

  it('Test 5: 1/r² 衰减 — r=4 的力显著小于 r=2（约 1/4）', () => {
    const F2 = computeCoulombForce([src('s1', 0, 1)], 't1', { x: 2, y: 0, z: 0 }, 1);
    const F4 = computeCoulombForce([src('s1', 0, 1)], 't1', { x: 4, y: 0, z: 0 }, 1);
    expect(F4.x).toBeGreaterThan(0);
    expect(F4.x).toBeLessThan(F2.x);
    const ratio = F4.x / F2.x;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.3);
  });

  it('Test 6: 多源叠加 — 对称双源在连线中点相互抵消', () => {
    const F = computeCoulombForce([src('s1', 0, 1), src('s2', 4, 1)], 't1', { x: 2, y: 0, z: 0 }, 1);
    expect(F.x).toBeCloseTo(0, 10);
    expect(F).toEqual(expect.objectContaining({ y: 0, z: 0 }));
  });

  it('Test 7: 距离截断 — r=200 超出 MAX_RANGE → 零力', () => {
    const F = computeCoulombForce([src('s1', 0, 1)], 't1', { x: 200, y: 0, z: 0 }, 1);
    expect(F).toEqual(Z);
  });

  it('Test 8: r=0（源与目标重合）→ 有限且不爆炸（软化）', () => {
    const F = computeCoulombForce([src('s1', 0, 1)], 't1', Z, 1);
    expect(F).toEqual(Z); // r_vec=0 → 力为 0，不会 NaN
  });

  it('Test 9: 力上限 — 超大电荷时合力模长不超过 MAX_FORCE=1e6', () => {
    const F = computeCoulombForce([src('s1', 0, 1e6)], 't1', { x: 0.01, y: 0, z: 0 }, 1e6);
    const mag = Math.hypot(F.x, F.y, F.z);
    expect(mag).toBeLessThanOrEqual(1e6);
    expect(mag).toBeGreaterThan(0);
  });
});

describe('computeWireMagneticField — 电流源直导线 B 场', () => {
  const wireZ = (current: number, x = 0): WireSource => ({
    position: [x, 0, 0],
    current,
    direction: [0, 0, 1],
  });

  it('Test 10: 大小公式 — I=10A、r=1m 时 |B| = WIRE_B_K·10', () => {
    const B = computeWireMagneticField([wireZ(10)], { x: 1, y: 0, z: 0 });
    expect(Math.hypot(B.x, B.y, B.z)).toBeCloseTo(WIRE_B_K * 10, 10);
  });

  it('Test 11: 右手定则 — 电流 +z，+x 处 B 指向 +y', () => {
    const B = computeWireMagneticField([wireZ(10)], { x: 1, y: 0, z: 0 });
    expect(B.x).toBeCloseTo(0, 10);
    expect(B.y).toBeCloseTo(WIRE_B_K * 10, 10);
    expect(B.z).toBeCloseTo(0, 10);
  });

  it('Test 12: 1/r 衰减 — r=2m 处 B 减半', () => {
    const B = computeWireMagneticField([wireZ(10)], { x: 2, y: 0, z: 0 });
    expect(B.y).toBeCloseTo(WIRE_B_K * 5, 10);
  });

  it('Test 13: 轴线上（r_perp=0）→ 零场', () => {
    const B = computeWireMagneticField([wireZ(10)], { x: 0, y: 0, z: 5 });
    expect(B).toEqual(Z);
  });

  it('Test 14: 电流为 0 或方向为零向量 → 零场', () => {
    expect(computeWireMagneticField([wireZ(0)], { x: 1, y: 0, z: 0 })).toEqual(Z);
    const noDir: WireSource = { position: [0, 0, 0], current: 10, direction: [0, 0, 0] };
    expect(computeWireMagneticField([noDir], { x: 1, y: 0, z: 0 })).toEqual(Z);
  });

  it('Test 15: 负电流 → B 反向', () => {
    const B = computeWireMagneticField([wireZ(-10)], { x: 1, y: 0, z: 0 });
    expect(B.y).toBeCloseTo(-WIRE_B_K * 10, 10);
  });

  it('Test 16: 双导线叠加 — 平行同向电流在连线中点 B 抵消', () => {
    const B = computeWireMagneticField([wireZ(10, 0), wireZ(10, 2)], { x: 1, y: 0, z: 0 });
    expect(B.y).toBeCloseTo(0, 10);
  });

  it('Test 17: r→0 钳位 — r=0.01m 时按 MIN_WIRE_DIST=0.1 计算，有限不爆炸', () => {
    const B = computeWireMagneticField([wireZ(10)], { x: 0.01, y: 0, z: 0 });
    expect(B.y).toBeCloseTo((WIRE_B_K * 10) / 0.1, 5);
  });
});
