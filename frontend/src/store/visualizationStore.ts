import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VectorDisplayMode = 'all' | 'selected';

interface VisualizationState {
  showTrails: boolean;
  showVelocityVectors: boolean;
  showForceVectors: boolean;
  vectorDisplayMode: VectorDisplayMode;

  toggleTrails: () => void;
  toggleVelocityVectors: () => void;
  toggleForceVectors: () => void;
  setVectorDisplayMode: (mode: VectorDisplayMode) => void;
}

export const useVisualizationStore = create<VisualizationState>()(
  persist(
    (set) => ({
      showTrails: true,
      showVelocityVectors: false,
      showForceVectors: false,
      vectorDisplayMode: 'all',

      toggleTrails: () => set((s) => ({ showTrails: !s.showTrails })),
      toggleVelocityVectors: () =>
        set((s) => ({ showVelocityVectors: !s.showVelocityVectors })),
      toggleForceVectors: () =>
        set((s) => ({ showForceVectors: !s.showForceVectors })),
      setVectorDisplayMode: (mode) => set({ vectorDisplayMode: mode }),
    }),
    { name: 'physis-visualization' }
  )
);
