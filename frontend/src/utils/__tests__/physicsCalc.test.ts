import { describe, it, expect } from 'vitest';
/**
 * physicsCalc — 能量计算 + 加速度 SMA 平滑 单元测试
 *
 * Plan 02-02 Task 1: 7 个 test case
 */

// We import the module under test — will fail on first run (RED phase)
describe('computeEnergy', () => {
  /**
   * Test 1: KE = 0.5 * m * |v|²
   * mass=2 kg, velocity=(3,4,0), speed=5 m/s, KE = 0.5 * 2 * 25 = 25 J
   */
  it('should compute kinetic energy correctly', () => {
    // Import after test file is in place — will be resolved in GREEN phase
    // For now, this test WILL FAIL because the module doesn't exist yet
    const { computeEnergy } = require('../physicsCalc');

    const mockRb = {
      linvel: () => ({ x: 3, y: 4, z: 0 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 2,
    };

    const result = computeEnergy(mockRb, 2, -9.81, 0, [], () => null);
    expect(result.ke).toBeCloseTo(25, 5);
    expect(result.peGravity).toBe(0); // y=0, ref=0
    expect(result.peSprings).toBe(0);
    expect(result.total).toBeCloseTo(25, 5);
  });

  /**
   * Test 2: PE_gravity = m * |g| * (y - peReferenceY)
   * mass=1 kg, y=5, peRef=0, g=-9.81 → 1 * 9.81 * 5 = 49.05 J
   */
  it('should compute gravitational potential energy correctly', () => {
    const { computeEnergy } = require('../physicsCalc');

    const mockRb = {
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      translation: () => ({ x: 0, y: 5, z: 0 }),
      mass: () => 1,
    };

    const result = computeEnergy(mockRb, 1, -9.81, 0, [], () => null);
    expect(result.peGravity).toBeCloseTo(49.05, 5);
    expect(result.ke).toBe(0);
  });

  /**
   * Test 3: PE_spring = 0.5 * k * (|Δx| - L0)²
   * stiffness=100, restLength=2, currentLength=3, delta=1
   * PE = 0.5 * 100 * 1² = 50 J
   */
  it('should compute spring potential energy correctly', () => {
    const { computeEnergy } = require('../physicsCalc');

    // Entity A at origin, Entity B at (3,0,0) → currentLength=3
    const getPos = (id: string) => {
      if (id === 'eA') return { x: 0, y: 0, z: 0 } as any;
      if (id === 'eB') return { x: 3, y: 0, z: 0 } as any;
      return null;
    };

    const mockRb = {
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      translation: () => ({ x: 0, y: 0, z: 0 }),
      mass: () => 1,
    };

    const springs = [
      { stiffness: 100, restLength: 2, entityAId: 'eA', entityBId: 'eB' },
    ];

    const result = computeEnergy(mockRb, 1, -9.81, 0, springs, getPos);
    expect(result.peSprings).toBeCloseTo(50, 5);
    expect(result.ke).toBe(0);
    expect(result.peGravity).toBe(0);
  });

  /**
   * Test 4: Total energy = KE + PE_gravity + PE_spring
   * Combine the above scenarios
   */
  it('should sum kinetic, gravitational, and spring potential energy', () => {
    const { computeEnergy } = require('../physicsCalc');

    const getPos = (id: string) => {
      if (id === 'eA') return { x: 0, y: 0, z: 0 } as any;
      if (id === 'eB') return { x: 3, y: 0, z: 0 } as any;
      return null;
    };

    // mass=2, vel=(3,4,0) → KE=25, y=5 → PE_grav=2*9.81*5=98.1, spring PE=50
    const mockRb = {
      linvel: () => ({ x: 3, y: 4, z: 0 }),
      translation: () => ({ x: 0, y: 5, z: 0 }),
      mass: () => 2,
    };

    const springs = [
      { stiffness: 100, restLength: 2, entityAId: 'eA', entityBId: 'eB' },
    ];

    const result = computeEnergy(mockRb, 2, -9.81, 0, springs, getPos);
    expect(result.ke).toBeCloseTo(25, 5);
    expect(result.peGravity).toBeCloseTo(98.1, 5);
    expect(result.peSprings).toBeCloseTo(50, 5);
    expect(result.total).toBeCloseTo(25 + 98.1 + 50, 5);
  });
});

describe('AccelerationSmoother', () => {
  /**
   * Test 5: Static body (vel=0 every frame)
   * After 5 samples, acceleration should be exactly 0
   * Must be < 0.05 m/s²
   */
  it('should report near-zero acceleration for a static body', () => {
    const { AccelerationSmoother } = require('../physicsCalc');

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

  /**
   * Test 6: Constant acceleration — velocity increases by 1 each frame
   * After 5 frames, smoothed acceleration should be ~1/dt
   */
  it('should detect constant acceleration correctly', () => {
    const { AccelerationSmoother } = require('../physicsCalc');

    const smoother = new AccelerationSmoother(5);
    const dt = 1 / 60;

    // vel: 0, 1, 2, 3, 4 (constant +1 per frame)
    for (let v = 0; v < 5; v++) {
      smoother.push(v, v, v);
    }

    const [ax, ay, az] = smoother.getSmoothedAcceleration(dt);
    const expectedAccel = 1 / dt; // 1 m/s per frame → 60 m/s²

    // Allow 10% tolerance for SMA averaging
    expect(ax).toBeCloseTo(expectedAccel, -1);
    expect(ay).toBeCloseTo(expectedAccel, -1);
    expect(az).toBeCloseTo(expectedAccel, -1);
  });
});

describe('Energy Conservation (spring oscillator)', () => {
  /**
   * Test 7: Spring oscillator — total energy (KE + PE_spring) drift < 5%
   * Simulate a 1D harmonic oscillator with analytic positions and velocities
   * Computed at 120 Hz for 30 seconds, then check relative total energy drift
   */
  it('should conserve total energy within 5% for a spring oscillator', () => {
    const { computeEnergy } = require('../physicsCalc');

    // Parameters for a 1D spring oscillator (no gravity)
    const mass = 1.0;
    const k = 10.0; // N/m
    const restLength = 1.0; // m
    const amplitude = 0.5; // m
    const omega = Math.sqrt(k / mass); // sqrt(10) ≈ 3.1623 rad/s

    const steps = 3600; // 30s @ 120 Hz
    const dt = 1 / 120;

    // Analytic solution: x(t) = restLength + A * cos(ω*t)
    //                   v(t) = -A * ω * sin(ω*t)
    const getPos = (id: string) => {
      if (id === 'eA') return { x: 0, y: 0, z: 0 } as any;
      if (id === 'eB') {
        const t = currentTime;
        const x = restLength + amplitude * Math.cos(omega * t);
        return { x, y: 0, z: 0 } as any;
      }
      return null;
    };

    let currentTime = 0;
    let initialTotalEnergy: number | null = null;
    let maxRelativeDrift = 0;

    const springs = [{ stiffness: k, restLength, entityAId: 'eA', entityBId: 'eB' }];

    for (let step = 0; step < steps; step++) {
      const t = step * dt;
      currentTime = t;

      const vx = -amplitude * omega * Math.sin(omega * t);
      const speedSq = vx * vx;

      const mockRb = {
        linvel: () => ({ x: vx, y: 0, z: 0 }),
        translation: () => {
          const x = restLength + amplitude * Math.cos(omega * t);
          return { x, y: 0, z: 0 };
        },
        mass: () => mass,
      };

      const result = computeEnergy(mockRb, mass, 0, 0, springs, getPos);

      if (initialTotalEnergy === null) {
        initialTotalEnergy = result.total;
      }

      if (initialTotalEnergy > 1e-10) {
        const drift = Math.abs(result.total - initialTotalEnergy) / initialTotalEnergy;
        if (drift > maxRelativeDrift) {
          maxRelativeDrift = drift;
        }
      }
    }

    // The energy drift relative to initial should be less than 5%
    expect(maxRelativeDrift).toBeLessThan(0.05);
  });
});
