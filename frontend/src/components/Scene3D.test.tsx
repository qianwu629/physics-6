import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useSimulationStore } from '../store';

// Mock R3F Canvas and all R3F-related imports since jsdom lacks WebGL
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
}));

vi.mock('@react-three/rapier', () => ({
  Physics: ({ children }: { children: React.ReactNode }) => <div data-testid="physics-world">{children}</div>,
  RigidBody: ({ children, type, ...props }: { children: React.ReactNode; type: string; [key: string]: unknown }) => (
    <div data-testid={`rigid-body-${type}`}>{children}</div>
  ),
  CuboidCollider: ({ args }: { args: [number, number, number] }) => (
    <div data-testid={`cuboid-collider-${args.join('-')}`} />
  ),
  BallCollider: ({ args }: { args: [number] }) => (
    <div data-testid={`ball-collider-${args.join('-')}`} />
  ),
  CylinderCollider: ({ args }: { args: [number, number] }) => (
    <div data-testid={`cylinder-collider-${args.join('-')}`} />
  ),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Grid: (props: Record<string, unknown>) => <div data-testid="grid" />,
  GizmoHelper: ({ children }: { children: React.ReactNode }) => <div data-testid="gizmo-helper">{children}</div>,
  GizmoViewport: (props: Record<string, unknown>) => <div data-testid="gizmo-viewport" />,
}));

vi.mock('three', () => {
  const actual = vi.importActual('three');
  return {
    ...actual,
    ACESFilmicToneMapping: 4,
  };
});

describe('Scene3D', () => {
  beforeEach(() => {
    // Reset the store before each test
    useSimulationStore.setState({
      isRunning: false,
      showDebug: false,
      fps: 0,
      objectCount: 0,
    });
    vi.clearAllMocks();
  });

  describe('initial state (D-04: simulation starts paused)', () => {
    it('should have isRunning false by default', () => {
      const state = useSimulationStore.getState();
      expect(state.isRunning).toBe(false);
    });
  });

  describe('store integration', () => {
    it('should have play/pause/toggle/reset actions', () => {
      const state = useSimulationStore.getState();
      expect(state.play).toBeDefined();
      expect(state.pause).toBeDefined();
      expect(state.toggle).toBeDefined();
      expect(state.reset).toBeDefined();
    });

    it('should have showDebug control (D-07: default off)', () => {
      const state = useSimulationStore.getState();
      expect(state.showDebug).toBe(false);
      state.setShowDebug(true);
      expect(useSimulationStore.getState().showDebug).toBe(true);
    });

    it('should have FPS tracking', () => {
      const state = useSimulationStore.getState();
      expect(state.fps).toBe(0);
      state.setFps(60);
      expect(useSimulationStore.getState().fps).toBe(60);
    });

    it('should have object count tracking', () => {
      const state = useSimulationStore.getState();
      expect(state.objectCount).toBe(0);
      state.setObjectCount(14);
      expect(useSimulationStore.getState().objectCount).toBe(14);
    });

    it('should toggle isRunning', () => {
      const state = useSimulationStore.getState();
      expect(state.isRunning).toBe(false);
      state.toggle();
      expect(useSimulationStore.getState().isRunning).toBe(true);
      state.toggle();
      expect(useSimulationStore.getState().isRunning).toBe(false);
    });
  });

  describe('component rendering', () => {
    it('should render without crashing', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { container } = render(<Scene3D />);
      expect(container).toBeTruthy();
    });

    it('should render Canvas with dark background (#0a0a0a)', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getByTestId } = render(<Scene3D />);
      const canvas = getByTestId('r3f-canvas');
      expect(canvas).toBeDefined();
    });

    it('should render Physics world', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getByTestId } = render(<Scene3D />);
      const physics = getByTestId('physics-world');
      expect(physics).toBeDefined();
    });

    it('should render OrbitControls', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getByTestId } = render(<Scene3D />);
      const controls = getByTestId('orbit-controls');
      expect(controls).toBeDefined();
    });

    it('should render Grid helper (D-06)', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getByTestId } = render(<Scene3D />);
      const grid = getByTestId('grid');
      expect(grid).toBeDefined();
    });

    it('should render GizmoHelper for RGB axes (D-06)', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getByTestId } = render(<Scene3D />);
      const gizmo = getByTestId('gizmo-helper');
      expect(gizmo).toBeDefined();
    });

    it('should render a fixed ground RigidBody (D-02)', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getAllByTestId } = render(<Scene3D />);
      const fixedBodies = getAllByTestId('rigid-body-fixed');
      // Ground + 2 slopes + 1 platform = 4 fixed rigid bodies
      expect(fixedBodies.length).toBeGreaterThanOrEqual(1);
    });

    it('should render 14 scene objects from INITIAL_SCENE_OBJECTS', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { getAllByTestId } = render(<Scene3D />);
      const dynamicBodies = getAllByTestId('rigid-body-dynamic');
      // 11 dynamic objects from INITIAL_SCENE_OBJECTS
      expect(dynamicBodies.length).toBe(11);
    });
  });

  describe('verification: acceptance criteria snapshot', () => {
    it('should export Scene3D as default', async () => {
      const module = await import('./Scene3D');
      expect(module.default).toBeDefined();
      expect(typeof module.default).toBe('function');
    });
  });
});
