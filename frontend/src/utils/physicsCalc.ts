import * as THREE from 'three';

export interface SpringInfo {
  stiffness: number;
  restLength: number;
  entityAId: string;
  entityBId: string;
}

/**
 * 计算实体能量
 * KE = 0.5 * m * |v|^2
 * PE_gravity = m * |g| * (y - peReferenceY)
 * PE_spring = sum 0.5 * k * (|dx| - L0)^2
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

  const v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
  const ke = 0.5 * mass * v2;

  const peGravity = mass * Math.abs(gravityY) * (pos.y - peReferenceY);

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
 * 加速度 SMA(windowSize) 平滑器
 * 存储最近 windowSize 帧速度，计算平均加速度
 */
export class AccelerationSmoother {
  private velHistory: Float64Array;
  private idx = 0;
  private filled = false;

  constructor(private windowSize: number = 5) {
    this.velHistory = new Float64Array(windowSize * 3);
  }

  push(vx: number, vy: number, vz: number): void {
    const i = this.idx * 3;
    this.velHistory[i] = vx;
    this.velHistory[i + 1] = vy;
    this.velHistory[i + 2] = vz;
    this.idx = (this.idx + 1) % this.windowSize;
    if (this.idx === 0) this.filled = true;
  }

  getSmoothedAcceleration(dt: number): [number, number, number] {
    const n = this.filled ? this.windowSize : this.idx;
    if (n < 2) return [0, 0, 0];

    let sumAx = 0, sumAy = 0, sumAz = 0;
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

  reset(): void {
    this.idx = 0;
    this.filled = false;
  }
}
