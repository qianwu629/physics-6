/**
 * Phase 2: 物理量计算 — 能量公式 + 加速度 SMA 平滑
 *
 * physicsCalc.ts 提供从 Rapier rigidBody 读取的原始数据计算
 * 动能(KE)、重力势能(PE_gravity)、弹簧弹性势能(PE_spring)，
 * 以及通过速度差分的移动平均(SMA)平滑加速度。
 *
 * 所有公式与 RESEARCH.md 一致。
 */

import * as THREE from 'three';

/** 弹簧信息（用于弹性势能计算） */
export interface SpringInfo {
  stiffness: number;
  restLength: number;
  entityAId: string;
  entityBId: string;
}

/**
 * 计算实体能量
 *
 * KE = 0.5 * m * |v|²
 * PE_gravity = -m * gravityY * (y - peReferenceY)  (W-07 fix: 保留 g 符号)
 * PE_spring = Σ 0.5 * k * (|Δx| - L0)²
 *
 * @param rigidBody — Rapier rigidBody 或其 mock（必须提供 linvel/translation/mass）
 * @param mass — 实体质量 (kg)
 * @param gravityY — 重力加速度 y 分量 (m/s², 带符号)
 * @param peReferenceY — 势能参考零点 y 坐标 (m)
 * @param springs — 场景中所有弹簧约束列表
 * @param getEntityPosition — 根据实体 ID 获取位置的三维向量
 * @returns { ke, peGravity, peSprings, total } 各项能量 (J)
 */
export function computeEnergy(
  rigidBody: {
    linvel(): { x: number; y: number; z: number };
    translation(): { x: number; y: number; z: number };
    mass(): number;
  },
  mass: number,
  gravityY: number,
  peReferenceY: number,
  springs: SpringInfo[],
  getEntityPosition: (id: string) => THREE.Vector3 | null,
): { ke: number; peGravity: number; peSprings: number; total: number } {
  const vel = rigidBody.linvel();
  const pos = rigidBody.translation();

  // 动能: KE = 0.5 * m * (vx² + vy² + vz²)
  const v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
  const ke = 0.5 * mass * v2;

  // W-07 fix: 重力势能保留 g 符号。
  // PE = -m * g · h, 一维垂直重力时 PE = -m * gY * (y - peReferenceY)。
  //   gY = -9.81 (向下) → PE = +9.81 * m * h  (h>0 时 PE>0) ✓
  //   gY = +5    (向上) → PE = -5    * m * h  (h>0 时 PE<0) ✓
  // 之前用 Math.abs(gravityY) 在向上重力场景下违反能量守恒。
  const peGravity = -mass * gravityY * (pos.y - peReferenceY);

  // 弹簧弹性势能: PE_spring = Σ 0.5 * k * (currentLength - restLength)²
  let peSprings = 0;
  for (const spring of springs) {
    const pA = getEntityPosition(spring.entityAId);
    const pB = getEntityPosition(spring.entityBId);
    if (!pA || !pB) continue;
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dz = pB.z - pA.z;
    const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const delta = currentLength - spring.restLength;
    peSprings += 0.5 * spring.stiffness * delta * delta;
  }

  return { ke, peGravity, peSprings, total: ke + peGravity + peSprings };
}

/**
 * 加速度 SMA(5) 平滑器
 *
 * 存储最近 N 帧速度，通过差分计算加速度后取移动平均。
 * 解决数值微分噪声放大问题（Pitfall #4: 60Hz 下速度差分会放大噪声）。
 *
 * SMA 窗口 = 5（推荐值，RESEARCH.md Pitfall #4）
 */
export class AccelerationSmoother {
  private velHistory: Float64Array;
  private idx = 0;
  private filled = false;

  /**
   * @param windowSize — SMA 窗口大小，默认 5
   */
  constructor(private windowSize: number = 5) {
    // 每个速度分量存 3 个值（vx, vy, vz）
    this.velHistory = new Float64Array(windowSize * 3);
  }

  /**
   * 记录一帧速度
   * @param vx, vy, vz — 当前帧速度分量 (m/s)
   */
  push(vx: number, vy: number, vz: number): void {
    const i = this.idx * 3;
    this.velHistory[i] = vx;
    this.velHistory[i + 1] = vy;
    this.velHistory[i + 2] = vz;
    this.idx = (this.idx + 1) % this.windowSize;
    if (this.idx === 0) this.filled = true;
  }

  /**
   * 计算 SMA 平滑后的加速度
   *
   * 算法：遍历窗口内相邻速度对的差分，取平均值
   * a = avg( (v_i - v_{i-1}) / dt ) for i = head-1 .. head-(N-1)
   *
   * @param dt — 帧间隔时间 (s)
   * @returns [ax, ay, az] 平滑后的加速度分量 (m/s²)
   */
  getSmoothedAcceleration(dt: number): [number, number, number] {
    const n = this.filled ? this.windowSize : this.idx;
    if (n < 2) return [0, 0, 0];

    let sumAx = 0;
    let sumAy = 0;
    let sumAz = 0;
    const count = n - 1;

    for (let i = 0; i < count; i++) {
      const currIdx = ((this.idx - 1 - i + this.windowSize) % this.windowSize) * 3;
      const prevIdx = ((this.idx - 2 - i + this.windowSize) % this.windowSize) * 3;

      sumAx += (this.velHistory[currIdx] - this.velHistory[prevIdx]) / dt;
      sumAy += (this.velHistory[currIdx + 1] - this.velHistory[prevIdx + 1]) / dt;
      sumAz += (this.velHistory[currIdx + 2] - this.velHistory[prevIdx + 2]) / dt;
    }

    return [sumAx / count, sumAy / count, sumAz / count];
  }

  /** 重置平滑器状态 */
  reset(): void {
    this.idx = 0;
    this.filled = false;
  }
}
