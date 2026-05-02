/**
 * Nyquist 物理验证 — 弹簧简谐运动 (VALIDATION.md 3.1)
 *
 * 理论: m=1, k=10, damping=0 → ω = √(k/m) = √10 ≈ 3.162
 * 周期 T = 2π/ω ≈ 1.987s
 *
 * 使用纯数值积分（半隐式 Euler）模拟弹簧振子，
 * 验证周期符合理论值（误差 < 5%）。
 */

import { describe, it, expect } from 'vitest';

interface SpringOscillatorState {
  posA: [number, number, number];
  posB: [number, number, number];
  velA: [number, number, number];
  velB: [number, number, number];
}

function simulateSpringOscillator(
  stiffness: number,
  restLength: number,
  damping: number,
  mass: number,
  dt: number,
  steps: number,
): number[] {
  const state: SpringOscillatorState = {
    posA: [0, 10, 0],      // 锚点 A 固定在高处
    posB: [0, 10 - restLength - 2.5, 0], // B 比 restLength 低 2.5m（远离平衡点，大振幅）
    velA: [0, 0, 0],
    velB: [0, 0, 0],
  };

  const yPositions: number[] = [];

  for (let i = 0; i < steps; i++) {
    // Spring: 力总是朝向锚点方向，大小正比于 (|距离| - 原长)
    const dy = state.posA[1] - state.posB[1]; // A.y - B.y, 正=锚点在上
    const dist = Math.abs(dy);
    const dir = dy > 0 ? 1 : -1; // 锚点在上→向上拉
    const springForce = stiffness * (dist - restLength) * dir;

    // 阻尼力: F_damp = -damping * v
    const dampingForce = -damping * state.velB[1];

    // 重力: F_g = mass * (-9.81)
    const gravityForce = mass * (-9.81);

    const totalForce = springForce + dampingForce + gravityForce;

    // 半隐式 Euler: 先更新速度，再更新位置
    const accel = totalForce / mass;
    state.velB[1] += accel * dt;
    state.posB[1] += state.velB[1] * dt;

    yPositions.push(state.posB[1]);
  }

  return yPositions;
}

describe('Spring Oscillator — Nyquist Validation', () => {
  const DT = 1 / 120; // 120Hz fixed timestep
  const TOLERANCE = 0.05; // 5% tolerance

  describe('simple harmonic motion: m=1, k=10, L0=5, damping=0', () => {
    const MASS = 1;
    const K = 10;
    const L0 = 5;
    const DAMPING = 0;
    const omega = Math.sqrt(K / MASS);
    const expectedPeriod = (2 * Math.PI) / omega;

    it('produces oscillatory motion (position crosses rest length)', () => {
      // Simulate for ~4 seconds
      const positions = simulateSpringOscillator(K, L0, DAMPING, MASS, DT, Math.ceil(4 / DT));

      // Should see oscillation around equilibrium (which is below rest length due to gravity)
      const minY = Math.min(...positions);
      const maxY = Math.max(...positions);
      expect(maxY - minY).toBeGreaterThan(0.5); // amplitude > 0.5m
    });

    it('period matches theoretical T = 2π/√(k/m)', () => {
      const expectedT = expectedPeriod; // ~1.987s

      // Simulate longer to get stable period measurement
      const positions = simulateSpringOscillator(K, L0, DAMPING, MASS, DT, Math.ceil(8 / DT));

      // Find zero-crossings of velocity to measure period
      // (position peaks/valleys since we account for gravity offset)
      // Use the position time series to find peaks
      const peaks: number[] = [];
      for (let i = 2; i < positions.length - 2; i++) {
        if (
          positions[i] > positions[i - 1] &&
          positions[i] > positions[i - 2] &&
          positions[i] > positions[i + 1] &&
          positions[i] > positions[i + 2]
        ) {
          peaks.push(i);
        }
      }

      // Measure period between consecutive peaks (skip first few to let transients decay)
      expect(peaks.length).toBeGreaterThanOrEqual(2);

      const skipTransient = 2;
      if (peaks.length > skipTransient + 1) {
        const periods: number[] = [];
        for (let i = skipTransient; i < peaks.length - 1; i++) {
          const dtSteps = peaks[i + 1] - peaks[i];
          periods.push(dtSteps * DT);
        }
        const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
        const relativeError = Math.abs(avgPeriod - expectedT) / expectedT;
        expect(relativeError).toBeLessThan(TOLERANCE);
      }
    });

    it('ω = √(k/m) ≈ 3.162 rad/s', () => {
      expect(omega).toBeCloseTo(3.162, 2);
    });

    it('T ≈ 1.987s', () => {
      expect(expectedPeriod).toBeCloseTo(1.987, 2);
    });
  });

  describe('damping effect', () => {
    it('damping > 0 causes amplitude decay', () => {
      const positionsUndamped = simulateSpringOscillator(10, 5, 0, 1, DT, Math.ceil(3 / DT));
      const positionsDamped = simulateSpringOscillator(10, 5, 2.0, 1, DT, Math.ceil(3 / DT));

      const amplitudeUndamped = Math.max(...positionsUndamped) - Math.min(...positionsUndamped);
      const amplitudeDamped = Math.max(...positionsDamped) - Math.min(...positionsDamped);

      // Damped amplitude should be significantly smaller
      expect(amplitudeDamped).toBeLessThan(amplitudeUndamped * 0.8);
    });
  });
});
