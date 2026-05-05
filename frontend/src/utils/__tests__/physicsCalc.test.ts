import { describe, it, expect } from 'vitest';
import { computeEnergy, AccelerationSmoother } from '../physicsCalc';
import * as THREE from 'three';

describe('computeEnergy', () => {
  it('calculates KE correctly: mass 2kg, velocity (3,4,0) => KE = 25 J', () => {
    const rb = {
      linvel: () => ({ x: 3, y: 4, z: 0 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 2,
    };
    const result = computeEnergy(rb, 2, -9.81, 0, [], () => null);
    expect(result.ke).toBeCloseTo(25, 5);
    expect(result.peGravity).toBe(0);
    expect(result.peSprings).toBe(0);
    expect(result.total).toBeCloseTo(25, 5);
  });

  it('calculates PE_gravity correctly: mass 1kg at y=5, g=-9.81 => PE = 49.05 J', () => {
    const rb = {
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      translation: () => ({ x: 0, y: 5, z: 0 }),
      mass: () => 1,
    };
    const result = computeEnergy(rb, 1, -9.81, 0, [], () => null);
    expect(result.peGravity).toBeCloseTo(49.05, 5);
    expect(result.ke).toBe(0);
    expect(result.total).toBeCloseTo(49.05, 5);
  });

  it('calculates PE_spring correctly: k=100, L0=2, current=3 => PE = 50 J', () => {
    const rb = {
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 1,
    };
    const springs = [
      { stiffness: 100, restLength: 2, entityAId: 'a', entityBId: 'b' },
    ];
    const getPos = (id: string) => {
      if (id === 'a') return new THREE.Vector3(0, 0, 0);
      if (id === 'b') return new THREE.Vector3(3, 0, 0);
      return null;
    };
    const result = computeEnergy(rb, 1, -9.81, 0, springs, getPos);
    expect(result.peSprings).toBeCloseTo(50, 5);
    expect(result.ke).toBe(0);
    expect(result.peGravity).toBe(0);
    expect(result.total).toBeCloseTo(50, 5);
  });

  it('calculates total energy correctly with all components', () => {
    const rb = {
      linvel: () => ({ x: 3, y: 4, z: 0 }),
      translation: () => ({ x: 0, y: 5, z: 0 }),
      mass: () => 2,
    };
    const springs = [
      { stiffness: 100, restLength: 2, entityAId: 'a', entityBId: 'b' },
    ];
    const getPos = (id: string) => {
      if (id === 'a') return new THREE.Vector3(0, 0, 0);
      if (id === 'b') return new THREE.Vector3(3, 0, 0);
      return null;
    };
    const result = computeEnergy(rb, 2, -9.81, 0, springs, getPos);
    expect(result.ke).toBeCloseTo(25, 5);
    expect(result.peGravity).toBeCloseTo(98.1, 5); // 2 * 9.81 * 5
    expect(result.peSprings).toBeCloseTo(50, 5);
    expect(result.total).toBeCloseTo(25 + 98.1 + 50, 3);
  });

  it('skips spring calculation when position is null', () => {
    const rb = {
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 1,
    };
    const springs = [
      { stiffness: 100, restLength: 2, entityAId: 'a', entityBId: 'b' },
    ];
    const getPos = () => null;
    const result = computeEnergy(rb, 1, -9.81, 0, springs, getPos);
    expect(result.peSprings).toBe(0);
  });
});

describe('AccelerationSmoother', () => {
  it('returns near-zero acceleration for stationary object (vel = 0)', () => {
    const smoother = new AccelerationSmoother(5);
    const dt = 1 / 60;
    // Push 5 frames of zero velocity
    for (let i = 0; i < 5; i++) {
      smoother.push(0, 0, 0);
    }
    const [ax, ay, az] = smoother.getSmoothedAcceleration(dt);
    expect(Math.abs(ax)).toBeLessThan(0.05);
    expect(Math.abs(ay)).toBeLessThan(0.05);
    expect(Math.abs(az)).toBeLessThan(0.05);
  });

  it('returns acceleration close to 1/dt for uniformly accelerating object', () => {
    const smoother = new AccelerationSmoother(5);
    const dt = 1 / 60;
    // Velocity increases by 1 each frame
    for (let i = 0; i < 6; i++) {
      smoother.push(i, 0, 0);
    }
    const [ax, ay, az] = smoother.getSmoothedAcceleration(dt);
    expect(ax).toBeCloseTo(1 / dt, 0); // ~60
    expect(ay).toBe(0);
    expect(az).toBe(0);
  });

  it('returns [0,0,0] when fewer than 2 samples', () => {
    const smoother = new AccelerationSmoother(5);
    const dt = 1 / 60;
    smoother.push(1, 2, 3);
    const [ax, ay, az] = smoother.getSmoothedAcceleration(dt);
    expect(ax).toBe(0);
    expect(ay).toBe(0);
    expect(az).toBe(0);
  });

  it('reset clears the history', () => {
    const smoother = new AccelerationSmoother(5);
    const dt = 1 / 60;
    for (let i = 0; i < 6; i++) {
      smoother.push(i, 0, 0);
    }
    smoother.reset();
    const [ax, ay, az] = smoother.getSmoothedAcceleration(dt);
    expect(ax).toBe(0);
    expect(ay).toBe(0);
    expect(az).toBe(0);
  });
});

describe('energy conservation', () => {
  it('spring oscillator total energy drift is less than 5% over 30s simulation', () => {
    // Simulate a spring-mass oscillator: mass=1, k=100, L0=2
    // Initial position at x=3 (stretched by 1), no gravity
    const mass = 1;
    const k = 100;
    const L0 = 2;
    const dt = 1 / 240; // 240Hz for better energy conservation in test
    const totalSteps = 30 * 240; // 30 seconds

    let x = 3; // initial position
    let v = 0; // initial velocity

    const energies: number[] = [];

    for (let step = 0; step < totalSteps; step++) {
      // Spring force: F = -k * (x - L0)
      const force = -k * (x - L0);
      const a = force / mass;

      // Semi-implicit Euler integration
      v += a * dt;
      x += v * dt;

      // Compute energy
      const ke = 0.5 * mass * v * v;
      const peSpring = 0.5 * k * (x - L0) ** 2;
      const total = ke + peSpring;

      if (step % 240 === 0) {
        energies.push(total);
      }
    }

    const initialEnergy = energies[0];
    const maxEnergy = Math.max(...energies);
    const minEnergy = Math.min(...energies);

    const maxDrift = Math.max(
      Math.abs(maxEnergy - initialEnergy),
      Math.abs(minEnergy - initialEnergy),
    );
    const driftRatio = maxDrift / initialEnergy;

    expect(driftRatio).toBeLessThan(0.05);
  });
});
