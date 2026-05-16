import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { useChartDataStore, type MetricType } from '../store/chartDataStore';
import { chartBuffers } from '../store/chartBuffer';

// ── 配色方案 — D-02-03 指标优先 ──
const METRIC_COLORS: Record<MetricType, string[]> = {
  position: ['#3b82f6', '#60a5fa', '#93c5fd'],   // 蓝系
  velocity: ['#22c55e', '#4ade80', '#86efac'],   // 绿系
  acceleration: ['#f97316', '#fb923c', '#fdba74'], // 橙系
  energy: ['#a855f7', '#c084fc', '#d8b4fe'],     // 紫系
};

const METRIC_NAMES: Record<MetricType, string[]> = {
  position: ['x', 'y', 'z'],
  velocity: ['vx', 'vy', 'vz'],
  acceleration: ['ax', 'ay', 'az'],
  energy: ['KE', 'PE', 'E'],
};

const METRIC_INDICES: Record<MetricType, number[]> = {
  position: [0, 1, 2],
  velocity: [3, 4, 5],
  acceleration: [6, 7, 8],
  energy: [9, 10, 11],
};

/** 生成 series key: entityId + metric + axis */
function makeSeriesKey(entityId: string, metric: MetricType, axisIndex: number): string {
  return `${entityId}::${metric}::${axisIndex}`;
}

export interface ChartCanvasHandle {
  /** 刷新所有 series 数据（从 buffer 读取最新数据并 update） */
  refreshAll: () => void;
  /** 切换时间窗口 */
  setTimeWindow: (window: '5s' | '30s' | 'all') => void;
}

interface ChartCanvasProps {
  metric: MetricType;
}

