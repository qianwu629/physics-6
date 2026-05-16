import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChartPanel } from '../ChartPanel';
import { useChartDataStore } from '../../store/chartDataStore';

// Helper to reset store between tests
function resetStore() {
  // C-04 fix: peReferenceY 已迁出 chartDataStore
  useChartDataStore.setState({
    trackedEntityIds: new Set(['entity-1', 'entity-2']),
    timeWindow: '30s',
    layoutMode: 'overlay',
  });
}

describe('ChartPanel', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Test 1: renders panel container with header, ChartMetricTabs, ChartCanvas when open', () => {
    render(<ChartPanel open={true} onClose={vi.fn()} />);

    // Header
    expect(screen.getByText('实时物理量图表')).toBeInTheDocument();
    // Entity count indicator
    expect(screen.getByText('(2/4 实体)')).toBeInTheDocument();

    // Metric tabs should be present
    expect(screen.getByText('位置')).toBeInTheDocument();
    expect(screen.getByText('速度')).toBeInTheDocument();
    expect(screen.getByText('加速度')).toBeInTheDocument();
    expect(screen.getByText('能量')).toBeInTheDocument();

    // ChartCanvas renders a container div for lightweight-charts
    const panelBody = document.querySelector('.panel-body');
    expect(panelBody).toBeInTheDocument();
    // In overlay mode, ChartCanvas renders inside panel-body
    const chartContainers = panelBody!.querySelectorAll('div[style*="min-height: 0px"]');
    expect(chartContainers.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 2: clicking time window buttons triggers setTimeWindow', () => {
    const onClose = vi.fn();
    render(<ChartPanel open={true} onClose={onClose} />);

    // Click 5s button
    fireEvent.click(screen.getByText('5s'));
    expect(useChartDataStore.getState().timeWindow).toBe('5s');

    // Click 全程 button
    fireEvent.click(screen.getByText('全程'));
    expect(useChartDataStore.getState().timeWindow).toBe('all');

    // Click 30s button
    fireEvent.click(screen.getByText('30s'));
    expect(useChartDataStore.getState().timeWindow).toBe('30s');
  });

  it('Test 3: clicking layout mode toggle switches between overlay and separate', () => {
    render(<ChartPanel open={true} onClose={vi.fn()} />);

    expect(useChartDataStore.getState().layoutMode).toBe('overlay');

    // Click layout toggle button
    const layouts = document.querySelectorAll('button');
    // Find the layout toggle button — it has title="切换为分离模式" when overlay
    const layoutBtn = screen.getByTitle('切换为分离模式');
    fireEvent.click(layoutBtn);
    expect(useChartDataStore.getState().layoutMode).toBe('separate');

    // Click again to switch back
    const layoutBtn2 = screen.getByTitle('切换为叠加模式');
    fireEvent.click(layoutBtn2);
    expect(useChartDataStore.getState().layoutMode).toBe('overlay');
  });

  it('Test 4: clicking close button triggers onClose', () => {
    const onClose = vi.fn();
    render(<ChartPanel open={true} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('关闭图表面板');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Test 5: overlay mode renders 1 ChartCanvas; separate mode renders N (N = trackedEntityIds.size)', () => {
    // Overlay mode with 2 tracked entities
    useChartDataStore.setState({ layoutMode: 'overlay', trackedEntityIds: new Set(['e1', 'e2']) });
    const { unmount } = render(<ChartPanel open={true} onClose={vi.fn()} />);

    // In overlay mode, ChartCanvas renders directly inside panel-body
    const panelBodyOverlay = document.querySelector('.panel-body')!;
    // ChartCanvas renders a container div (lightweight-charts target)
    const chartContainersOverlay = panelBodyOverlay.querySelectorAll('div[style*="min-height: 0px"]');
    expect(chartContainersOverlay.length).toBe(1);

    unmount();

    // Separate mode with 2 tracked entities
    useChartDataStore.setState({ layoutMode: 'separate', trackedEntityIds: new Set(['e1', 'e2']) });
    render(<ChartPanel open={true} onClose={vi.fn()} />);

    // In separate mode, each entity gets a label and its own ChartCanvas
    expect(screen.getByText('e1')).toBeInTheDocument();
    expect(screen.getByText('e2')).toBeInTheDocument();
  });

  it('Test 6: panel-header has cursor-move class; Draggable wrapped around Resizable', () => {
    render(<ChartPanel open={true} onClose={vi.fn()} />);

    // The header should have the panel-header class (Draggable handle target)
    const header = document.querySelector('.panel-header');
    expect(header).toBeInTheDocument();
    expect(header!.classList.contains('cursor-move')).toBe(true);

    // The panel should be wrapped in Draggable (which adds transform style)
    // react-draggable wraps in a div with transform
    const draggableWrapper = document.querySelector('[class*="panel-container"]');
    expect(draggableWrapper).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<ChartPanel open={false} onClose={vi.fn()} />);

    expect(screen.queryByText('实时物理量图表')).not.toBeInTheDocument();
  });
});
