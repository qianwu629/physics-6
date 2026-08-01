import { Play, Pause, RotateCcw, Bug, Globe, Gauge, Boxes, GitBranch } from 'lucide-react';
import { useSimulationStore } from '../store';
import { useVisualizationStore, type VectorDisplayMode } from '../store/visualizationStore';
import { useDock } from './dock/DockApiContext';
import { cn } from '../lib/utils';

interface ToolbarProps {
  chartPanelOpen?: boolean;
  onToggleChartPanel?: () => void;
}

/**
 * Toolbar — 顶部浮动控制栏
 *
 * D-07: 播放/暂停/重置 + 物理调试开关 + FPS/物体计数
 * D-08: 键盘快捷键提示通过 title 属性（原生 tooltip）
 *
 * UI-SPEC 合同:
 * - 半透明背景: var(--glass-bg)
 * - 毛玻璃效果: backdrop-filter: blur(8px)
 * - 按钮间距: 8px (sm token)
 * - 工具栏内边距: 16px (md token)
 * - 状态指示器间距: 24px (lg token)
 */
export default function Toolbar({ chartPanelOpen, onToggleChartPanel }: ToolbarProps = {}) {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const showDebug = useSimulationStore((s) => s.showDebug);
  const fps = useSimulationStore((s) => s.fps);
  const objectCount = useSimulationStore((s) => s.objectCount);
  const toggle = useSimulationStore((s) => s.toggle);
  const reset = useSimulationStore((s) => s.reset);
  const setShowDebug = useSimulationStore((s) => s.setShowDebug);
  const toggleEnvironmentPanel = useSimulationStore((s) => s.toggleEnvironmentPanel);
  // dock 布局下面板开关走 dock api；uiSlice 字段回退为遗留路径（与 MenuBar 同一模式）
  const dock = useDock();

  const {
    showTrails, showVelocityVectors, showForceVectors, showForceLines, vectorDisplayMode,
    toggleTrails, toggleVelocityVectors, toggleForceVectors, toggleForceLines, setVectorDisplayMode,
  } = useVisualizationStore();

  const isPlaying = isRunning;

  return (
    <div
      data-toolbar=""
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2',
        'px-4 py-2',
        'rounded-lg',
        'transition-all duration-200',
        'select-none',
      )}
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), var(--glow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg)';
      }}
    >
      {/* 播放/暂停按钮 — D-07, UI-SPEC 按钮合同 */}
      <button
        type="button"
        aria-label={isPlaying ? '暂停仿真' : '播放仿真'}
        title={isPlaying ? '暂停仿真 (Space)' : '播放仿真 (Space)'}
        onClick={toggle}
        className={cn(
          'flex items-center gap-1.5',
          'px-3 py-1.5',
          'rounded-md',
          'text-sm font-medium',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--holo)]',
        )}
        style={{
          backgroundColor: isPlaying ? 'var(--holo)' : 'transparent',
          color: isPlaying ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
          boxShadow: isPlaying ? 'var(--glow-md)' : 'none',
        }}
        onMouseEnter={(e) => { if (!isPlaying) e.currentTarget.style.color = 'var(--foreground)'; }}
        onMouseLeave={(e) => { if (!isPlaying) e.currentTarget.style.color = 'var(--muted-foreground)'; }}
      >
        {isPlaying ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
        <span>{isPlaying ? '⏸ 暂停' : '▶ 播放'}</span>
      </button>

      <div style={{ width: 1, height: 20, backgroundColor: 'var(--glass-border)' }} />

      {/* 重置按钮 — D-07, destructive hover */}
      <button
        type="button"
        aria-label="重置仿真"
        title="重置仿真 (R)"
        onClick={reset}
        className={cn(
          'flex items-center gap-1.5',
          'px-3 py-1.5',
          'rounded-md',
          'text-sm font-medium',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--holo)]',
        )}
        style={{ color: 'var(--muted-foreground)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--destructive)'; e.currentTarget.style.color = 'var(--primary-foreground)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
      >
        <RotateCcw size={16} strokeWidth={2} />
        <span>↺ 重置</span>
      </button>

      <div style={{ width: 1, height: 20, backgroundColor: 'var(--glass-border)' }} />

      {/* 调试开关 — D-07 */}
      <button
        type="button"
        aria-label={showDebug ? '关闭物理调试' : '开启物理调试'}
        title={showDebug ? '关闭碰撞体线框' : '显示碰撞体线框'}
        onClick={() => setShowDebug(!showDebug)}
        className={cn(
          'flex items-center gap-1.5',
          'px-3 py-1.5',
          'rounded-md',
          'text-sm font-medium',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--holo)]',
        )}
        style={{
          backgroundColor: showDebug ? 'var(--holo)' : 'transparent',
          color: showDebug ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
        }}
        onMouseEnter={(e) => { if (!showDebug) e.currentTarget.style.color = 'var(--foreground)'; }}
        onMouseLeave={(e) => { if (!showDebug) e.currentTarget.style.color = 'var(--muted-foreground)'; }}
      >
        <Bug size={16} strokeWidth={2} />
      </button>

      <div style={{ width: 1, height: 20, backgroundColor: 'var(--glass-border)' }} />

      {/* 环境按钮 — Phase 3 D-01 */}
      <button
        type="button"
        aria-label="环境参数"
        title="环境参数"
        onClick={() => (dock ? dock.togglePanel('environment') : toggleEnvironmentPanel())}
        className={cn(
          'flex items-center gap-1.5',
          'px-3 py-1.5',
          'rounded-md',
          'text-sm font-medium',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--holo)]',
        )}
        style={{ color: 'var(--muted-foreground)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
      >
        <Globe size={16} strokeWidth={2} />
        <span>环境</span>
      </button>

      <div style={{ width: 1, height: 20, backgroundColor: 'var(--glass-border)' }} />

      {/* 可视化控制按钮 — Phase 4 */}
      <div className="flex items-center gap-1 pl-1 border-l border-white/10">
        <button
          type="button"
          onClick={toggleTrails}
          className={cn(
            'px-2 py-1 text-xs rounded',
            showTrails ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
          )}
          title={showTrails ? '隐藏轨迹' : '显示轨迹'}
        >
          轨迹
        </button>
        <button
          type="button"
          onClick={toggleVelocityVectors}
          className={cn(
            'px-2 py-1 text-xs rounded',
            showVelocityVectors ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
          )}
          title={showVelocityVectors ? '隐藏速度矢量' : '显示速度矢量'}
        >
          速度
        </button>
        <button
          type="button"
          onClick={toggleForceVectors}
          className={cn(
            'px-2 py-1 text-xs rounded',
            showForceVectors ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
          )}
          title={showForceVectors ? '隐藏受力矢量' : '显示受力矢量'}
        >
          受力
        </button>
        <button
          type="button"
          onClick={toggleForceLines}
          className={cn(
            'px-2 py-1 text-xs rounded',
            showForceLines ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
          )}
          title={showForceLines ? '隐藏力线' : '显示力线'}
        >
          力线
        </button>
        <button
          type="button"
          onClick={() =>
            setVectorDisplayMode(
              vectorDisplayMode === 'all' ? 'selected' : 'all'
            )
          }
          className="px-2 py-1 text-xs rounded text-white/50 hover:text-white/80"
          title={vectorDisplayMode === 'all' ? '仅显示选中实体' : '显示全部实体'}
        >
          {vectorDisplayMode === 'all' ? '全部' : '选中'}
        </button>
      </div>

      <div style={{ width: 1, height: 20, backgroundColor: 'var(--glass-border)' }} />

      {/* Phase 2: 图表按钮 */}
      <div className="flex items-center gap-1 pl-1 border-l border-white/10">
        <button
          type="button"
          onClick={onToggleChartPanel}
          className={cn(
            'px-2 py-1 text-xs rounded',
            chartPanelOpen ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
          )}
          title={chartPanelOpen ? '隐藏图表' : '显示图表'}
        >
          图表
        </button>
      </div>

      <div style={{ width: 1, height: 20, backgroundColor: 'var(--glass-border)' }} />

      {/* 状态指示器 — FPS + 物体计数 */}
      <div
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
        title="实时帧率"
      >
        <Gauge size={14} strokeWidth={2} />
        <span>{fps} FPS</span>
      </div>

      <div
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
        title="场景物体数量"
      >
        <Boxes size={14} strokeWidth={2} />
        <span>物体: {objectCount}</span>
      </div>
    </div>
  );
}
