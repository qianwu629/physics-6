import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: (props: Record<string, unknown>) => {
    const { size, strokeWidth, color, style, ...rest } = props;
    return (
      <svg
        data-testid="icon-loader2"
        data-size={size}
        data-stroke={strokeWidth}
        data-color={color}
        style={style as React.CSSProperties}
        {...rest}
      />
    );
  },
  AlertTriangle: (props: Record<string, unknown>) => {
    const { size, strokeWidth, color, ...rest } = props;
    return (
      <svg
        data-testid="icon-alert-triangle"
        data-size={size}
        data-stroke={strokeWidth}
        data-color={color}
        {...rest}
      />
    );
  },
  RefreshCw: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return (
      <svg
        data-testid="icon-refresh-cw"
        data-size={size}
        data-stroke={strokeWidth}
        {...rest}
      />
    );
  },
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

import LoadingScreen from './LoadingScreen';
import ErrorFallback from './ErrorFallback';

describe('LoadingScreen', () => {
  it('renders the loading text "正在加载物理引擎..."', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('正在加载物理引擎...')).toBeInTheDocument();
  });

  it('renders Loader2 spinning icon', () => {
    render(<LoadingScreen />);
    const icon = screen.getByTestId('icon-loader2');
    expect(icon).toBeInTheDocument();
    expect(icon.dataset.color).toBe('var(--holo)');
    expect(icon.dataset.size).toBe('40');
  });

  it('has sci-fi well background', () => {
    render(<LoadingScreen />);
    // The LoadingScreen is a fixed full-screen div — the <p> is its direct child
    const textElement = screen.getByText('正在加载物理引擎...');
    const container = textElement.parentElement;
    expect(container).not.toBeNull();
    expect(container?.style.backgroundColor).toBe('var(--well)'); // Sci-fi Lab 深井底色
  });

  it('has centered layout', () => {
    render(<LoadingScreen />);
    // The fixed container div is the direct parent of the <p> element
    const textElement = screen.getByText('正在加载物理引擎...');
    const container = textElement.parentElement;
    expect(container?.style.display).toBe('flex');
    expect(container?.style.justifyContent).toBe('center');
    expect(container?.style.alignItems).toBe('center');
  });

  it('has spin CSS animation defined', () => {
    render(<LoadingScreen />);
    const loaderIcon = screen.getByTestId('icon-loader2');
    expect(loaderIcon.style.animation).toBe('spin 1s linear infinite');
  });
});

describe('ErrorFallback', () => {
  describe('webgl error type', () => {
    it('renders "WebGL 不可用" heading', () => {
      render(<ErrorFallback type="webgl" />);
      expect(screen.getByText('WebGL 不可用')).toBeInTheDocument();
    });

    it('renders description containing "WebGL 2.0"', () => {
      render(<ErrorFallback type="webgl" />);
      expect(screen.getByText(/WebGL 2\.0/)).toBeInTheDocument();
    });

    it('renders AlertTriangle icon in red', () => {
      render(<ErrorFallback type="webgl" />);
      const icon = screen.getByTestId('icon-alert-triangle');
      expect(icon).toBeInTheDocument();
      expect(icon.dataset.color).toBe('var(--destructive)');
    });

    it('has sci-fi well background', () => {
      render(<ErrorFallback type="webgl" />);
      const heading = screen.getByText('WebGL 不可用');
      const outerContainer = heading.parentElement?.parentElement;
      expect(outerContainer).not.toBeNull();
      expect(outerContainer?.style.backgroundColor).toBe('var(--well)'); // Sci-fi Lab 深井底色
    });
  });

  describe('wasm error type', () => {
    it('renders "物理引擎加载失败" heading', () => {
      render(<ErrorFallback type="wasm" />);
      expect(screen.getByText('物理引擎加载失败')).toBeInTheDocument();
    });

    it('renders description containing "WebAssembly"', () => {
      render(<ErrorFallback type="wasm" />);
      expect(screen.getByText(/WebAssembly/)).toBeInTheDocument();
    });

    it('renders AlertTriangle icon in red', () => {
      render(<ErrorFallback type="wasm" />);
      const icon = screen.getByTestId('icon-alert-triangle');
      expect(icon).toBeInTheDocument();
      expect(icon.dataset.color).toBe('var(--destructive)');
    });
  });

  describe('shared behavior', () => {
    it('renders refresh button with "刷新页面" text', () => {
      render(<ErrorFallback type="wasm" />);
      const btn = screen.getByText('刷新页面');
      expect(btn).toBeInTheDocument();
      expect(btn.tagName).toBe('BUTTON');
    });

    it('calls window.location.reload when refresh button is clicked', () => {
      mockReload.mockClear();
      render(<ErrorFallback type="webgl" />);
      const btn = screen.getByText('刷新页面');
      fireEvent.click(btn);
      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('renders RefreshCw icon inside refresh button', () => {
      render(<ErrorFallback type="wasm" />);
      const btn = screen.getByText('刷新页面').closest('button');
      expect(btn).not.toBeNull();
      const icon = btn!.querySelector('[data-testid="icon-refresh-cw"]');
      expect(icon).toBeInTheDocument();
    });

    it('error card is centered', () => {
      render(<ErrorFallback type="webgl" />);
      // The heading is inside the error card div, which is inside the fixed outer div
      const heading = screen.getByText('WebGL 不可用');
      const outerContainer = heading.parentElement?.parentElement;
      expect(outerContainer?.style.display).toBe('flex');
      expect(outerContainer?.style.justifyContent).toBe('center');
      expect(outerContainer?.style.alignItems).toBe('center');
    });
  });
});
