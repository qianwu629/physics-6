import { describe, it, expect } from 'vitest';
import { computeFieldForce, computeTotalForce } from '../forceFieldCalc';
import type {
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
} from '../types';

const Z = { x: 0, y: 0, z: 0 };
const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;

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

  it('Test 2: gravity decay=true — body @ [2,0,0], field @ origin, strength=10, range=10 → |F|=2.5, 方向指向原点', () => {
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
    expect(close(mag, 10 / 4, 1e-9)).toBe(true);  // 2.5
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

  it('Test 5: electric — Q=1, q=1, r=1 → |F|=1; Q=1, q=-1 → 方向相反', () => {
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

    const Fpos = computeFieldForce(field, bodyPos, Z, 1);    // q=+1
    const magPos = Math.hypot(Fpos.x, Fpos.y, Fpos.z);
    expect(close(magPos, 1, 1e-9)).toBe(true);

    const Fneg = computeFieldForce(field, bodyPos, Z, -1);   // q=-1
    expect(close(Fneg.x, -Fpos.x, 1e-9)).toBe(true);
    expect(close(Fneg.y, -Fpos.y, 1e-9)).toBe(true);
    expect(close(Fneg.z, -Fpos.z, 1e-9)).toBe(true);
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
});
