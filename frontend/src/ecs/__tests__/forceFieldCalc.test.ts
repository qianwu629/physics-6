import { describe, it, expect } from 'vitest';
import {
  computeFieldForce,
  computeTotalForce,
  computeNonMagneticForce,
  computeTotalMagneticField,
  rotateVelocityByMagneticField,
} from '../forceFieldCalc';
import type {
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
} from '../types';

const Z = { x: 0, y: 0, z: 0 };
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;

// Plummer 软化参数 + 库仑缩放常数（与 forceFieldCalc.ts 保持一致）
const EPS = 0.5;
const EPS_SQ = EPS * EPS;
const COULOMB_K = 1000;

/** 计算 Plummer 软化后的 1/r³ 替代因子: 1 / (r² + ε²)^(3/2) */
const softenedInvR3 = (r: number) => {
  const rSoft2 = r * r + EPS_SQ;
  return 1 / (rSoft2 * Math.sqrt(rSoft2));
};

describe('forceFieldCalc — 4 kinds + multi-field superposition', () => {
  it('Test 1: uniform field — direction=[0,1,0], strength=5 → F={0,5,0}', () => {
    const field: UniformFieldComponent = {
      type: 'forceField',
      kind: 'uniform',
      position: [0, 0, 0],
      range: 100,
      direction: [0, 1, 0],
      strength: 5,
    };
    const F = computeFieldForce(field, Z, Z, 0);
    expect(close(F.x, 0)).toBe(true);
    expect(close(F.y, 5)).toBe(true);
    expect(close(F.z, 0)).toBe(true);
  });

  it('Test 2: gravity decay=true — body @ [2,0,0], field @ origin, strength=10, range=10 → Plummer 软化力', () => {
    const field: GravityFieldComponent = {
      type: 'forceField',
      kind: 'gravity',
      position: [0, 0, 0],
      range: 10,
      strength: 10,
      decay: true,
    };
    const bodyPos = { x: 2, y: 0, z: 0 };
    const F = computeFieldForce(field, bodyPos, Z, 0);
    const mag = Math.hypot(F.x, F.y, F.z);
    // Plummer 软化: |F| = strength × r / (r² + ε²)^(3/2)
    const r = 2;
    const expectedMag = field.strength * r * softenedInvR3(r);
    expect(close(mag, expectedMag, 1e-6)).toBe(true);
    // 方向指向原点：从 [2,0,0] → [0,0,0]，方向 = (-1, 0, 0)
    expect(F.x < 0).toBe(true);
    expect(close(F.y, 0)).toBe(true);
    expect(close(F.z, 0)).toBe(true);
  });

  it('Test 3: gravity decay=false — same position → |F|=strength=10, 方向指向原点', () => {
    const field: GravityFieldComponent = {
      type: 'forceField',
      kind: 'gravity',
      position: [0, 0, 0],
      range: 10,
      strength: 10,
      decay: false,
    };
    const bodyPos = { x: 2, y: 0, z: 0 };
    const F = computeFieldForce(field, bodyPos, Z, 0);
    const mag = Math.hypot(F.x, F.y, F.z);
    expect(close(mag, 10, 1e-9)).toBe(true);
    expect(F.x < 0).toBe(true);  // 指向原点
    expect(close(F.y, 0)).toBe(true);
    expect(close(F.z, 0)).toBe(true);
  });

  it('Test 4: gravity cutoff — body @ [20,0,0], range=10 → F={0,0,0}', () => {
    const field: GravityFieldComponent = {
      type: 'forceField',
      kind: 'gravity',
      position: [0, 0, 0],
      range: 10,
      strength: 100,
      decay: true,
    };
    const F = computeFieldForce(field, { x: 20, y: 0, z: 0 }, Z, 0);
    expect(F).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('Test 5: electric — Plummer 软化库仑力; Q=1, q=1, r=1; q=-1 → 方向相反', () => {
    const field: ElectricFieldComponent = {
      type: 'forceField',
      kind: 'electric',
      position: [0, 0, 0],
      range: 100,
      charge: 1,
      decay: true,
    };
    // body @ [1,0,0]，r=1
    const bodyPos = { x: 1, y: 0, z: 0 };
    const r = 1;

    const Fpos = computeFieldForce(field, bodyPos, Z, 1);    // q=+1
    const magPos = Math.hypot(Fpos.x, Fpos.y, Fpos.z);
    // Plummer 软化: |F| = qQ × r / (r² + ε²)^(3/2)
    const expectedMag = COULOMB_K * 1 * 1 * r * softenedInvR3(r);
    expect(close(magPos, expectedMag, 1e-6)).toBe(true);

    // 同号相斥：场源在原点、物体在 +x，斥力必须把物体往 +x 推
    expect(Fpos.x > 0).toBe(true);
    expect(close(Fpos.y, 0, 1e-9)).toBe(true);
    expect(close(Fpos.z, 0, 1e-9)).toBe(true);

    const Fneg = computeFieldForce(field, bodyPos, Z, -1);   // q=-1（异号相吸，指向 -x）
    expect(close(Fneg.x, -Fpos.x, 1e-9)).toBe(true);
    expect(close(Fneg.y, -Fpos.y, 1e-9)).toBe(true);
    expect(close(Fneg.z, -Fpos.z, 1e-9)).toBe(true);
    expect(Fneg.x < 0).toBe(true);
  });

  it('Test 6: magnetic — v=[1,0,0], direction=[0,0,1], strength=1, q=1 → F={0,-1,0}', () => {
    const field: MagneticFieldComponent = {
      type: 'forceField',
      kind: 'magnetic',
      position: [0, 0, 0],
      range: 100,
      direction: [0, 0, 1],
      strength: 1,
    };
    const F = computeFieldForce(field, Z, { x: 1, y: 0, z: 0 }, 1);
    expect(close(F.x, 0, 1e-9)).toBe(true);
    expect(close(F.y, -1, 1e-9)).toBe(true);
    expect(close(F.z, 0, 1e-9)).toBe(true);
  });

  it('Test 7: magnetic q=0 → F={0,0,0}', () => {
    const field: MagneticFieldComponent = {
      type: 'forceField',
      kind: 'magnetic',
      position: [0, 0, 0],
      range: 100,
      direction: [0, 0, 1],
      strength: 1,
    };
    const F = computeFieldForce(field, Z, { x: 5, y: 3, z: -2 }, 0);
    expect(F).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('Test 8: multi-field 叠加 — 2 个同向 uniform → 合力 = 2 × 单力', () => {
    const f1: UniformFieldComponent = {
      type: 'forceField',
      kind: 'uniform',
      position: [0, 0, 0],
      range: 100,
      direction: [0, 1, 0],
      strength: 5,
    };
    const f2: UniformFieldComponent = {
      type: 'forceField',
      kind: 'uniform',
      position: [10, 0, 0],
      range: 100,
      direction: [0, 1, 0],
      strength: 5,
    };
    const single = computeFieldForce(f1, Z, Z, 0);
    const total = computeTotalForce([f1, f2], Z, Z, 0);
    expect(close(total.x, 2 * single.x, 1e-9)).toBe(true);
    expect(close(total.y, 2 * single.y, 1e-9)).toBe(true);
    expect(close(total.z, 2 * single.z, 1e-9)).toBe(true);
    expect(close(total.y, 10, 1e-9)).toBe(true);
  });

  it('Test 9: Plummer 软化防止奇点 — r=0.01 时力有界（不会爆炸到万级）', () => {
    const field: ElectricFieldComponent = {
      type: 'forceField',
      kind: 'electric',
      position: [0, 0, 0],
      range: 100,
      charge: 1,
      decay: true,
    };
    // body 0.01m from source — 标准 Coulomb 会给出 13000 N，但软化后有界
    const bodyPos = { x: 0.01, y: 0, z: 0 };
    const F = computeFieldForce(field, bodyPos, Z, 1.3);
    const mag = Math.hypot(F.x, F.y, F.z);
    // Plummer 软化 + COULOMB_K: |F| = k × qQ × r / (r²+ε²)^(3/2) = 1000 × 1.3 × 0.01 / 0.125 = 104 N
    expect(mag < 200).toBe(true);  // 力有界（不会爆炸到万级，无软化时 13000 N）
    expect(mag > 0).toBe(true);   // 力不为零（仍然有物理效果）
  });

  it('Test 10: Plummer 软化 r=0 → F={0,0,0}（重合时力为零）', () => {
    const field: ElectricFieldComponent = {
      type: 'forceField',
      kind: 'electric',
      position: [0, 0, 0],
      range: 100,
      charge: 1,
      decay: true,
    };
    // body at exact source position — r_vec = 0, so F = 0
    const bodyPos = { x: 0, y: 0, z: 0 };
    const F = computeFieldForce(field, bodyPos, Z, 1);
    expect(F).toEqual({ x: 0, y: 0, z: 0 });
  });
});

// ─────────── 磁场旋转路径（能量守恒修复的核心） ───────────

describe('rotateVelocityByMagneticField — 能量守恒与洛伦兹方向', () => {
  const DT = 1 / 120;

  it('Test 11: 能量守恒 — 旋转 1200 步（10 秒）后 |v| 严格不变', () => {
    // 磁场爆炸 bug 的核心回归测试：洛伦兹力不做功，动能必须守恒
    const B = { x: 0, y: 0, z: 2 };
    let v = { x: 3, y: 0, z: 1 }; // 含平行分量，覆盖螺旋运动情形
    const v0mag = Math.hypot(v.x, v.y, v.z);

    for (let i = 0; i < 1200; i++) {
      v = rotateVelocityByMagneticField(v, B, 1, 1, DT);
    }

    const vMag = Math.hypot(v.x, v.y, v.z);
    expect(close(vMag, v0mag, 1e-9)).toBe(true);
    // 平行于 B 的分量不受洛伦兹力，必须保持不变
    expect(close(v.z, 1, 1e-9)).toBe(true);
  });

  it('Test 12: 偏转方向与 q(v × B) 一致 — 正电荷 v=+x, B=+z → 偏向 -y', () => {
    // q(v × B) = 1 × (1,0,0) × (0,0,2) = (0,-2,0) → 单步后 vy 必须为负
    const B = { x: 0, y: 0, z: 2 };
    const v = { x: 1, y: 0, z: 0 };
    const out = rotateVelocityByMagneticField(v, B, 1, 1, DT);
    expect(out.y < 0).toBe(true);
    expect(close(out.z, 0, 1e-12)).toBe(true);
  });

  it('Test 13: 负电荷偏转方向相反 — q=-1 → 偏向 +y', () => {
    const B = { x: 0, y: 0, z: 2 };
    const v = { x: 1, y: 0, z: 0 };
    const out = rotateVelocityByMagneticField(v, B, -1, 1, DT);
    expect(out.y > 0).toBe(true);
  });

  it('Test 14: 回旋方向与解析圆周运动吻合 — 1/4 周期后 v 旋转 90°', () => {
    // ω = qB/m = 1，回旋周期 T = 2π。步进 T/4 后，v=(1,0,0) → (0,-1,0)
    const B = { x: 0, y: 0, z: 1 };
    let v = { x: 1, y: 0, z: 0 };
    const steps = Math.round((Math.PI / 2) / DT); // ω=1 时 1/4 周期的步数（有取整误差）
    for (let i = 0; i < steps; i++) {
      v = rotateVelocityByMagneticField(v, B, 1, 1, DT);
    }
    // 与解析解对比：旋转角 = steps × DT（含步进取整），方向为顺时针（-y 侧）
    const angle = steps * DT;
    expect(close(v.x, Math.cos(angle), 1e-9)).toBe(true);
    expect(close(v.y, -Math.sin(angle), 1e-9)).toBe(true);
    expect(close(v.z, 0, 1e-9)).toBe(true);
  });

  it('Test 15: 退化输入 — q=0 / mass=0 / B=0 时速度原样返回', () => {
    const v = { x: 1, y: 2, z: 3 };
    expect(rotateVelocityByMagneticField(v, { x: 0, y: 0, z: 1 }, 0, 1, DT)).toEqual(v);
    expect(rotateVelocityByMagneticField(v, { x: 0, y: 0, z: 1 }, 1, 0, DT)).toEqual(v);
    expect(rotateVelocityByMagneticField(v, { x: 0, y: 0, z: 0 }, 1, 1, DT)).toEqual(v);
  });
});

describe('computeNonMagneticForce / computeTotalMagneticField — 磁场分离', () => {
  const magneticField: MagneticFieldComponent = {
    type: 'forceField',
    kind: 'magnetic',
    position: [0, 0, 0],
    range: 100,
    direction: [0, 0, 1],
    strength: 2,
  };
  const uniformField: UniformFieldComponent = {
    type: 'forceField',
    kind: 'uniform',
    position: [0, 0, 0],
    range: 100,
    direction: [0, 1, 0],
    strength: 5,
  };

  it('Test 16: computeNonMagneticForce 排除磁场（防止与旋转路径双重施加）', () => {
    const F = computeNonMagneticForce([magneticField, uniformField], Z, 1);
    expect(F).toEqual({ x: 0, y: 5, z: 0 });
  });

  it('Test 17: computeTotalMagneticField 叠加多个磁场，q=0 短路为零', () => {
    const m2: MagneticFieldComponent = { ...magneticField, direction: [1, 0, 0], strength: 3 };
    const B = computeTotalMagneticField([magneticField, m2], 1);
    expect(close(B.x, 3, 1e-9)).toBe(true);
    expect(close(B.z, 2, 1e-9)).toBe(true);
    expect(computeTotalMagneticField([magneticField], 0)).toEqual({ x: 0, y: 0, z: 0 });
  });
});
