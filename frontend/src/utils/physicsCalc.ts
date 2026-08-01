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
 * 加速度平滑器（最小二乘拟合）
 *
 * 旧实现：固定 dt=1/60 的相邻样本差分——采样时刻抖动（rAF ±数 ms）直接
 * 转成加速度抖动，且 5 样本（≈83ms）窗口过短，放大 120Hz 物理接触噪声。
 *
 * 新实现：存 (时刻, 速度) 样本，窗口内对每个分量做最小二乘直线拟合，
 * 斜率即加速度。真实时间戳消除 dt 失配；~0.25s 窗口压平接触噪声混叠。
 */
export class AccelerationSmoother {
  private samples: { t: number; v: [number, number, number] }[] = [];

  /**
   * @param windowSize — 窗口样本容量，默认 16（60Hz 采样下 ≈0.27s）
   */
  constructor(private windowSize: number = 16) {}

  /**
   * 记录一帧速度
   * @param t — 采样时刻（秒，与 ChartSampler 同一时钟 nowSeconds()）
   * @param vx, vy, vz — 当前帧速度分量 (m/s)
   */
  push(t: number, vx: number, vy: number, vz: number): void {
    this.samples.push({ t, v: [vx, vy, vz] });
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  /**
   * 最小二乘直线拟合求斜率：slope = Σ(t−t̄)(v−v̄) / Σ(t−t̄)²
   * @returns [ax, ay, az] 平滑后的加速度分量 (m/s²)；样本不足返回 [0,0,0]
   */
  getSmoothedAcceleration(): [number, number, number] {
    const n = this.samples.length;
    if (n < 2) return [0, 0, 0];

    let meanT = 0;
    const meanV = [0, 0, 0];
    for (const s of this.samples) {
      meanT += s.t;
      meanV[0] += s.v[0];
      meanV[1] += s.v[1];
      meanV[2] += s.v[2];
    }
    meanT /= n;
    meanV[0] /= n;
    meanV[1] /= n;
    meanV[2] /= n;

    let denom = 0;
    const numer = [0, 0, 0];
    for (const s of this.samples) {
      const dt = s.t - meanT;
      denom += dt * dt;
      numer[0] += dt * (s.v[0] - meanV[0]);
      numer[1] += dt * (s.v[1] - meanV[1]);
      numer[2] += dt * (s.v[2] - meanV[2]);
    }
    if (denom < 1e-12) return [0, 0, 0]; // 所有样本同一时刻（理论防御）

    return [numer[0] / denom, numer[1] / denom, numer[2] / denom];
  }

  /** 重置平滑器状态 */
  reset(): void {
    this.samples = [];
  }
}
