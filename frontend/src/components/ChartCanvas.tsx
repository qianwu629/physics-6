import { forwardRef } from 'react';
import type { MetricType } from '../store/chartDataStore';

export interface ChartCanvasHandle {
  refreshAll: () => void;
  setTimeWindow: (window: '5s' | '30s' | 'all') => void;
}

interface ChartCanvasProps {
  metric: MetricType;
}

// Skeleton — TDD RED phase, to be implemented in GREEN phase
export const ChartCanvas = forwardRef<ChartCanvasHandle, ChartCanvasProps>(
  function ChartCanvas(_props, _ref) {
    return null;
  }
);
