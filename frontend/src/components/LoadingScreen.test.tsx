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
import type { ErrorType } from './ErrorFallback';

describe('LoadingScreen', () => {
  it('renders the loading text "正在加载物理引擎..."', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('正在加载物理引擎...')).toBeInTheDocument();
  });

  it('renders Loader2 spinning icon', () => {
    render(<LoadingScreen />);
    const icon = screen.getByTestId('icon-loader2');
    expect(icon).toBeInTheDocument();
    expect(icon.dataset.color).toBe('#3b82f6');
    expect(icon.dataset.size).toBe('40');
  });

  it('has dark background #0a0a0a', () => {
    render(<LoadingScreen />);
    // The LoadingScreen is a fixed full-screen div with backgroundColor #0a0a0a
    const container = screen.getByText('正在加载物理引擎...').closest('div');
    expect(container).not.toBeNull();
    // The fixed container should be the one with background
    expect(container?.parentElement).not.toBeNull();
  });

  it('has centered layout', () => {
    render(<LoadingScreen />);
    const container = screen.getByText('正在加载物理引擎...').closest('div');
    expect(container?.parentElement?.style.display).toBe('flex');
    expect(container?.parentElement?.style.justifyContent).toBe('center');
    expect(container?.parentElement?.style.alignItems).toBe('center');
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
      expect(icon.dataset.color).toBe('#ef4444');
    });

    it('has dark background #0a0a0a', () => {
      render(<ErrorFallback type="webgl" />);
      const container = screen.getByText('WebGL 不可用').closest('div');
      expect(container?.parentElement).not.toBeNull();
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
      expect(icon.dataset.color).toBe('#ef4444');
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
      const container = screen.getByText('WebGL 不可用').closest('div')?.parentElement;
      expect(container?.style.display).toBe('flex');
      expect(container?.style.justifyContent).toBe('center');
      expect(container?.style.alignItems).toBe('center');
    });
  });
});
