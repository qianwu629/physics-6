import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface TestStore {
  entities: Map<string, { id: string; name: string }>;
  dialogOpen: boolean;
  addEntity: () => void;
  closeDialog: () => void;
  openDialog: () => void;
}

const useTestStore = create<TestStore>((set) => ({
  entities: new Map(),
  dialogOpen: false,
  addEntity: () => set((state) => {
    const next = new Map(state.entities);
    next.set(`entity-${next.size}`, { id: `entity-${next.size}`, name: 'Test' });
    return { entities: next };
  }),
  closeDialog: () => set({ dialogOpen: false }),
  openDialog: () => set({ dialogOpen: true }),
}));

describe('shadcn + zustand with React 19', () => {
  it('should not cause infinite loop when adding entity via store', () => {
    let renderCount = 0;

    function TestApp() {
      renderCount++;
      const { entities, dialogOpen, addEntity, closeDialog, openDialog } = useTestStore();

      const handleConfirm = () => {
        addEntity();
        closeDialog();
      };

      return (
        <div>
          <div data-testid="entity-count">{entities.size}</div>
          <button onClick={openDialog}>Open Dialog</button>
          <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Entity</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={handleConfirm}>
                  Confirm Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    render(<TestApp />);

    // Open dialog
    fireEvent.click(screen.getByText('Open Dialog'));
    expect(screen.getByText('Confirm Add')).toBeInTheDocument();

    // Click confirm - this simulates the actual bug scenario
    fireEvent.click(screen.getByText('Confirm Add'));

    expect(screen.getByTestId('entity-count').textContent).toBe('1');
    expect(renderCount).toBeLessThan(50);
  });
});
