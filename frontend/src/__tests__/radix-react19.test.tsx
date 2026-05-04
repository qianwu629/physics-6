import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { Slot } from 'radix-ui';

describe('radix-ui Slot with React 19', () => {
  it('should handle ref without infinite loop on re-render', () => {
    let renderCount = 0;

    function TestComponent() {
      renderCount++;
      const [count, setCount] = React.useState(0);

      React.useEffect(() => {
        if (count < 3) {
          setCount(c => c + 1);
        }
      }, [count]);

      return (
        <Slot.Root>
          <div data-testid="test">{count}</div>
        </Slot.Root>
      );
    }

    render(<TestComponent />);

    expect(renderCount).toBeLessThan(20);
    expect(screen.getByTestId('test').textContent).toBe('3');
  });
});
