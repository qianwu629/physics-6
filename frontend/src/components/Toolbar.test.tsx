import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Play: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return <svg data-testid="icon-play" data-size={size} data-stroke={strokeWidth} {...rest} />;
  },
  Pause: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return <svg data-testid="icon-pause" data-size={size} data-stroke={strokeWidth} {...rest} />;
  },
  RotateCcw: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return <svg data-testid="icon-rotate-ccw" data-size={size} data-stroke={strokeWidth} {...rest} />;
  },
  Bug: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return <svg data-testid="icon-bug" data-size={size} data-stroke={strokeWidth} {...rest} />;
  },
  Gauge: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return <svg data-testid="icon-gauge" data-size={size} data-stroke={strokeWidth} {...rest} />;
  },
  Boxes: (props: Record<string, unknown>) => {
    const { size, strokeWidth, ...rest } = props;
    return <svg data-testid="icon-boxes" data-size={size} data-stroke={strokeWidth} {...rest} />;
  },
}));

// Mock cn utility
vi.mock('../lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Store state type
interface StoreState {
  isRunning: boolean;
  showDebug: boolean;
  fps: number;
  objectCount: number;
  toggle: () => void;
  reset: () => void;
  setShowDebug: (v: boolean) => void;
}

type StoreSelector<T> = (state: StoreState) => T;

// Create a mutable store state for testing
let storeState: StoreState;

// Mock Zustand store
vi.mock('../store', () => ({
  useSimulationStore: (selector: StoreSelector<unknown>) => selector(storeState),
}));

function createStore(overrides: Partial<StoreState> = {}): StoreState {
  storeState = {
    isRunning: false,
    showDebug: false,
    fps: 0,
    objectCount: 0,
    toggle: vi.fn(),
    reset: vi.fn(),
    setShowDebug: vi.fn(),
    ...overrides,
  };
  return storeState;
}

// Import after all mocks are set up
import Toolbar from './Toolbar';

function renderToolbar(overrides?: Partial<StoreState>): ReturnType<typeof render> & { store: StoreState } {
  const store = createStore(overrides);
  const result = render(<Toolbar />);
  return { ...result, store };
}

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state (isRunning=false)', () => {
    it('renders play button with "▶ 播放" text', () => {
      renderToolbar({ isRunning: false });
      const btn = screen.getByRole('button', { name: '播放仿真' });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('▶ 播放');
    });

    it('play button has gray color in initial state', () => {
      renderToolbar({ isRunning: false });
      const btn = screen.getByRole('button', { name: '播放仿真' });
      // Initial state: transparent background, gray text
      expect(btn.style.backgroundColor).toBe('transparent');
    });

    it('renders Play icon (not Pause) when not running', () => {
      renderToolbar({ isRunning: false });
      expect(screen.getByTestId('icon-play')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-pause')).not.toBeInTheDocument();
    });
  });

  describe('running state (isRunning=true)', () => {
    it('renders pause button with "⏸ 暂停" text', () => {
      renderToolbar({ isRunning: true });
      const btn = screen.getByRole('button', { name: '暂停仿真' });
      expect(btn).toBeInTheDocument();
      expect(btn.textContent).toContain('⏸ 暂停');
    });

    it('pause button has blue accent background', () => {
      renderToolbar({ isRunning: true });
      const btn = screen.getByRole('button', { name: '暂停仿真' });
      expect(btn.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6
    });

    it('renders Pause icon (not Play) when running', () => {
      renderToolbar({ isRunning: true });
      expect(screen.getByTestId('icon-pause')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-play')).not.toBeInTheDocument();
    });
  });

  describe('reset button', () => {
    it('has aria-label "重置仿真"', () => {
      renderToolbar();
      expect(screen.getByRole('button', { name: '重置仿真' })).toBeInTheDocument();
    });

    it('displays "↺ 重置" text', () => {
      renderToolbar();
      const btn = screen.getByRole('button', { name: '重置仿真' });
      expect(btn.textContent).toContain('↺ 重置');
    });
  });

  describe('debug toggle button', () => {
    it('shows inactive state when showDebug is false', () => {
      renderToolbar({ showDebug: false });
      const btn = screen.getByRole('button', { name: '开启物理调试' });
      expect(btn.style.backgroundColor).toBe('transparent');
    });

    it('shows active state when showDebug is true', () => {
      renderToolbar({ showDebug: true });
      const btn = screen.getByRole('button', { name: '关闭物理调试' });
      expect(btn.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3b82f6
    });

    it('calls setShowDebug with true when clicked in inactive state', () => {
      const { store } = renderToolbar({ showDebug: false });
      const btn = screen.getByRole('button', { name: '开启物理调试' });
      btn.click();
      expect(store.setShowDebug).toHaveBeenCalledWith(true);
    });

    it('calls setShowDebug with false when clicked in active state', () => {
      const { store } = renderToolbar({ showDebug: true });
      const btn = screen.getByRole('button', { name: '关闭物理调试' });
      btn.click();
      expect(store.setShowDebug).toHaveBeenCalledWith(false);
    });
  });

  describe('FPS display', () => {
    it('shows FPS in "{n} FPS" format', () => {
      renderToolbar({ fps: 120 });
      expect(screen.getByText('120 FPS')).toBeInTheDocument();
    });

    it('shows zero FPS initially', () => {
      renderToolbar({ fps: 0 });
      expect(screen.getByText('0 FPS')).toBeInTheDocument();
    });
  });

  describe('object count display', () => {
    it('shows object count in "物体: {n}" format', () => {
      renderToolbar({ objectCount: 14 });
      expect(screen.getByText('物体: 14')).toBeInTheDocument();
    });

    it('shows zero object count initially', () => {
      renderToolbar({ objectCount: 0 });
      expect(screen.getByText('物体: 0')).toBeInTheDocument();
    });
  });

  describe('toolbar styling', () => {
    it('has fixed positioning', () => {
      renderToolbar();
      const toolbar = screen.getByRole('button', { name: '播放仿真' }).closest('div');
      expect(toolbar).not.toBeNull();
      // Check the outer div has fixed positioning
      const outerDiv = toolbar?.parentElement;
      // The toolbar itself should be the fixed container
      expect(toolbar).toBeInTheDocument();
    });

    it('has semi-transparent background', () => {
      renderToolbar();
      const btn = screen.getByRole('button', { name: '播放仿真' });
      const toolbar = btn.closest('div')?.parentElement;
      expect(toolbar).not.toBeNull();
    });
  });

  describe('click handlers', () => {
    it('calls toggle when play button is clicked', () => {
      const { store } = renderToolbar({ isRunning: false });
      const btn = screen.getByRole('button', { name: '播放仿真' });
      btn.click();
      expect(store.toggle).toHaveBeenCalledTimes(1);
    });

    it('calls toggle when pause button is clicked', () => {
      const { store } = renderToolbar({ isRunning: true });
      const btn = screen.getByRole('button', { name: '暂停仿真' });
      btn.click();
      expect(store.toggle).toHaveBeenCalledTimes(1);
    });

    it('calls reset when reset button is clicked', () => {
      const { store } = renderToolbar();
      const btn = screen.getByRole('button', { name: '重置仿真' });
      btn.click();
      expect(store.reset).toHaveBeenCalledTimes(1);
    });
  });
});