export const ChartCanvas = forwardRef<ChartCanvasHandle, ChartCanvasProps>(
  function ChartCanvas({ metric }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
    // C-07 fix: 每条 series 的水位线 (last-updated time),
    // 用于在 refreshAll 中按增量 update 而非只更新尾点。
    const lastUpdatedTimesRef = useRef<Map<string, number>>(new Map());

    const trackedEntityIds = useChartDataStore((s) => s.trackedEntityIds);
    const timeWindow = useChartDataStore((s) => s.timeWindow);

    // 初始化 chart
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: 'solid', color: '#1a1a2e' },
          textColor: '#d1d4dc',
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          borderColor: '#2B2B43',
        },
        rightPriceScale: {
          borderColor: '#2B2B43',
        },
        crosshair: {
          mode: 1,
          vertLine: { width: 1, color: '#758696', style: 3 },
          horzLine: { width: 1, color: '#758696', style: 3 },
        },
        grid: {
          vertLines: { color: '#2B2B43', style: 1 },
          horzLines: { color: '#2B2B43', style: 1 },
        },
      });
      chartRef.current = chart;

      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      });
      ro.observe(container);

      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesMapRef.current.clear();
        lastUpdatedTimesRef.current.clear();
      };
    }, []);

    // 根据 trackedEntityIds 动态增删 series
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const currentKeys = new Set<string>();
      const colors = METRIC_COLORS[metric];
      const names = METRIC_NAMES[metric];
      const indices = METRIC_INDICES[metric];

      trackedEntityIds.forEach((entityId, entityIdx) => {
        indices.forEach((metricIndex, axisIdx) => {
          const key = makeSeriesKey(entityId, metric, axisIdx);
          currentKeys.add(key);

          if (!seriesMapRef.current.has(key)) {
            const color = colors[entityIdx % colors.length];
            const series = chart.addSeries(LineSeries, {
              color,
              lineWidth: 2,
              title: `${entityId} ${names[axisIdx]}`,
            });
            seriesMapRef.current.set(key, series);

            // 首次加载：用 setData 填充历史数据
            const buf = chartBuffers.get(entityId);
            if (buf) {
              const data = buf.getAllSeriesData(metricIndex);
              if (data.length > 0) {
                series.setData(data as LineData<Time>[]);
                // C-07 fix: 初始化水位线为最后一点 time, 防止 refreshAll
                // 重复 update setData 中已有的点。
                lastUpdatedTimesRef.current.set(key, data[data.length - 1].time);
              }
            }
          }
        });
      });

      // 移除不再追踪的 series
      for (const [key, series] of seriesMapRef.current) {
        if (!currentKeys.has(key)) {
          chart.removeSeries(series);
          seriesMapRef.current.delete(key);
          // C-07 fix: 同步清理水位线
          lastUpdatedTimesRef.current.delete(key);
        }
      }
    }, [trackedEntityIds, metric]);

    // 时间窗口变化 → 调整 visible range
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const now = Date.now() / 1000;
      try {
        if (timeWindow === '5s') {
          chart.timeScale().setVisibleRange({ from: now - 5, to: now });
        } else if (timeWindow === '30s') {
          chart.timeScale().setVisibleRange({ from: now - 30, to: now });
        } else {
          chart.timeScale().fitContent();
        }
      } catch {
        // chart has no data yet — visible range will be set when data arrives
      }
    }, [timeWindow]);

    // 暴露 imperative API
    useImperativeHandle(ref, () => ({
      refreshAll: () => {
        const chart = chartRef.current;
        if (!chart) return;
        const now = Date.now() / 1000;
        const indices = METRIC_INDICES[metric];

        for (const entityId of trackedEntityIds) {
          const buf = chartBuffers.get(entityId);
          if (!buf) continue;

          indices.forEach((metricIndex, axisIdx) => {
            const key = makeSeriesKey(entityId, metric, axisIdx);
            const series = seriesMapRef.current.get(key);
            if (!series) return;

            // C-07 fix: 水位线增量更新。
            // 之前只 update(lastPoint), 当 rAF 跳帧或 5s 窗口外重新进入
            // 时会有间隙;同时未 try/catch 包裹 series.update,
            // lightweight-charts 在 time <= lastDataPoint.time 时会抛错。
            const watermark = lastUpdatedTimesRef.current.get(key) ?? 0;
            // 起点取 max(watermark, 时间窗口左界): 窗口外的旧点不必下发
            let startTime: number;
            if (timeWindow === '5s') {
              startTime = Math.max(watermark, now - 5);
            } else if (timeWindow === '30s') {
              startTime = Math.max(watermark, now - 30);
            } else {
              startTime = watermark; // 全程模式: 只下发增量
            }

            // 用稍大于 watermark 的开区间下界 (避免重复 update 同一 time)
            // getSeriesData 是闭区间 [start, end], 所以 start = watermark + ε
            // 不过 ε 难取, 改为 watermark > 0 时 start = watermark + 1e-9 (1 ns 安全余量)
            const queryStart = watermark > 0 && startTime === watermark
              ? watermark + 1e-9
              : startTime;
            const data = buf.getSeriesData(metricIndex, queryStart, now);

            if (data.length === 0) return;

            // 逐点 update; 每个调用包 try/catch 以防 time <= last point.time
            // 抛错 (lightweight-charts 在乱序时抛 "Cannot update oldest data")。
            let newWatermark = watermark;
            for (const p of data) {
              try {
                series.update(p as LineData<Time>);
                if (p.time > newWatermark) newWatermark = p.time;
              } catch {
                // 跳过无法 update 的点 (通常是与上一点 time 相同/更老的并发样本)
              }
            }
            lastUpdatedTimesRef.current.set(key, newWatermark);
          });
        }
      },
      setTimeWindow: (window) => {
        const chart = chartRef.current;
        if (!chart) return;
        const now = Date.now() / 1000;
        try {
          if (window === '5s') {
            chart.timeScale().setVisibleRange({ from: now - 5, to: now });
          } else if (window === '30s') {
            chart.timeScale().setVisibleRange({ from: now - 30, to: now });
          } else {
            chart.timeScale().fitContent();
          }
        } catch {
          // chart has no data yet
        }
      },
    }), [trackedEntityIds, metric, timeWindow]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 0 }}
      />
    );
  }
);
