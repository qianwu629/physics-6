/**
 * 场源物理计算 — 场-源关系（Phase 8）
 *
 * 实体自身作为场源，与 forceFieldCalc.ts 的预设外场互补：
 * - 电荷源：任何 charge≠0 的实体自动成为库仑场源，对其他带电实体施加力。
 *   公式与 forceFieldCalc 的 electric 完全一致（同一 COULOMB_K / SOFTENING 缩放约定）：
 *     F = COULOMB_K · Qs · Qt · r_vec / (r² + ε²)^(3/2)
 *   r_vec 从场源指向目标 —— 同号相斥、异号相吸。
 * - 电流源：CurrentSourceComponent 实体等效为无限长直导线（毕奥-萨伐尔简化）：
 *     B = WIRE_B_K · I / r_perp，方向 = d × r̂_perp（右手定则）
 *   产生的 B 由 ForceFieldSystem 并入罗德里格斯旋转路径，能量严格守恒。
 *
 * 防御性编程（与 forceFieldCalc 同约定）：
 * - 任意分量为 NaN/Infinity → 该项丢弃；最终仍非法 → {0,0,0}
 * - 自相互作用通过 excludeId 排除
 * - 距离截断 MAX_RANGE；库仑力上限 MAX_FORCE；导线 B 场 r→0 钳位 MIN_WIRE_DIST
 */

import { COULOMB_K, SOFTENING } from './forceFieldCalc';

type Vec3 = { x: number; y: number; z: number };

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

const MAX_RANGE = 100;      // 场源作用距离截断 (m)
const MAX_FORCE = 1e6;      // 库仑合力上限 (N) — 防御数值爆炸
const MIN_WIRE_DIST = 0.1;  // 导线 B 场最近垂直距离 (m) — r→0 钳位
const EPS_DIRECTION = 1e-6; // 方向向量归一化阈值

/** 教学缩放 μ₀/2π (T·m/A) — I=10A、r=1m 时 B=2T，带电粒子偏转可见 */
export const WIRE_B_K = 0.2;

function isFiniteVec(v: Vec3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

// ─────────── 电荷源：库仑力 ───────────

export interface ChargeSource {
  id: string;
  position: [number, number, number];
  charge: number;
}

/**
 * 所有电荷源对目标带电体的库仑合力。
 * targetCharge=0 时短路为 0；与 targetId 相同的源（自身）被排除。
 */
export function computeCoulombForce(
  sources: ChargeSource[],
  targetId: string,
  targetPos: Vec3,
  targetCharge: number,
): Vec3 {
  if (targetCharge === 0) return ZERO;

  let sx = 0;
  let sy = 0;
  let sz = 0;

  for (const src of sources) {
    if (src.id === targetId) continue;
    if (src.charge === 0) continue;

    const rx = targetPos.x - src.position[0];
    const ry = targetPos.y - src.position[1];
    const rz = targetPos.z - src.position[2];
    const r = Math.hypot(rx, ry, rz);

    if (r > MAX_RANGE) continue;

    // Plummer 软化库仑定律（同 forceFieldCalc electric）：
    // r≫ε 退化为标准 1/r²；r≈0 时有限不爆炸
    const rSoft2 = r * r + SOFTENING * SOFTENING;
    const inv_rSoft3 = 1 / (rSoft2 * Math.sqrt(rSoft2));
    const k = COULOMB_K * src.charge * targetCharge * inv_rSoft3;

    sx += rx * k;
    sy += ry * k;
    sz += rz * k;
  }

  let out: Vec3 = { x: sx, y: sy, z: sz };
  if (!isFiniteVec(out)) return ZERO;

  const mag = Math.hypot(out.x, out.y, out.z);
  if (mag > MAX_FORCE) {
    const s = MAX_FORCE / mag;
    out = { x: out.x * s, y: out.y * s, z: out.z * s };
  }
  return out;
}

// ─────────── 电流源：直导线磁场 ───────────

export interface WireSource {
  position: [number, number, number];
  current: number;                    // 电流 (A)，负值反向
  direction: [number, number, number]; // 电流方向（世界坐标系，内部归一化）
}

/**
 * 所有电流源（无限长直导线）在 targetPos 处叠加的 B 场。
 * B = WIRE_B_K · I / r_perp，方向 d × r̂_perp（右手定则）。
 * 目标在轴线上（r_perp≈0，B 方向未定义）时该源跳过。
 */
export function computeWireMagneticField(wires: WireSource[], targetPos: Vec3): Vec3 {
  let bx = 0;
  let by = 0;
  let bz = 0;

  for (const wire of wires) {
    if (wire.current === 0) continue;

    const dLen = Math.hypot(wire.direction[0], wire.direction[1], wire.direction[2]);
    if (dLen < EPS_DIRECTION) continue;
    const dx = wire.direction[0] / dLen;
    const dy = wire.direction[1] / dLen;
    const dz = wire.direction[2] / dLen;

    // w = target - wirePos；r_perp = w − (w·d)d（目标相对导线轴线的垂直分量）
    const wx = targetPos.x - wire.position[0];
    const wy = targetPos.y - wire.position[1];
    const wz = targetPos.z - wire.position[2];
    const wdotd = wx * dx + wy * dy + wz * dz;
    const px = wx - wdotd * dx;
    const py = wy - wdotd * dy;
    const pz = wz - wdotd * dz;
    const r = Math.hypot(px, py, pz);

    if (r < EPS_DIRECTION) continue; // 轴线上 B 方向未定义
    if (r > MAX_RANGE) continue;

    const rEff = Math.max(r, MIN_WIRE_DIST);
    const bmag = (WIRE_B_K * wire.current) / rEff;

    // B 方向 = d × r̂_perp
    const ux = px / r;
    const uy = py / r;
    const uz = pz / r;
    bx += bmag * (dy * uz - dz * uy);
    by += bmag * (dz * ux - dx * uz);
    bz += bmag * (dx * uy - dy * ux);
  }

  const out: Vec3 = { x: bx, y: by, z: bz };
  if (!isFiniteVec(out)) return ZERO;
  return out;
}
