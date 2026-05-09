import { create } from 'zustand';

export type TimeWindow = '5s' | '30s' | 'all';
export type LayoutMode = 'overlay' | 'separate';
export type MetricType = 'position' | 'velocity' | 'acceleration' | 'energy';

export interface ChartConfigState {
  trackedEntityIds: Set<string>;
  timeWindow: TimeWindow;
  layoutMode: LayoutMode;
  peReferenceY: number;

  toggleTracking: (id: string) => void;
  setTimeWindow: (w: TimeWindow) => void;
  setLayoutMode: (m: LayoutMode) => void;
  setPeReferenceY: (y: number) => void;
}

export const useChartDataStore = create<ChartConfigState>()((set) => ({
  trackedEntityIds: new Set(),
  timeWindow: '30s',
  layoutMode: 'overlay',
  peReferenceY: 0,

  toggleTracking: (id) =>
    set((s) => {
      const next = new Set(s.trackedEntityIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { trackedEntityIds: next };
    }),
  setTimeWindow: (w) => set({ timeWindow: w }),
  setLayoutMode: (m) => set({ layoutMode: m }),
  setPeReferenceY: (y) => set({ peReferenceY: y }),
}));
