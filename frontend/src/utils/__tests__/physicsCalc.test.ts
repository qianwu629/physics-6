import { describe, it, expect } from 'vitest';
import { computeEnergy, AccelerationSmoother } from '../physicsCalc';

/**
 * physicsCalc — 能量计算 + 加速度 SMA 平滑 单元测试
 *
 * Plan 02-02 Task 1: 7 个 test case
 */

describe('computeEnergy', () => {
  /**
   * Test 1: KE = 0.5 * m * |v|²
   * mass=2 kg, velocity=(3,4,0), speed=5 m/s, KE = 0.5 * 2 * 25 = 25 J
   */
  it('should compute kinetic energy correctly', () => {
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
   * Test 2: PE_gravity = -m * gY * (y - peReferenceY)
   * mass=1 kg, y=5, peRef=0, gY=-9.81 → -1 * (-9.81) * 5 = 49.05 J
   */
  it('should compute gravitational potential energy correctly', () => {
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
   * Test 2b (W-07 regression): 向上重力场景, PE 应为负
   * mass=1, y=5, peRef=0, gY=+5 → -1 * 5 * 5 = -25 J
   * (旧实现 Math.abs(gravityY) 会得到 +25 J, 违反能量守恒)
   */
  it('should give negative PE_gravity for upward gravity (W-07 fix)', () => {
    const mockRb = {
      linvel: () => ({ x: 0, y: 0, z: 0 }),
      translation: () => ({ x: 0, y: 5, z: 0 }),
      mass: () => 1,
    };

    const result = computeEnergy(mockRb, 1, 5, 0, [], () => null);
    expect(result.peGravity).toBeCloseTo(-25, 5);
    expect(result.ke).toBe(0);
  });

  /**
   * Test 3: PE_spring = 0.5 * k * (|Δx| - L0)²
   * stiffness=100, restLength=2, currentLength=3, delta=1
   * PE = 0.5 * 100 * 1² = 50 J
   */
  it('should compute spring potential energy correctly', () => {
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

describe('AccelerationSmoother（最小二乘拟合）', () => {
  /**
   * Test 5: Static body (vel=0 every frame)
   * Acceleration should be exactly 0
   */
  it('should report near-zero acceleration for a static body', () => {
    const smoother = new AccelerationSmoother();
    const dt = 1 / 60;

    for (let i = 0; i < 16; i++) {
      smoother.push(i * dt, 0, 0, 0);
    }

    const [ax, ay, az] = smoother.getSmoothedAcceleration();

    expect(ax).toBe(0);
    expect(ay).toBe(0);
    expect(az).toBe(0);
  });

  /**
   * Test 6: Constant acceleration — velocity increases linearly
   * Least-squares slope should recover the exact acceleration
   */
  it('should detect constant acceleration correctly', () => {
    const smoother = new AccelerationSmoother();
    const dt = 1 / 60;

    // v(t) = 60·t → a = 60 m/s²
    for (let i = 0; i < 16; i++) {
      const t = i * dt;
      const v = 60 * t;
      smoother.push(t, v, v, v);
    }

    const [ax, ay, az] = smoother.getSmoothedAcceleration();

    expect(ax).toBeCloseTo(60, 6);
    expect(ay).toBeCloseTo(60, 6);
    expect(az).toBeCloseTo(60, 6);
  });

  /**
   * Test 7: 采样时刻抖动（rAF ±3ms）下斜率仍稳定
   * 旧固定 dt 差分法在此场景直接把时序抖动转成加速度抖动
   */
  it('should be robust to sampling-time jitter', () => {
    const smoother = new AccelerationSmoother();
    const dt = 1 / 60;
    const jitter = [0.003, -0.002, 0.001, -0.003, 0.002, -0.001, 0.003, -0.002, 0.001, -0.003, 0.002, -0.001, 0.003, -0.002, 0.001, 0];

    // v(t) = 60·t，采样时刻叠加抖动
    for (let i = 0; i < 16; i++) {
      const t = i * dt + jitter[i];
      const v = 60 * t;
      smoother.push(t, v, v, v);
    }

    const [ax] = smoother.getSmoothedAcceleration();
    expect(Math.abs(ax - 60)).toBeLessThan(2); // 斜率偏差 < 3.3%
  });

  /**
   * Test 8: 高频噪声衰减 — 带噪声的速度信号，拟合斜率接近真值
   */
  it('should damp high-frequency velocity noise', () => {
    const smoother = new AccelerationSmoother();
    const dt = 1 / 60;

    // v(t) = 60·t + 0.1·sin(2π·30·t)（30Hz 噪声，幅值 0.1 m/s）
    for (let i = 0; i < 16; i++) {
      const t = i * dt;
      const v = 60 * t + 0.1 * Math.sin(2 * Math.PI * 30 * t);
      smoother.push(t, v, 0, 0);
    }

    const [ax] = smoother.getSmoothedAcceleration();
    // 真值 60；噪声经 0.25s 窗口拟合后残余应远小于单步差分（0.1·2π·30 ≈ 18.8 m/s²）
    expect(Math.abs(ax - 60)).toBeLessThan(4);
  });

  /**
   * Test 9: 样本不足 2 个返回 [0,0,0]；reset 清空
   */
  it('should return zero with fewer than 2 samples and after reset', () => {
    const smoother = new AccelerationSmoother();
    expect(smoother.getSmoothedAcceleration()).toEqual([0, 0, 0]);
    smoother.push(0, 5, 5, 5);
    expect(smoother.getSmoothedAcceleration()).toEqual([0, 0, 0]);
    smoother.push(1 / 60, 6, 6, 6);
    const [ax] = smoother.getSmoothedAcceleration();
    expect(ax).toBeCloseTo(60, 6);
    smoother.reset();
    expect(smoother.getSmoothedAcceleration()).toEqual([0, 0, 0]);
  });
});

describe('Energy Conservation (spring oscillator)', () => {
  /**
   * Test 7: Spring oscillator — total energy (KE + PE_spring) drift < 5%
   * Simulate a 1D harmonic oscillator with analytic positions and velocities
   * Computed at 120 Hz for 30 seconds, then check relative total energy drift
   */
  it('should conserve total energy within 5% for a spring oscillator', () => {
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
