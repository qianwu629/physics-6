import { useState, useRef, useCallback, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 're-resizable';
import { X, LayoutTemplate, LayoutGrid } from 'lucide-react';
import { useChartDataStore, type MetricType } from '../store/chartDataStore';
import { ChartCanvas, type ChartCanvasHandle } from './ChartCanvas';
import { ChartMetricTabs } from './ChartMetricTabs';

interface ChartPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChartPanel({ open, onClose }: ChartPanelProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('position');
  const chartCanvasRef = useRef<ChartCanvasHandle>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
    <Draggable
      nodeRef={panelRef}
      handle=".panel-header"
      bounds="parent"
      cancel=".react-resizable-handle, button, .panel-body"
    >
      <Resizable
        ref={panelRef}
        defaultSize={{ width: 640, height: 420 }}
        minWidth={320}
        minHeight={200}
        maxWidth={1200}
        maxHeight={800}
        enable={{
          top: false,
          right: true,
          bottom: true,
          left: false,
          topRight: false,
          bottomRight: true,
          bottomLeft: false,
          topLeft: false,
        }}
        onResizeStop={() => {
          chartCanvasRef.current?.refreshAll();
        }}
      >
        <div
          className="panel-container fixed z-40 rounded-xl flex flex-col overflow-hidden"
          style={{
            right: '16px',
            top: '80px',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(26, 26, 26, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Header */}
          <div
            className="panel-header flex items-center justify-between px-3 shrink-0 cursor-move"
            style={{ height: '40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: '#e0e0e0' }}>
                实时物理量图表
              </span>
              <span className="text-xs" style={{ color: '#666' }}>
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
                  <LayoutTemplate size={14} style={{ color: '#a0a0a0' }} />
                ) : (
                  <LayoutGrid size={14} style={{ color: '#a0a0a0' }} />
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
                      ? 'bg-[rgba(59,130,246,0.2)] border border-[#3b82f6] text-[#e0e0e0]'
                      : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[#888] hover:bg-[rgba(59,130,246,0.1)]'}
                  `}
                >
                  {w === 'all' ? '全程' : w}
                </button>
              ))}

              {/* Close button */}
              <button
                type="button"
                className="rounded hover:bg-white/5 transition-colors p-1 ml-1"
                onClick={onClose}
                aria-label="关闭图表面板"
              >
                <X size={14} style={{ color: '#a0a0a0' }} />
              </button>
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
                    <span className="text-xs text-[#888] mb-1">{entityId}</span>
                    <div className="flex-1 min-h-0">
                      <ChartCanvas ref={chartCanvasRef} metric={activeMetric} />
                    </div>
                  </div>
                ))}
                {entityArray.length === 0 && (
                  <div className="flex items-center justify-center h-full text-sm" style={{ color: '#666' }}>
                    未追踪任何实体 — 在属性面板中开启图表追踪
                  </div>
                )}
              </div>
            )}
            {layoutMode === 'overlay' && entityArray.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: '#666' }}>
                未追踪任何实体 — 在属性面板中开启图表追踪
              </div>
            )}
          </div>
        </div>
      </Resizable>
    </Draggable>
  );
}
