import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

vi.mock('@/store', async () => {
  const { create: actualCreate } = await vi.importActual('zustand');
  const mockStore = actualCreate<any>((set: any) => ({
    dialogOpen: true,
    dialogDefaultShape: 'sphere',
    entities: new Map(),
    closeDialog: () => set({ dialogOpen: false }),
    addEntity: () => {
      set((state: any) => {
        const next = new Map(state.entities);
        next.set('test-1', { id: 'test-1', name: 'Test' });
        return { entities: next };
      });
      set({ dialogOpen: false });
      return true;
    },
  }));
  return { useSimulationStore: mockStore };
});

// Import after mock
import CreationDialog from '@/components/CreationDialog';

describe('CreationDialog with React 19', () => {
  it('should not cause infinite loop on confirm add', async () => {
    let errorThrown = false;
    const originalError = console.error;
    console.error = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes('Maximum update depth exceeded')) {
        errorThrown = true;
      }
      originalError.apply(console, args);
    };

    render(<CreationDialog />);

    // Wait for dialog to render
    await waitFor(() => {
      expect(screen.getByText('确认添加')).toBeInTheDocument();
    });

    // Click confirm
    fireEvent.click(screen.getByText('确认添加'));

    // Wait a bit for any async effects
    await new Promise(resolve => setTimeout(resolve, 100));

    console.error = originalError;
    expect(errorThrown).toBe(false);
  });
});
