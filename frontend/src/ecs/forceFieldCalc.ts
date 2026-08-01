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
 * - r < EPS_DISTANCE 时早退 → 0（避免除零放大）
 * - charge=0 短路（磁场无效）
 */

import type {
  ForceFieldComponent,
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
} from './types';

const EPS_DIRECTION = 1e-6; // 方向向量归一化阈值（无量纲）
export const SOFTENING = 0.5;     // Plummer 软化长度（m）— 防止 1/r² 奇点在 r→0 时力趋于无穷
export const COULOMB_K = 1000;   // 库仑缩放常数（N·m²/C²）— 使电场力在场景距离（1-20m）可见
                                  // 真实物理 k=8.99×10⁹，此处缩小以使仿真电荷产生合理力

type Vec3 = { x: number; y: number; z: number };

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < EPS_DIRECTION) {
    console.warn(`Direction vector too small: [${v.join(',')}], using zero vector`);
    return [0, 0, 0];
  }
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
  const rx = field.position[0] - pos.x;
  const ry = field.position[1] - pos.y;
  const rz = field.position[2] - pos.z;
  const r = Math.hypot(rx, ry, rz);

  if (r > field.range) return ZERO;

  if (field.decay) {
    // Plummer 软化: |F| = strength / (r² + ε²); 方向 = r_hat
    // 防止 r→0 时力爆炸（1/r² 奇点）
    const rSoft2 = r * r + SOFTENING * SOFTENING;
    const inv_rSoft3 = 1 / (rSoft2 * Math.sqrt(rSoft2));
    const k = field.strength * inv_rSoft3;
    return { x: rx * k, y: ry * k, z: rz * k };
  } else {
    // |F| = strength（恒定）；方向 = r_hat
    const k = field.strength / r;
    return { x: rx * k, y: ry * k, z: rz * k };
  }
}

