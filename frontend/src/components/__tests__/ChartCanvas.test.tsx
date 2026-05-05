import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { useChartDataStore, type MetricType } from '../../store/chartDataStore';
import { chartBuffers, ChartDataBuffer, clearAllBuffers } from '../../store/chartBuffer';

// Use vi.hoisted to make mock variables available in the vi.mock factory
const {
  mockCreateChart,
  mockRemove,
  mockAddSeries,
  mockRemoveSeries,
  mockApplyOptions,
  mockTimeScaleSetVisibleRange,
  mockTimeScaleFitContent,
  mockSeriesInstances,
} = vi.hoisted(() => {
  const seriesInstances: Array<{ update: ReturnType<typeof vi.fn>; setData: ReturnType<typeof vi.fn> }> = [];
  return {
    mockCreateChart: vi.fn(),
    mockRemove: vi.fn(),
    mockAddSeries: vi.fn(),
    mockRemoveSeries: vi.fn(),
    mockApplyOptions: vi.fn(),
    mockTimeScaleSetVisibleRange: vi.fn(),
    mockTimeScaleFitContent: vi.fn(),
    mockSeriesInstances: seriesInstances,
  };
});

vi.mock('lightweight-charts', () => ({
  createChart: mockCreateChart,
  LineSeries: vi.fn(),
}));

// Need to import ChartCanvas after mocks
import { ChartCanvas, type ChartCanvasHandle } from '../ChartCanvas';

function createMockSeries() {
  const inst = { update: vi.fn(), setData: vi.fn() };
  mockSeriesInstances.push(inst);
  return inst;
}

// Helper: render ChartCanvas and get ref
function renderChartCanvas(metric: MetricType = 'position') {
  const ref = React.createRef<ChartCanvasHandle>();
  const result = render(<ChartCanvas ref={ref} metric={metric} />);
  return { ...result, ref };
}

describe('ChartCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeriesInstances.length = 0;
    mockAddSeries.mockImplementation(() => createMockSeries());

    // Build mock chart object
    const mockTimeScale = vi.fn(() => ({
      setVisibleRange: mockTimeScaleSetVisibleRange,
      fitContent: mockTimeScaleFitContent,
    }));

    mockCreateChart.mockReturnValue({
      addSeries: mockAddSeries,
      removeSeries: mockRemoveSeries,
      remove: mockRemove,
      applyOptions: mockApplyOptions,
      timeScale: mockTimeScale,
    });

    // Reset store state
    useChartDataStore.setState({
      trackedEntityIds: new Set(),
      timeWindow: '30s',
      layoutMode: 'overlay',
      visibleMetrics: new Set(['position', 'velocity', 'acceleration', 'energy']),
      peReferenceY: 0,
    });

    // Clear buffers
    clearAllBuffers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1: After mount, createChart is called ──
  it('calls createChart on mount and renders a container div', () => {
    renderChartCanvas();

    // createChart should have been called once
    expect(mockCreateChart).toHaveBeenCalledTimes(1);

    // Container div should be in the document
    const container = document.querySelector('div');
    expect(container).toBeTruthy();
  });

  // ── Test 2: Adding tracked entities creates LineSeries ──
  it('calls chart.addSeries when tracked entities are added', () => {
    const { rerender } = renderChartCanvas();

    // Add tracked entities to the store
    useChartDataStore.setState({ trackedEntityIds: new Set(['entity-1', 'entity-2']) });

    // Rerender to trigger the useEffect
    rerender(<ChartCanvas ref={React.createRef()} metric="position" />);

    // position has 3 axes (x, y, z) = 3 series per entity
    // 2 entities × 3 axes = 6 series
    expect(mockAddSeries).toHaveBeenCalledTimes(6);
  });

  // ── Test 3: series.update() is called via imperative refreshAll ──
  it('calls series.update() when refreshAll is invoked', async () => {
    const ref = React.createRef<ChartCanvasHandle>();

    // Populate buffer with some data — use timestamp close to now
    const now = performance.now() / 1000;
    const buf = new ChartDataBuffer();
    const metrics = new Float64Array(12);
    metrics[0] = 10; // x position
    metrics[1] = 20; // y position
    buf.push(now - 5, metrics);
    chartBuffers.set('entity-1', buf);

    const { rerender } = render(<ChartCanvas ref={ref} metric="position" />);

    // Set tracked entity
    useChartDataStore.setState({ trackedEntityIds: new Set(['entity-1']) });
    rerender(<ChartCanvas ref={ref} metric="position" />);

    // Wait for useEffect to add series before calling refreshAll
    await waitFor(() => {
      expect(mockAddSeries).toHaveBeenCalled();
    });

    // Call refreshAll
    ref.current?.refreshAll();

    // Should have called update on one of the series
    const anyUpdateCalled = mockSeriesInstances.some((s) => s.update.mock.calls.length > 0);
    expect(anyUpdateCalled).toBe(true);
  });

  // ── Test 4: On unmount, chart.remove() is called ──
  it('calls chart.remove() on unmount (no leak)', () => {
    const { unmount } = renderChartCanvas();

    expect(mockRemove).not.toHaveBeenCalled();

    unmount();

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  // ── Test 5: setTimeWindow calls timeScale.setVisibleRange ──
  it('calls timeScale.setVisibleRange when timeWindow changes to 5s', () => {
    const ref = React.createRef<ChartCanvasHandle>();

    render(<ChartCanvas ref={ref} metric="position" />);

    // Set time window to 5s via imperative API
    ref.current?.setTimeWindow('5s');

    expect(mockTimeScaleSetVisibleRange).toHaveBeenCalled();
  });

  // ── Test 6: Overlay mode puts all entities in single chart ──
  it('uses a single chart for multiple tracked entities in overlay mode', () => {
    // overlay is the default layout mode
    const { rerender } = renderChartCanvas();

    useChartDataStore.setState({ trackedEntityIds: new Set(['entity-1', 'entity-2', 'entity-3']) });
    rerender(<ChartCanvas ref={React.createRef()} metric="position" />);

    // Only one chart created (on mount), all series added to it
    expect(mockCreateChart).toHaveBeenCalledTimes(1);
    // 3 entities × 3 axes (x, y, z) = 9 series
    expect(mockAddSeries).toHaveBeenCalledTimes(9);
  });
});
