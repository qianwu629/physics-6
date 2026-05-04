import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';

describe('radix-ui Dialog with React 19', () => {
  it('should not cause infinite loop when dialog state changes', () => {
    let renderCount = 0;

    function TestDialog() {
      renderCount++;
      const [open, setOpen] = React.useState(false);
      const [items, setItems] = React.useState<string[]>([]);

      const handleAdd = () => {
        setItems(prev => [...prev, `item-${prev.length}`]);
        setOpen(false);
      };

      return (
        <div>
          <div data-testid="count">{items.length}</div>
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger asChild>
              <button>Open Dialog</button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay />
              <DialogPrimitive.Content>
                <button onClick={handleAdd}>Confirm Add</button>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      );
    }

    render(<TestDialog />);

    // Open dialog
    fireEvent.click(screen.getByText('Open Dialog'));
    expect(screen.getByText('Confirm Add')).toBeInTheDocument();

    // Click confirm - this should not cause infinite loop
    fireEvent.click(screen.getByText('Confirm Add'));

    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(renderCount).toBeLessThan(50);
  });
});
