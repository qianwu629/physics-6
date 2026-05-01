import { create } from 'zustand';
import { createSimulationSlice, type SimulationSlice } from './simulationSlice';

/**
 * Physis 全局 Store
 *
 * Phase 1: 仅包含 simulationSlice。
 * Phase 2+ 将添加 sceneSlice、uiSlice 等（STACK.md 切片模式）。
 */

export const useSimulationStore = create<SimulationSlice>()((...args) => ({
  ...createSimulationSlice(...args),
}));
