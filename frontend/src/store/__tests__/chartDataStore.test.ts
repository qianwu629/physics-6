import { describe, it, expect, afterEach } from 'vitest';
import { useChartDataStore } from '../chartDataStore';

describe('chartDataStore', () => {
  afterEach(() => {
    // Reset store to initial state between tests
    useChartDataStore.setState({
      trackedEntityIds: new Set(),
      timeWindow: '30s',
      layoutMode: 'overlay',
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

    // C-04 fix: peReferenceY 已迁移至 simulationSlice.environment.peReferenceY
    // 此处不再测试 chartDataStore 副本(原副本已删除)。
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

  // C-04 fix: setPeReferenceY 已从 chartDataStore 删除,
  // 现仅存在于 simulationSlice (setPeReferenceY action 已在 simulationSlice.test 覆盖,
  // 或可通过 EnvironmentPanel 集成测试覆盖)。
});