function electric(field: ElectricFieldComponent, pos: Vec3, bodyCharge: number): Vec3 {
  // r_vec = pos - field.position — 从场源指向物体
  // Plummer 软化库仑定律: E = Q * r_vec / (r² + ε²)^(3/2)
  // F = q * E — 同号排斥(力沿 r_vec 方向)，异号吸引(力沿 -r_vec 方向)
  const rx = pos.x - field.position[0];
  const ry = pos.y - field.position[1];
  const rz = pos.z - field.position[2];
  const r = Math.hypot(rx, ry, rz);

  if (r > field.range) return ZERO;

  // Plummer 软化: E = Q * r_vec / (r² + ε²)^(3/2)
  // 在 r >> ε 时退化为标准库仑 E = Q * r_vec / r³
  // 在 r ≈ 0 时 E → Q * r_vec / ε³（有限值，不会爆炸）
  const rSoft2 = r * r + SOFTENING * SOFTENING;
  const inv_rSoft3 = 1 / (rSoft2 * Math.sqrt(rSoft2));
  const Ex = field.charge * rx * inv_rSoft3;
  const Ey = field.charge * ry * inv_rSoft3;
  const Ez = field.charge * rz * inv_rSoft3;

  return {
    x: COULOMB_K * bodyCharge * Ex,
    y: COULOMB_K * bodyCharge * Ey,
    z: COULOMB_K * bodyCharge * Ez,
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

/**
 * 多力场矢量叠加（排除磁场）。
 * 用于力注入路径（ForceFieldSystem 中以 applyImpulse(F·dt) 施加）——磁场力通过
 * 罗德里格斯旋转单独施加，不能与常规力混合，否则会导致双重施加和能量不守恒。
 */
export function computeNonMagneticForce(
  fields: ForceFieldComponent[],
  bodyPos: Vec3,
  bodyCharge: number,
): Vec3 {
  let sx = 0;
  let sy = 0;
  let sz = 0;

  for (const field of fields) {
    // 跳过磁场——磁场力由 rotateVelocityByMagneticField 单独处理
    if (field.kind === 'magnetic') continue;
    // 磁场外其余三种力场（uniform/gravity/electric）均不依赖速度，vel 传零向量即可
    const f = computeFieldForce(field, bodyPos, ZERO, bodyCharge);
    if (!isFiniteVec(f)) continue;
    sx += f.x;
    sy += f.y;
    sz += f.z;
  }

  const out: Vec3 = { x: sx, y: sy, z: sz };
  if (!isFiniteVec(out)) return ZERO;
  return out;
}

// ─────────── 磁场能量守恒处理 — 罗德里格斯旋转 ───────────

/**
 * 计算所有磁场叠加后的总 B 向量（strength * normalize(direction) 之和）。
 * 用于能量守恒的磁场处理（绕过 addForce，直接旋转速度）。
 */
export function computeTotalMagneticField(
  fields: ForceFieldComponent[],
  bodyCharge: number,
): Vec3 {
  if (bodyCharge === 0) return ZERO;

  let bx = 0;
  let by = 0;
  let bz = 0;

  for (const field of fields) {
    if (field.kind !== 'magnetic') continue;
    const dir = normalize3(field.direction);
    bx += field.strength * dir[0];
    by += field.strength * dir[1];
    bz += field.strength * dir[2];
  }

  const out: Vec3 = { x: bx, y: by, z: bz };
  if (!isFiniteVec(out)) return ZERO;
  return out;
}

/**
 * 用罗德里格斯旋转公式将速度向量绕磁场方向旋转，模拟洛伦兹力的能量守恒效果。
 *
 * 半隐式欧拉对速度相关力 F = q(v × B) 的显式处理会导致数值能量不守恒
 * （v_{n+1}² = v_n² × (1 + (qB/m × dt)²)）。
 * 这里直接旋转速度向量，保证 |v| 严格不变。
 *
 * @param vel   当前速度
 * @param B     总磁场向量（已包含 strength）
 * @param bodyCharge 物体电荷
 * @param mass  物体质量
 * @param dt    物理步长
 */
export function rotateVelocityByMagneticField(
  vel: Vec3,
  B: Vec3,
  bodyCharge: number,
  mass: number,
  dt: number,
): Vec3 {
  if (bodyCharge === 0 || mass <= 0) return vel;

  const Bmag = Math.hypot(B.x, B.y, B.z);
  if (Bmag < EPS_DIRECTION) return vel;

  // 角频率 ω = q|B|/m，旋转角度 θ = -ω × dt
  // 注意负号：洛伦兹力 F = q(v × B)，即 dv/dt = (q/m)(v × B) = -(q/m)(B × v)，
  // 所以速度是绕 k = B/|B| 以负角速度旋转。若漏掉负号，正电荷偏转方向会与
  // q(v × B) 相反（手性翻转），且与 VectorRenderer 显示的受力箭头矛盾。
  const omega = (bodyCharge * Bmag) / mass;
  const theta = -omega * dt;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // k = B / |B|（单位向量）
  const kx = B.x / Bmag;
  const ky = B.y / Bmag;
  const kz = B.z / Bmag;

  // 罗德里格斯公式：v_rot = v·cos(θ) + (k × v)·sin(θ) + k·(k·v)·(1 − cos(θ))
  // θ 带负号后，一阶项 ≈ -(q/m)|B|(k × v)·dt = (q/m)(v × B)·dt，与洛伦兹力一致。
  const kdotv = kx * vel.x + ky * vel.y + kz * vel.z;

  const crossX = ky * vel.z - kz * vel.y;
  const crossY = kz * vel.x - kx * vel.z;
  const crossZ = kx * vel.y - ky * vel.x;

  const out: Vec3 = {
    x: vel.x * cosT + crossX * sinT + kx * kdotv * (1 - cosT),
    y: vel.y * cosT + crossY * sinT + ky * kdotv * (1 - cosT),
    z: vel.z * cosT + crossZ * sinT + kz * kdotv * (1 - cosT),
  };

  if (!isFiniteVec(out)) return vel;
  return out;
}
