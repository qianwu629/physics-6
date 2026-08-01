import { create } from 'zustand';

export type TimeWindow = '5s' | '30s' | 'all';
export type LayoutMode = 'overlay' | 'separate';
export type MetricType = 'position' | 'velocity' | 'acceleration' | 'energy' | 'momentum';

export interface ChartConfigState {
  trackedEntityIds: Set<string>;
  timeWindow: TimeWindow;
  layoutMode: LayoutMode;

  toggleTracking: (id: string) => void;
  setTimeWindow: (w: TimeWindow) => void;
  setLayoutMode: (m: LayoutMode) => void;
  /** C-05 fix: 删除实体时调用,从追踪集合中移除其 id */
  untrackEntity: (id: string) => void;
}

// C-04 fix: peReferenceY 已统一存于 simulationSlice.environment.peReferenceY
// (See: store/simulationSlice.ts:17/96 — 唯一来源)
// 之前 chartDataStore 持有副本导致 EnvironmentPanel 写入与 sceneSerializer
// 读取使用不同 store, scene save/load 静默丢失用户设置。

export const useChartDataStore = create<ChartConfigState>()((set) => ({
  trackedEntityIds: new Set(),
  timeWindow: '30s',
  layoutMode: 'overlay',

  toggleTracking: (id) =>
    set((s) => {
      const next = new Set(s.trackedEntityIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { trackedEntityIds: next };
    }),
  setTimeWindow: (w) => set({ timeWindow: w }),
  setLayoutMode: (m) => set({ layoutMode: m }),
  untrackEntity: (id) =>
    set((s) => {
      if (!s.trackedEntityIds.has(id)) return s;
      const next = new Set(s.trackedEntityIds);
      next.delete(id);
      return { trackedEntityIds: next };
    }),
}));
