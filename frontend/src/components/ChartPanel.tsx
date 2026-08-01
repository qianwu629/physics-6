import { useState, useRef, useCallback, useEffect } from 'react';
import { LayoutTemplate, LayoutGrid } from 'lucide-react';
import { useChartDataStore, type MetricType } from '../store/chartDataStore';
import { ChartCanvas, type ChartCanvasHandle } from './ChartCanvas';
import { ChartMetricTabs } from './ChartMetricTabs';

interface ChartPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ChartPanel — 实时物理量图表（dock 面板版）
 *
 * Ticket 1: 迁入 dock 停靠壳。拖拽/缩放/关闭由 dock tab 接管，
 * 移除 react-draggable + re-resizable 包装与固定定位。
 * `open` 语义 = 面板已挂载（dock 内恒 true）。
 */
export function ChartPanel({ open }: ChartPanelProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('position');
  const chartCanvasRef = useRef<ChartCanvasHandle>(null);

  const timeWindow = useChartDataStore((s) => s.timeWindow);
  const setTimeWindow = useChartDataStore((s) => s.setTimeWindow);
  const layoutMode = useChartDataStore((s) => s.layoutMode);
  const setLayoutMode = useChartDataStore((s) => s.setLayoutMode);
  const trackedEntityIds = useChartDataStore((s) => s.trackedEntityIds);

  // rAF loop: drives chart visual refresh at display refresh rate
  // Sampling is handled by ChartSampler.useFrame sharing R3F's rAF
  // This rAF only calls lightweight-charts update() for viewport rendering
  useEffect(() => {
    if (!open) return;
    let rafId: number;
    const tick = () => {
      chartCanvasRef.current?.refreshAll();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open, activeMetric]);

  const handleTimeWindowChange = useCallback(
    (window: '5s' | '30s' | 'all') => {
      setTimeWindow(window);
      chartCanvasRef.current?.setTimeWindow(window);
    },
    [setTimeWindow]
  );

  if (!open) return null;

  const entityArray = Array.from(trackedEntityIds);

  return (
    <div className="panel-container h-full w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="panel-header flex items-center justify-between px-3 shrink-0"
        style={{ height: '40px', borderBottom: '1px solid var(--glass-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            实时物理量图表
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            ({trackedEntityIds.size}/4 实体)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Layout mode toggle */}
          <button
            type="button"
            onClick={() => setLayoutMode(layoutMode === 'overlay' ? 'separate' : 'overlay')}
            className="rounded p-1 hover:bg-white/5 transition-colors"
            title={layoutMode === 'overlay' ? '切换为分离模式' : '切换为叠加模式'}
          >
            {layoutMode === 'overlay' ? (
              <LayoutTemplate size={14} style={{ color: 'var(--muted-foreground)' }} />
            ) : (
              <LayoutGrid size={14} style={{ color: 'var(--muted-foreground)' }} />
            )}
          </button>

          {/* Time window buttons */}
          {(['5s', '30s', 'all'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => handleTimeWindowChange(w)}
              className={`px-2 py-0.5 rounded text-xs transition-all
                ${timeWindow === w
                  ? 'bg-[var(--holo-a20)] border border-[var(--holo)] text-[var(--foreground)]'
                  : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[var(--muted-foreground)] hover:bg-[var(--holo-a10)]'}
              `}
            >
              {w === 'all' ? '全程' : w}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Tabs */}
      <ChartMetricTabs activeMetric={activeMetric} onChange={setActiveMetric} />

      {/* Chart Body */}
      <div className="panel-body flex-1 min-h-0 px-3 pb-3 relative">
        {layoutMode === 'overlay' ? (
          <ChartCanvas ref={chartCanvasRef} metric={activeMetric} />
        ) : (
          <div className="flex flex-col gap-2 h-full overflow-y-auto">
            {entityArray.map((entityId) => (
              <div key={entityId} className="flex-1 min-h-[120px] flex flex-col">
                <span className="text-xs text-[var(--muted-foreground)] mb-1">{entityId}</span>
                <div className="flex-1 min-h-0">
                  <ChartCanvas ref={chartCanvasRef} metric={activeMetric} />
                </div>
              </div>
            ))}
            {entityArray.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-dim)' }}>
                未追踪任何实体 — 在属性面板中开启图表追踪
              </div>
            )}
          </div>
        )}
        {layoutMode === 'overlay' && entityArray.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: 'var(--text-dim)' }}>
            未追踪任何实体 — 在属性面板中开启图表追踪
          </div>
        )}
      </div>
    </div>
  );
}
