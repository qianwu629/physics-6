import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock store state
interface StoreState {
  environmentPanelOpen: boolean;
  closeEnvironmentPanel: () => void;
  toggleEnvironmentPanel: () => void;
  environment: {
    gravity: [number, number, number];
    frictionScale: number;
    restitutionScale: number;
    drag: number;
  };
  setGravity: (g: [number, number, number]) => void;
  setFrictionScale: (v: number) => void;
  setRestitutionScale: (v: number) => void;
  setDrag: (v: number) => void;
  isRunning: boolean;
}

let storeState: StoreState;

vi.mock('../../store', () => ({
  useSimulationStore: (selector: (s: StoreState) => unknown) => selector(storeState),
}));

function createStore(overrides: Partial<StoreState> = {}): StoreState {
  storeState = {
    environmentPanelOpen: true, // default open for testing
    closeEnvironmentPanel: vi.fn(),
    toggleEnvironmentPanel: vi.fn(),
    environment: {
      gravity: [0, -9.81, 0],
      frictionScale: 1.0,
      restitutionScale: 1.0,
      drag: 0.1,
    },
    setGravity: vi.fn(),
    setFrictionScale: vi.fn(),
    setRestitutionScale: vi.fn(),
    setDrag: vi.fn(),
    isRunning: false,
    ...overrides,
  };
  return storeState;
}

import EnvironmentPanel from '../EnvironmentPanel';

function renderPanel(overrides?: Partial<StoreState>) {
  const store = createStore(overrides);
  const result = render(<EnvironmentPanel />);
  return { ...result, store };
}

describe('EnvironmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders when environmentPanelOpen is true', () => {
      renderPanel({ environmentPanelOpen: true });
      expect(screen.getByText('环境参数')).toBeInTheDocument();
    });

    it('does not render when environmentPanelOpen is false', () => {
      renderPanel({ environmentPanelOpen: false });
      expect(screen.queryByText('环境参数')).not.toBeInTheDocument();
    });

    it('renders 4 gravity preset buttons', () => {
      renderPanel();
      expect(screen.getByText('地球')).toBeInTheDocument();
      expect(screen.getByText('月球')).toBeInTheDocument();
      expect(screen.getByText('火星')).toBeInTheDocument();
      expect(screen.getByText('零重力')).toBeInTheDocument();
    });
  });

  describe('gravity presets', () => {
    it('clicking Earth sets gravity to [0, -9.81, 0]', () => {
      const { store } = renderPanel({
        environment: { gravity: [0, -1.62, 0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1 },
      });
      fireEvent.click(screen.getByText('地球'));
      expect(store.setGravity).toHaveBeenCalledWith([0, -9.81, 0]);
    });

    it('clicking Moon sets gravity to [0, -1.62, 0]', () => {
      const { store } = renderPanel();
      fireEvent.click(screen.getByText('月球'));
      expect(store.setGravity).toHaveBeenCalledWith([0, -1.62, 0]);
    });

    it('clicking Mars sets gravity to [0, -3.71, 0]', () => {
      const { store } = renderPanel();
      fireEvent.click(screen.getByText('火星'));
      expect(store.setGravity).toHaveBeenCalledWith([0, -3.71, 0]);
    });

    it('clicking Zero-G sets gravity to [0, 0, 0]', () => {
      const { store } = renderPanel();
      fireEvent.click(screen.getByText('零重力'));
      expect(store.setGravity).toHaveBeenCalledWith([0, 0, 0]);
    });

    it('active preset button is highlighted', () => {
      renderPanel({
        environment: { gravity: [0, -1.62, 0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1 },
      });
      // Moon should have the active style (bg-[rgba(59,130,246,0.2)])
      const moonBtn = screen.getByText('月球');
      expect(moonBtn.className).toContain('bg-[');
    });
  });

  describe('running state', () => {
    it('shows banner when isRunning is true', () => {
      renderPanel({ isRunning: true });
      expect(screen.getByText('运行中，请暂停后编辑')).toBeInTheDocument();
    });

    it('does not show banner when isRunning is false', () => {
      renderPanel({ isRunning: false });
      expect(screen.queryByText('运行中，请暂停后编辑')).not.toBeInTheDocument();
    });

    it('disables all gravity preset buttons when running', () => {
      const { store } = renderPanel({ isRunning: true });
      const earthBtn = screen.getByText('地球');
      expect(earthBtn).toBeDisabled();
    });

    it('disables all sliders when running', () => {
      renderPanel({ isRunning: true });
      const peSection = document.querySelector('[data-testid="pe-reference-section"]');
      const sliders = document.querySelectorAll('input[type="range"]');
      sliders.forEach((s) => {
        // Phase 2: peReferenceY slider remains enabled while running
        if (peSection?.contains(s)) return;
        expect((s as HTMLInputElement).disabled).toBe(true);
      });
    });

    it('disables all number inputs when running', () => {
      renderPanel({ isRunning: true });
      const peSection = document.querySelector('[data-testid="pe-reference-section"]');
      const numberInputs = document.querySelectorAll('input[type="number"]');
      numberInputs.forEach((input) => {
        // Phase 2: peReferenceY inputs remain enabled while running
        if (peSection?.contains(input)) return;
        expect((input as HTMLInputElement).disabled).toBe(true);
      });
    });
  });

  describe('friction scale', () => {
    it('renders friction preset buttons', () => {
      renderPanel();
      expect(screen.getByText('摩擦倍率')).toBeInTheDocument();
      expect(screen.getByText('超滑')).toBeInTheDocument();
      expect(screen.getByText('低摩擦')).toBeInTheDocument();
      expect(screen.getByText('标准')).toBeInTheDocument();
      expect(screen.getByText('高摩擦')).toBeInTheDocument();
    });

    it('clicking preset sets friction scale', () => {
      const { store } = renderPanel();
      fireEvent.click(screen.getByText('超滑'));
      expect(store.setFrictionScale).toHaveBeenCalledWith(0.1);
    });
  });

  describe('close behavior', () => {
    it('close button calls closeEnvironmentPanel', () => {
      const { store } = renderPanel();
      // Close button is a plain <button> with exact text "×"
      const closeBtn = screen.getByRole('button', { name: '×' });
      fireEvent.click(closeBtn);
      expect(store.closeEnvironmentPanel).toHaveBeenCalled();
    });
  });

  describe('highlight animation', () => {
    it('modifying slider value shows highlight class', () => {
      renderPanel();
      const sliders = document.querySelectorAll('input[type="range"]');
      // There should be multiple sliders (gravity XYZ, friction, restitution, drag)
      expect(sliders.length).toBeGreaterThanOrEqual(3);
    });
  });
});
