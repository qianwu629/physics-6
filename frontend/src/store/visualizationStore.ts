import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VectorDisplayMode = 'all' | 'selected';

interface VisualizationState {
  showTrails: boolean;
  showVelocityVectors: boolean;
  showForceVectors: boolean;
  showForceLines: boolean;
  vectorDisplayMode: VectorDisplayMode;
  /** 箭头缩放倍率（0.2–3.0，默认 1） */
  arrowScale: number;

  toggleTrails: () => void;
  toggleVelocityVectors: () => void;
  toggleForceVectors: () => void;
  toggleForceLines: () => void;
  setVectorDisplayMode: (mode: VectorDisplayMode) => void;
  setArrowScale: (v: number) => void;
}

export const useVisualizationStore = create<VisualizationState>()(
  persist(
    (set) => ({
      showTrails: true,
      showVelocityVectors: false,
      showForceVectors: true,
      showForceLines: true,
      vectorDisplayMode: 'all',
      arrowScale: 1,

      toggleTrails: () => set((s) => ({ showTrails: !s.showTrails })),
      toggleVelocityVectors: () =>
        set((s) => ({ showVelocityVectors: !s.showVelocityVectors })),
      toggleForceVectors: () =>
        set((s) => ({ showForceVectors: !s.showForceVectors })),
      toggleForceLines: () => set((s) => ({ showForceLines: !s.showForceLines })),
      setVectorDisplayMode: (mode) => set({ vectorDisplayMode: mode }),
      setArrowScale: (v) => set({ arrowScale: Math.max(0.2, Math.min(3, v)) }),
    }),
    { name: 'physis-visualization' }
  )
);
