/**
 * Phase 2: 图表数据环形缓冲区 (Plan 02-01)
 *
 * Float64Array 环形缓冲，每实体存储 12 个物理量指标。
 * 数据不经过 Zustand（避免高频 re-render storm — PITFALLS #6）。
 */

import { TrajectoryBuffer } from '../ecs/TrajectoryBuffer';

// Re-export TrajectoryBuffer Max Points as rationale for chart max.
// Chart uses 500K points ≈ 10 min @ 60 Hz.
const MAX_POINTS = 500_000;

/** 每实体每帧 12 个指标：x,y,z, vx,vy,vz, ax,ay,az, KE,PE,E */
export const METRICS_PER_ENTITY = 12;

export class ChartDataBuffer {
  private data: Float64Array;
  private timestamps: Float64Array;
  private head = 0;
  private count = 0;

  constructor() {
    this.data = new Float64Array(MAX_POINTS * METRICS_PER_ENTITY);
    this.timestamps = new Float64Array(MAX_POINTS);
  }

  push(time: number, metrics: Float64Array): void {
    const idx = this.head * METRICS_PER_ENTITY;
    this.data.set(metrics, idx);
    this.timestamps[this.head] = time;
    this.head = (this.head + 1) % MAX_POINTS;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  getSeriesData(
    metricIndex: number,
    startTime: number,
    endTime: number,
  ): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    const start = this.count < MAX_POINTS ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const bufIdx = (start + i) % MAX_POINTS;
      const t = this.timestamps[bufIdx];
      if (t >= startTime && t <= endTime) {
        result.push({
          time: t,
          value: this.data[bufIdx * METRICS_PER_ENTITY + metricIndex],
        });
      }
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  getCount(): number {
    return this.count;
  }
}

/** 模块级全局 buffer 注册表，key = entityId */
export const chartBuffers = new Map<string, ChartDataBuffer>();

export function getOrCreateBuffer(entityId: string): ChartDataBuffer {
  let buf = chartBuffers.get(entityId);
  if (!buf) {
    buf = new ChartDataBuffer();
    chartBuffers.set(entityId, buf);
  }
  return buf;
}

export function clearAllBuffers(): void {
  for (const buf of chartBuffers.values()) {
    buf.clear();
  }
}
