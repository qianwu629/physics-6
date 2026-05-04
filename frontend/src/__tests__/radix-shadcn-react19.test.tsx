import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

describe('shadcn Dialog + Button with React 19', () => {
  it('should not cause infinite loop on confirm add', () => {
    let renderCount = 0;

    function TestApp() {
      renderCount++;
      const [dialogOpen, setDialogOpen] = React.useState(false);
      const [entities, setEntities] = React.useState<string[]>([]);

      const handleConfirm = () => {
        setEntities(prev => [...prev, `entity-${prev.length}`]);
        setDialogOpen(false);
      };

      return (
        <div>
          <div data-testid="entity-count">{entities.length}</div>
          <button onClick={() => setDialogOpen(true)}>Open Dialog</button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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

    // Click confirm
    fireEvent.click(screen.getByText('Confirm Add'));

    expect(screen.getByTestId('entity-count').textContent).toBe('1');
    expect(renderCount).toBeLessThan(50);
  });
});
