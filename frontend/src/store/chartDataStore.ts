/**
 * Phase 2: 图表配置状态 (Plan 02-01)
 *
 * Zustand 只存"配置"（追踪开关、时间窗口、布局模式）。
 * 采样数据存在 chartBuffer 的独立 class 实例中，不经过 Zustand。
 * 遵循 D-02-06: Zustand 配置 + Ref 数据分离。
 */

import { create } from 'zustand';

export interface ChartConfigState {
  /** 被追踪的实体 ID 集合（D-02-09: 默认空集 = 不追踪任何实体） */
  trackedEntityIds: Set<string>;
  /** 时间窗口: 5s / 30s / 全程 */
  timeWindow: '5s' | '30s' | 'all';
  /** 图表布局: 叠加 / 分离 */
  layoutMode: 'overlay' | 'separate';
  /** 可见物理量类别 */
  visibleMetrics: Set<'position' | 'velocity' | 'acceleration' | 'energy'>;
  /** 势能参考零点 Y 坐标 (D-02-08) */
  peReferenceY: number;

  // Actions
  toggleTracking: (id: string) => void;
  setTimeWindow: (w: '5s' | '30s' | 'all') => void;
  setLayoutMode: (m: 'overlay' | 'separate') => void;
  setPeReferenceY: (y: number) => void;
}

export const useChartDataStore = create<ChartConfigState>()((set) => ({
  trackedEntityIds: new Set(),
  timeWindow: '30s',
  layoutMode: 'overlay',
  visibleMetrics: new Set(['position', 'velocity', 'acceleration', 'energy']),
  peReferenceY: 0,

  toggleTracking: (id) =>
    set((s) => {
      const next = new Set(s.trackedEntityIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { trackedEntityIds: next };
    }),

  setTimeWindow: (w) => set({ timeWindow: w }),
  setLayoutMode: (m) => set({ layoutMode: m }),
  setPeReferenceY: (y) => set({ peReferenceY: y }),
}));
