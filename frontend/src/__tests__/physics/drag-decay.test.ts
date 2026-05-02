/**
 * Nyquist 物理验证 — 空气阻力衰减 (VALIDATION.md 3.1)
 *
 * 理论: 仅受 linear damping（无重力）时，速度指数衰减：
 *   v(t) = v0 * e^(-drag * t)
 *
 * 半衰期: t_half = ln(2) / drag
 *   drag=1.0 → t_half ≈ 0.693s
 *   drag=0.5 → t_half ≈ 1.386s
 *   drag=2.0 → t_half ≈ 0.347s
 */

import { describe, it, expect } from 'vitest';

interface DragState {
  pos: [number, number, number];
  vel: [number, number, number];
}

function simulateDragDecay(
  initialVel: [number, number, number],
  drag: number,
  dt: number,
  steps: number,
  gravity: [number, number, number] = [0, 0, 0],
  trackAxis: 0 | 1 | 2 = 0, // which axis to record in output
): { velocities: number[]; positions: number[] } {
  const state: DragState = {
    pos: [0, 0, 0],
    vel: [...initialVel],
  };

  const velocities: number[] = [];
  const positions: number[] = [];

  for (let i = 0; i < steps; i++) {
    // Linear drag: F_drag = -drag * v  (simplified)
    // accel = -drag * v
    const accelX = -drag * state.vel[0] + gravity[0];
    const accelY = -drag * state.vel[1] + gravity[1];
    const accelZ = -drag * state.vel[2] + gravity[2];

    state.vel[0] += accelX * dt;
    state.vel[1] += accelY * dt;
    state.vel[2] += accelZ * dt;

    state.pos[0] += state.vel[0] * dt;
    state.pos[1] += state.vel[1] * dt;
    state.pos[2] += state.vel[2] * dt;

    velocities.push(state.vel[trackAxis]);
    positions.push(state.pos[trackAxis]);
  }

  return { velocities, positions };
}

describe('Drag Decay — Nyquist Validation', () => {
  const DT = 1 / 120;

  describe('exponential velocity decay', () => {
    it('drag=1.0 → half-life ≈ 0.693s', () => {
      const v0 = 10.0;
      const drag = 1.0;
      const expectedHalfLife = Math.log(2) / drag; // ≈ 0.693

      const result = simulateDragDecay([v0, 0, 0], drag, DT, Math.ceil(3.0 / DT));

      // Find when velocity drops to v0/2
      const halfVelocity = v0 / 2;
      let halfStep = -1;
      for (let i = 0; i < result.velocities.length; i++) {
        if (result.velocities[i] <= halfVelocity) {
          halfStep = i;
          break;
        }
      }

      expect(halfStep).toBeGreaterThan(0);
      const actualHalfLife = halfStep * DT;
      const relativeError = Math.abs(actualHalfLife - expectedHalfLife) / expectedHalfLife;
      expect(relativeError).toBeLessThan(0.1); // 10% tolerance for discrete time
    });

    it('velocity approaches zero asymptotically', () => {
      const v0 = 10.0;
      const drag = 1.0;

      const result = simulateDragDecay([v0, 0, 0], drag, DT, Math.ceil(5.0 / DT));

      // After 5 half-lives (≈3.5s), velocity should be < 5% of original
      const finalVel = result.velocities[result.velocities.length - 1];
      expect(Math.abs(finalVel)).toBeLessThan(v0 * 0.05);
    });
  });

  describe('drag coefficient scaling', () => {
    it('higher drag produces faster decay', () => {
      const v0 = 10.0;
      const T = 0.5; // seconds

      const resultLow = simulateDragDecay([v0, 0, 0], 0.5, DT, Math.ceil(T / DT));
      const resultHigh = simulateDragDecay([v0, 0, 0], 3.0, DT, Math.ceil(T / DT));

      const velLowEnd = resultLow.velocities[resultLow.velocities.length - 1];
      const velHighEnd = resultHigh.velocities[resultHigh.velocities.length - 1];

      // Higher drag → lower velocity after same time
      expect(velHighEnd).toBeLessThan(velLowEnd);
    });

    it('drag=0 produces no decay (constant velocity)', () => {
      const v0 = 10.0;
      const result = simulateDragDecay([v0, 0, 0], 0.0, DT, Math.ceil(2.0 / DT));

      const finalVel = result.velocities[result.velocities.length - 1];
      expect(finalVel).toBeCloseTo(v0, 2);
    });

    it('drag=2.0 → half-life ≈ 0.347s', () => {
      const v0 = 10.0;
      const drag = 2.0;
      const expectedHalfLife = Math.log(2) / drag;

      const result = simulateDragDecay([v0, 0, 0], drag, DT, Math.ceil(2.0 / DT));

      const halfVelocity = v0 / 2;
      let halfStep = -1;
      for (let i = 0; i < result.velocities.length; i++) {
        if (result.velocities[i] <= halfVelocity) {
          halfStep = i;
          break;
        }
      }

      expect(halfStep).toBeGreaterThan(0);
      const actualHalfLife = halfStep * DT;
      const relativeError = Math.abs(actualHalfLife - expectedHalfLife) / expectedHalfLife;
      expect(relativeError).toBeLessThan(0.1);
    });
  });

  describe('drag combined with gravity', () => {
    it('drag limits terminal velocity under gravity', () => {
      // With gravity + drag: v_terminal = -g / drag (for -Y direction)
      const drag = 1.0;

      const result = simulateDragDecay(
        [0, 0, 0],
        drag,
        DT,
        Math.ceil(5.0 / DT),
        [0, -9.81, 0],
        1, // track Y axis
      );

      // Velocity should approach terminal velocity
      const finalVelY = result.velocities[result.velocities.length - 1];
      // After 5 half-lives with drag=1, we're close to terminal (~9.81 m/s)
      expect(Math.abs(finalVelY)).toBeGreaterThan(5.0);
    });

    it('higher drag produces lower terminal velocity', () => {
      const resultLowDrag = simulateDragDecay(
        [0, 0, 0],
        1.0,
        DT,
        Math.ceil(3.0 / DT),
        [0, -9.81, 0],
        1, // track Y axis
      );
      const resultHighDrag = simulateDragDecay(
        [0, 0, 0],
        5.0,
        DT,
        Math.ceil(3.0 / DT),
        [0, -9.81, 0],
        1, // track Y axis
      );

      const finalSpeedLowDrag = Math.abs(
        resultLowDrag.velocities[resultLowDrag.velocities.length - 1],
      );
      const finalSpeedHighDrag = Math.abs(
        resultHighDrag.velocities[resultHighDrag.velocities.length - 1],
      );

      // Higher drag → lower terminal speed
      expect(finalSpeedHighDrag).toBeLessThan(finalSpeedLowDrag);
    });
  });
});
