import { describe, it, expect, afterEach } from 'vitest';
import { useChartDataStore, type MetricType } from '../chartDataStore';

describe('chartDataStore', () => {
  afterEach(() => {
    // Reset store to initial state between tests
    useChartDataStore.setState({
      trackedEntityIds: new Set(),
      timeWindow: '30s',
      layoutMode: 'overlay',
      visibleMetrics: new Set<MetricType>(['position', 'velocity', 'acceleration', 'energy']),
      peReferenceY: 0,
    });
  });

  describe('initial state', () => {
    it('has empty trackedEntityIds', () => {
      expect(useChartDataStore.getState().trackedEntityIds.size).toBe(0);
    });

    it('has default timeWindow 30s', () => {
      expect(useChartDataStore.getState().timeWindow).toBe('30s');
    });

    it('has default layoutMode overlay', () => {
      expect(useChartDataStore.getState().layoutMode).toBe('overlay');
    });

    it('has all 4 metric types visible by default', () => {
      const visible = useChartDataStore.getState().visibleMetrics;
      expect(visible.size).toBe(4);
      expect(visible.has('position')).toBe(true);
      expect(visible.has('velocity')).toBe(true);
      expect(visible.has('acceleration')).toBe(true);
      expect(visible.has('energy')).toBe(true);
    });

    it('has default peReferenceY 0', () => {
      expect(useChartDataStore.getState().peReferenceY).toBe(0);
    });
  });

  describe('toggleTracking', () => {
    it('adds entity on first toggle', () => {
      useChartDataStore.getState().toggleTracking('e1');
      expect(useChartDataStore.getState().trackedEntityIds.has('e1')).toBe(true);
    });

    it('removes entity on second toggle', () => {
      useChartDataStore.getState().toggleTracking('e1');
      useChartDataStore.getState().toggleTracking('e1');
      expect(useChartDataStore.getState().trackedEntityIds.has('e1')).toBe(false);
    });

    it('tracks multiple entities independently', () => {
      useChartDataStore.getState().toggleTracking('e1');
      useChartDataStore.getState().toggleTracking('e2');
      const ids = useChartDataStore.getState().trackedEntityIds;
      expect(ids.has('e1')).toBe(true);
      expect(ids.has('e2')).toBe(true);
      expect(ids.size).toBe(2);
    });
  });

  describe('setTimeWindow', () => {
    it('updates timeWindow to 5s', () => {
      useChartDataStore.getState().setTimeWindow('5s');
      expect(useChartDataStore.getState().timeWindow).toBe('5s');
    });

    it('updates timeWindow to all', () => {
      useChartDataStore.getState().setTimeWindow('all');
      expect(useChartDataStore.getState().timeWindow).toBe('all');
    });
  });

  describe('setLayoutMode', () => {
    it('updates layoutMode to separate', () => {
      useChartDataStore.getState().setLayoutMode('separate');
      expect(useChartDataStore.getState().layoutMode).toBe('separate');
    });
  });

  describe('setVisibleMetrics', () => {
    it('reduces to single metric', () => {
      useChartDataStore.getState().setVisibleMetrics(new Set<MetricType>(['position']));
      expect(useChartDataStore.getState().visibleMetrics.size).toBe(1);
      expect(useChartDataStore.getState().visibleMetrics.has('position')).toBe(true);
    });

    it('can set empty metrics set', () => {
      useChartDataStore.getState().setVisibleMetrics(new Set<MetricType>());
      expect(useChartDataStore.getState().visibleMetrics.size).toBe(0);
    });
  });

  describe('setPeReferenceY', () => {
    it('updates peReferenceY to 5.5', () => {
      useChartDataStore.getState().setPeReferenceY(5.5);
      expect(useChartDataStore.getState().peReferenceY).toBe(5.5);
    });

    it('accepts negative values', () => {
      useChartDataStore.getState().setPeReferenceY(-10);
      expect(useChartDataStore.getState().peReferenceY).toBe(-10);
    });
  });
});
