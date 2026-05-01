import { create } from 'zustand';
import { createSimulationSlice, type SimulationSlice } from './simulationSlice';
import { createEntitySlice, type EntitySlice } from './entitySlice';
import { createUiSlice, type UiSlice } from './uiSlice';

/**
 * Physis 全局 Store
 *
 * Phase 1: simulationSlice (isRunning, fps, resetCounter, etc.)
 * Phase 2: + entitySlice (entities Map, selectedEntityId, CRUD)
 *          + uiSlice (toolboxCollapsed, dialogOpen, etc.)
 */

export const useSimulationStore = create<SimulationSlice & EntitySlice & UiSlice>()((...args) => ({
  ...createSimulationSlice(...args),
  ...createEntitySlice(...args),
  ...createUiSlice(...args),
}));
