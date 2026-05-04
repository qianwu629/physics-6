import { Vector3 } from 'three';

const MAX_POINTS = 600;
const MAX_AGE_SECONDS = 10;
const STRIDE = 3;

export class TrajectoryBuffer {
  private positions: Float32Array;
  private timestamps: Float32Array;
  private head = 0;
  private count = 0;

  constructor() {
    this.positions = new Float32Array(MAX_POINTS * STRIDE);
    this.timestamps = new Float32Array(MAX_POINTS);
  }

  push(position: Vector3, time: number): void {
    const idx = this.head * STRIDE;
    this.positions[idx] = position.x;
    this.positions[idx + 1] = position.y;
    this.positions[idx + 2] = position.z;
    this.timestamps[this.head] = time;
    this.head = (this.head + 1) % MAX_POINTS;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  // 返回按时间顺序排列的点（旧→新），裁掉超过5秒的旧数据
  getPoints(currentTime: number): { positions: Vector3[]; count: number } {
    const result: Vector3[] = [];
    const cutoff = currentTime - MAX_AGE_SECONDS;

    const start = this.count < MAX_POINTS ? 0 : this.head;
    let validCount = 0;
    for (let i = 0; i < this.count; i++) {
      const bufIdx = (start + i) % MAX_POINTS;
      if (this.timestamps[bufIdx] >= cutoff) {
        const pIdx = bufIdx * STRIDE;
        result.push(
          new Vector3(this.positions[pIdx], this.positions[pIdx + 1], this.positions[pIdx + 2])
        );
        validCount++;
      }
    }

    return { positions: result, count: validCount };
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  getCount(): number {
    return this.count;
  }
}
