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

            // 根据时间窗口决定读取范围
            let data: { time: number; value: number }[];
            if (timeWindow === '5s') {
              data = buf.getSeriesData(metricIndex, now - 5, now);
            } else if (timeWindow === '30s') {
              data = buf.getSeriesData(metricIndex, now - 30, now);
            } else {
              data = buf.getAllSeriesData(metricIndex);
            }

            // 增量更新：只 update 最新的数据点
            if (data.length > 0) {
              const lastPoint = data[data.length - 1];
              series.update(lastPoint as LineData<Time>);
            }
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
