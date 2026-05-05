import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill ResizeObserver for jsdom (required by Radix UI components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill findDOMNode for react-draggable compatibility with React 19
// react-draggable@4.5.0 uses ReactDOM.findDOMNode which was removed in React 19
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    findDOMNode: (instance: unknown) => {
      if (instance instanceof Element) return instance;
      if (instance && typeof instance === 'object' && 'nodeType' in instance) {
        return instance as Element;
      }
      return null;
    },
  };
});
