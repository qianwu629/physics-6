/**
 * ChartDataBuffer — Float64Array 环形缓冲区
 *
 * 每实体一个实例，存储 12 个物理量指标：
 *   0:x, 1:y, 2:z, 3:vx, 4:vy, 5:vz, 6:ax, 7:ay, 8:az, 9:KE, 10:PE, 11:TotalE
 *
 * D-02-05: MAX_POINTS = 500_000（约 10 分钟 @ 60Hz）
 * D-02-06: 不经过 Zustand，模块级独立存储
 */

export const MAX_POINTS = 500_000;
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

  /** 写入一组指标（length 必须为 METRICS_PER_ENTITY） */
  push(time: number, metrics: Float64Array): void {
    if (metrics.length !== METRICS_PER_ENTITY) {
      throw new Error(`metrics length must be ${METRICS_PER_ENTITY}, got ${metrics.length}`);
    }
    const idx = this.head * METRICS_PER_ENTITY;
    this.data.set(metrics, idx);
    this.timestamps[this.head] = time;
    this.head = (this.head + 1) % MAX_POINTS;
    this.count = Math.min(this.count + 1, MAX_POINTS);
  }

  /**
   * 获取指定指标、指定时间范围的数据点
   * 返回 {time, value}[] 供 lightweight-charts 消费
   * 不修改底层缓冲（V-CHART-06）
   *
   * W-08 fix: 时间戳数组按 ring 起点单调非降, 利用此性质 early-exit:
   * - 若 t > endTime, break (后续点必然都 > endTime)
   * - 若 t < startTime, 跳过 (尚未进入区间, continue)
   * 大幅降低 O(N) 扫描成本 (满 ring buffer 60fps × 4 entity × 3 axis 场景)。
   */
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
      if (t > endTime) break; // W-08: monotonic, 后续点都越界
      if (t < startTime) continue; // W-08: 尚未进入窗口
      result.push({
        time: t,
        value: this.data[bufIdx * METRICS_PER_ENTITY + metricIndex],
      });
    }
    return result;
  }

  /** 获取全部时间范围内的指定指标数据（用于"全程"视图） */
  getAllSeriesData(metricIndex: number): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = [];
    const start = this.count < MAX_POINTS ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const bufIdx = (start + i) % MAX_POINTS;
      result.push({
        time: this.timestamps[bufIdx],
        value: this.data[bufIdx * METRICS_PER_ENTITY + metricIndex],
      });
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

/** 模块级全局缓冲区映射 — key = entityId */
export const chartBuffers = new Map<string, ChartDataBuffer>();

/** 获取或创建实体的缓冲区 */
export function getOrCreateBuffer(entityId: string): ChartDataBuffer {
  let buf = chartBuffers.get(entityId);
  if (!buf) {
    buf = new ChartDataBuffer();
    chartBuffers.set(entityId, buf);
  }
  return buf;
}

/** 清空所有缓冲区（重置时调用） */
export function clearAllBuffers(): void {
  for (const buf of chartBuffers.values()) {
    buf.clear();
  }
  chartBuffers.clear();
}

/**
 * C-05 fix: 释放指定实体的缓冲区, 让 ~52 MB Float64Array 可被 GC。
 * 用于 entitySlice.removeEntity / resetEntities / SceneLoader 加载场景前。
 */
export function disposeBuffer(entityId: string): void {
  chartBuffers.delete(entityId);
}
