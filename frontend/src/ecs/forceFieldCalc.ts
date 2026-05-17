/**
 * 力场物理计算 — Phase 3 D-03-02 (Plan 03-02)
 *
 * 实现 4 种预设力场的力计算，外加多力场叠加。
 *
 * 公式（来自 RESEARCH.md §1）：
 * - uniform : F = strength * normalize(direction)
 * - gravity : r_vec = field.pos - body.pos; r = |r_vec|;
 *             decay=true  → F = -strength * r_vec / r^3   (1/r² 衰减)
 *             decay=false → F = -strength * r_hat         (恒定大小)
 *             范围外 / r<0.001 → 0
 * - electric: r_vec = field.pos - body.pos; r = |r_vec|;
 *             E = field.charge * r_vec / r^3 (k=1 数值缩放)
 *             F = body.charge * E
 *             范围外 / r<0.001 → 0
 * - magnetic: F = body.charge * (v × B), B = strength * normalize(direction)
 *             body.charge=0 时短路为 0
 *
 * 防御性编程：
 * - 任意分量为 NaN/Infinity → 整个结果返回 {0,0,0}（T-03-03）
 * - r < EPS_R 时早退 → 0（避免除零放大）
 * - charge=0 短路（磁场无效）
 */

import type {
  ForceFieldComponent,
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
} from './types';

const EPS_R = 0.001;        // 距离下限（小于则视为重合，力为 0）

type Vec3 = { x: number; y: number; z: number };

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < EPS_R) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ─────────── 单一力场计算 ───────────

function uniform(field: UniformFieldComponent): Vec3 {
  const dir = normalize3(field.direction);
  return {
    x: field.strength * dir[0],
    y: field.strength * dir[1],
    z: field.strength * dir[2],
  };
}

function gravity(field: GravityFieldComponent, pos: Vec3): Vec3 {
  // r_vec = field.pos - body.pos —— 从 body 指向场源；吸引力沿 +r_vec 方向。
  // 注：PLAN 公式写作 "F = -strength * r_vec / r^3"，但要让方向"指向场源"（Test 2/3 期望），
  //     当 r_vec = field - body 时正确系数是 +strength（不是 -strength）。
  const rx = field.position[0] - pos.x;
  const ry = field.position[1] - pos.y;
  const rz = field.position[2] - pos.z;
  const r = Math.hypot(rx, ry, rz);

  if (r > field.range || r < EPS_R) return ZERO;

  if (field.decay) {
    // |F| = strength / r^2; 方向 = r_hat（指向场源）
    const k = field.strength / (r * r * r);
    return { x: rx * k, y: ry * k, z: rz * k };
  } else {
    // |F| = strength（恒定）；方向 = r_hat
    const k = field.strength / r;
    return { x: rx * k, y: ry * k, z: rz * k };
  }
}

function electric(field: ElectricFieldComponent, pos: Vec3, bodyCharge: number): Vec3 {
  // r_vec = field.pos - body.pos
  const rx = field.position[0] - pos.x;
  const ry = field.position[1] - pos.y;
  const rz = field.position[2] - pos.z;
  const r = Math.hypot(rx, ry, rz);

  if (r > field.range || r < EPS_R) return ZERO;

  // 严格遵循 PLAN 公式：E = Q * r_vec / r^3, F = q * E（k=1 数值缩放）。
  // 注：r_vec 指向场源，这与教科书库仑公式（E 从源指向场点）方向相反；
  //     符号约定影响相互作用方向，但 |F| 大小不变。Test 5 验证大小 + 翻转 q 后方向相反，符合 PLAN。
  const inv_r3 = 1 / (r * r * r);
  const Ex = field.charge * rx * inv_r3;
  const Ey = field.charge * ry * inv_r3;
  const Ez = field.charge * rz * inv_r3;

  return {
    x: bodyCharge * Ex,
    y: bodyCharge * Ey,
    z: bodyCharge * Ez,
  };
}

function magnetic(
  field: MagneticFieldComponent,
  vel: Vec3,
  bodyCharge: number,
): Vec3 {
  if (bodyCharge === 0) return ZERO;

  const dir = normalize3(field.direction);
  const Bx = field.strength * dir[0];
  const By = field.strength * dir[1];
  const Bz = field.strength * dir[2];

  // F = q * (v × B)
  // v × B = (vy*Bz - vz*By, vz*Bx - vx*Bz, vx*By - vy*Bx)
  const cx = vel.y * Bz - vel.z * By;
  const cy = vel.z * Bx - vel.x * Bz;
  const cz = vel.x * By - vel.y * Bx;

  return {
    x: bodyCharge * cx,
    y: bodyCharge * cy,
    z: bodyCharge * cz,
  };
}

// ─────────── 公开 API ───────────

/**
 * 计算单个力场对刚体的作用力。
 * 输入参数无效或越界时返回 {0,0,0}。
 */
export function computeFieldForce(
  field: ForceFieldComponent,
  bodyPos: Vec3,
  bodyVel: Vec3,
  bodyCharge: number,
): Vec3 {
  let f: Vec3;

  switch (field.kind) {
    case 'uniform':
      f = uniform(field);
      break;
    case 'gravity':
      f = gravity(field, bodyPos);
      break;
    case 'electric':
      f = electric(field, bodyPos, bodyCharge);
      break;
    case 'magnetic':
      f = magnetic(field, bodyVel, bodyCharge);
      break;
    default: {
      // 不可达分支（穷尽判别）—— 防御性
      const _exhaustive: never = field;
      void _exhaustive;
      return ZERO;
    }
  }

  if (!isFiniteVec(f)) return ZERO;
  return f;
}

/**
 * 多力场矢量叠加。
 * 任一中间结果含 NaN/Infinity 时该项被丢弃；最终结果若仍含 NaN/Infinity 则返回 {0,0,0}。
 */
export function computeTotalForce(
  fields: ForceFieldComponent[],
  bodyPos: Vec3,
  bodyVel: Vec3,
  bodyCharge: number,
): Vec3 {
  let sx = 0;
  let sy = 0;
  let sz = 0;

  for (const field of fields) {
    const f = computeFieldForce(field, bodyPos, bodyVel, bodyCharge);
    // computeFieldForce 已保证 finite；此处仍兜底防御。
    if (!isFiniteVec(f)) continue;
    sx += f.x;
    sy += f.y;
    sz += f.z;
  }

  const out: Vec3 = { x: sx, y: sy, z: sz };
  if (!isFiniteVec(out)) return ZERO;
  return out;
}
