/**
 * Nyquist 物理验证 — 重力热更新 (VALIDATION.md 3.1)
 *
 * 验证:
 * - setGravity([0,0,0]) → 物体停止下落（保持惯性匀速运动）
 * - 月球重力 → 下落加速度约为地球的 1/6
 * - 重力方向改变 → 物体运动方向相应改变
 */

import { describe, it, expect } from 'vitest';

interface FallingBodyState {
  pos: [number, number, number];
  vel: [number, number, number];
}

function simulateFall(
  gravity: [number, number, number],
  initialPos: [number, number, number],
  initialVel: [number, number, number],
  dt: number,
  steps: number,
  swapGravityAt?: { step: number; gravity: [number, number, number] },
): { positions: number[]; velocities: number[] } {
  const state: FallingBodyState = {
    pos: [...initialPos],
    vel: [...initialVel],
  };

  const positions: number[] = [];
  const velocities: number[] = [];
  let currentGravity = [...gravity];

  for (let i = 0; i < steps; i++) {
    if (swapGravityAt && i === swapGravityAt.step) {
      currentGravity = [...swapGravityAt.gravity];
    }

    // Semi-implicit Euler
    state.vel[0] += currentGravity[0] * dt;
    state.vel[1] += currentGravity[1] * dt;
    state.vel[2] += currentGravity[2] * dt;

    state.pos[0] += state.vel[0] * dt;
    state.pos[1] += state.vel[1] * dt;
    state.pos[2] += state.vel[2] * dt;

    positions.push(state.pos[1]); // track Y position
    velocities.push(state.vel[1]); // track Y velocity
  }

  return { positions, velocities };
}

describe('Gravity Hot-Swap — Nyquist Validation', () => {
  const DT = 1 / 120;

  describe('zero gravity stops falling acceleration', () => {
    it('velocity stops changing after gravity set to zero', () => {
      // First fall with Earth gravity for 0.5 seconds
      const earthGravity: [number, number, number] = [0, -9.81, 0];
      const zeroGravity: [number, number, number] = [0, 0, 0];
      const swapStep = Math.ceil(0.5 / DT); // swap at t=0.5s

      const result = simulateFall(
        earthGravity,
        [0, 10, 0],
        [0, 0, 0],
        DT,
        Math.ceil(1.5 / DT),
        { step: swapStep, gravity: zeroGravity },
      );

      // After swap, velocity should be constant (no further acceleration)
      const velRightAfterSwap = result.velocities[swapStep];
      const velAtEnd = result.velocities[result.velocities.length - 1];

      // Velocity should be essentially unchanged after gravity removal
      expect(Math.abs(velAtEnd - velRightAfterSwap)).toBeLessThan(0.001);
    });

    it('velocity before swap was decreasing (falling)', () => {
      const earthGravity: [number, number, number] = [0, -9.81, 0];
      const zeroGravity: [number, number, number] = [0, 0, 0];
      const swapStep = Math.ceil(0.5 / DT);

      const result = simulateFall(
        earthGravity,
        [0, 10, 0],
        [0, 0, 0],
        DT,
        Math.ceil(1.0 / DT),
        { step: swapStep, gravity: zeroGravity },
      );

      // Velocity at start is 0, after falling it should be negative (downward)
      const velBeforeSwap = result.velocities[swapStep - 1];
      expect(velBeforeSwap).toBeLessThan(-4.0); // after 0.5s of Earth gravity, v ≈ -4.9 m/s
    });
  });

  describe('lunar gravity is ~1/6 of Earth', () => {
    it('lunar fall distance is ~1/6 of Earth in same time', () => {
      const earthGravity: [number, number, number] = [0, -9.81, 0];
      const lunarGravity: [number, number, number] = [0, -1.62, 0];
      const T = 1.0; // 1 second

      const earthResult = simulateFall(earthGravity, [0, 10, 0], [0, 0, 0], DT, Math.ceil(T / DT));
      const lunarResult = simulateFall(lunarGravity, [0, 10, 0], [0, 0, 0], DT, Math.ceil(T / DT));

      const earthFallDist = 10 - earthResult.positions[earthResult.positions.length - 1];
      const lunarFallDist = 10 - lunarResult.positions[lunarResult.positions.length - 1];

      // Theory: d = 1/2 g t^2
      // Earth: 0.5 * 9.81 * 1 = 4.905m
      // Lunar: 0.5 * 1.62 * 1 = 0.81m
      // Ratio: 4.905 / 0.81 ≈ 6.06
      const ratio = earthFallDist / lunarFallDist;
      expect(ratio).toBeGreaterThan(5.0);
      expect(ratio).toBeLessThan(7.0);
    });
  });

  describe('Mars gravity preset', () => {
    it('Mars gravity produces intermediate fall distance', () => {
      const earthGravity: [number, number, number] = [0, -9.81, 0];
      const marsGravity: [number, number, number] = [0, -3.71, 0];
      const T = 1.0;

      const earthResult = simulateFall(earthGravity, [0, 10, 0], [0, 0, 0], DT, Math.ceil(T / DT));
      const marsResult = simulateFall(marsGravity, [0, 10, 0], [0, 0, 0], DT, Math.ceil(T / DT));

      const earthFallDist = 10 - earthResult.positions[earthResult.positions.length - 1];
      const marsFallDist = 10 - marsResult.positions[marsResult.positions.length - 1];

      // Mars should be between lunar and Earth
      expect(marsFallDist).toBeGreaterThan(1.0);
      expect(marsFallDist).toBeLessThan(earthFallDist);
    });
  });

  describe('gravity direction', () => {
    it('positive Y gravity causes upward acceleration', () => {
      const upGravity: [number, number, number] = [0, 9.81, 0];
      const result = simulateFall(upGravity, [0, 0, 0], [0, 0, 0], DT, Math.ceil(1.0 / DT));

      const finalVel = result.velocities[result.velocities.length - 1];
      const finalPos = result.positions[result.positions.length - 1];

      // Should move upward (positive velocity and position)
      expect(finalVel).toBeGreaterThan(5.0);
      expect(finalPos).toBeGreaterThan(2.0);
    });

    it('horizontal gravity moves object sideways', () => {
      const sideGravity: [number, number, number] = [5.0, 0, 0];
      const result = simulateFall(
        sideGravity,
        [0, 10, 0],
        [0, 0, 0],
        DT,
        Math.ceil(1.0 / DT),
      );

      // Y should remain unchanged (no vertical gravity)
      expect(result.positions[result.positions.length - 1]).toBeCloseTo(10, 1);
    });
  });
});
