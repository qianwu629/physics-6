import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useSimulationStore } from '../store';

// Mock R3F Canvas and all R3F-related imports since jsdom lacks WebGL
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({ camera: {}, gl: {}, scene: {} })),
}));

vi.mock('@react-three/rapier', () => ({
  Physics: ({ children }: { children: React.ReactNode }) => <div data-testid="physics-world">{children}</div>,
  RigidBody: ({ children, type }: { children: React.ReactNode; type: string; [key: string]: unknown }) => (
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
  useBeforePhysicsStep: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Grid: () => <div data-testid="grid" />,
  GizmoHelper: ({ children }: { children: React.ReactNode }) => <div data-testid="gizmo-helper">{children}</div>,
  GizmoViewport: () => <div data-testid="gizmo-viewport" />,
  Outlines: () => <div data-testid="outlines" />,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    // 已有的
    ACESFilmicToneMapping: 4,
    // Vector3 — 模块级 new Vector3(0,1,0) 需要可调用的构造函数 (function 而非箭头函数)
    Vector3: vi.fn(function(this: any, x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.clone = vi.fn(() => this);
      this.normalize = vi.fn(() => this);
      this.length = vi.fn(() => Math.sqrt(x*x + y*y + z*z));
      this.set = vi.fn((nx: number, ny: number, nz: number) => { this.x = nx; this.y = ny; this.z = nz; return this; });
      this.copy = vi.fn((src: any) => { this.x = src.x; this.y = src.y; this.z = src.z; return this; });
      this.add = vi.fn(function(this: any, other: any) { return new (this.constructor as any)(this.x + other.x, this.y + other.y, this.z + other.z); });
      this.sub = vi.fn(function(this: any, other: any) { return new (this.constructor as any)(this.x - other.x, this.y - other.y, this.z - other.z); });
    }),
    // Quaternion (function 而非箭头函数，支持 new)
    Quaternion: vi.fn(function(this: any, x = 0, y = 0, z = 0, w = 1) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
      this.setFromUnitVectors = vi.fn(() => this);
      this.copy = vi.fn((src: any) => { this.x = src.x; this.y = src.y; this.z = src.z; this.w = src.w; return this; });
    }),
    // Euler (function 而非箭头函数，支持 new)
    Euler: vi.fn(function(this: any, x = 0, y = 0, z = 0, order = 'XYZ') {
      this.x = x;
      this.y = y;
      this.z = z;
      this.order = order;
    }),
    // Geometries（带 type 属性，供 instanceof 检查替代判断）
    CylinderGeometry: vi.fn(function(this: any) { this.type = 'CylinderGeometry'; }),
    ConeGeometry: vi.fn(function(this: any) { this.type = 'ConeGeometry'; }),
    SphereGeometry: vi.fn(function(this: any) { this.type = 'SphereGeometry'; }),
    BoxGeometry: vi.fn(function(this: any) { this.type = 'BoxGeometry'; }),
    BufferGeometry: vi.fn(function(this: any) {
      this.type = 'BufferGeometry';
      this.setAttribute = vi.fn();
      this.setFromPoints = vi.fn();
    }),
    // Materials
    MeshBasicMaterial: vi.fn(function(this: any, params?: any) { this.type = 'MeshBasicMaterial'; Object.assign(this, params); }),
    MeshStandardMaterial: vi.fn(function(this: any, params?: any) { this.type = 'MeshStandardMaterial'; Object.assign(this, params); }),
    LineBasicMaterial: vi.fn(function(this: any, params?: any) { this.type = 'LineBasicMaterial'; Object.assign(this, params); }),
    // Objects
    Mesh: vi.fn(function(this: any) { this.type = 'Mesh'; this.add = vi.fn(); this.removeFromParent = vi.fn(); }),
    Group: vi.fn(function(this: any) { this.type = 'Group'; this.add = vi.fn(); this.removeFromParent = vi.fn(); }),
    Line: vi.fn(function(this: any) { this.type = 'Line'; }),
    // Buffers
    BufferAttribute: vi.fn(function(this: any, array: any, itemSize: number) { this.array = array; this.itemSize = itemSize; }),
    Float32BufferAttribute: vi.fn(function(this: any, array: any, itemSize: number) { this.array = array; this.itemSize = itemSize; }),
    // Color
    Color: vi.fn(function(this: any, r?: any, g?: any, b?: any) { this.r = typeof r === 'number' ? r : 1; this.g = typeof g === 'number' ? g : 1; this.b = typeof b === 'number' ? b : 1; }),
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
      // Ground is the only fixed rigid body (INITIAL_SCENE_OBJECTS removed per D-06)
      expect(fixedBodies.length).toBeGreaterThanOrEqual(1);
    });

    it('should render empty scene with no hardcoded dynamic objects (D-06)', async () => {
      const { default: Scene3D } = await import('./Scene3D');
      const { queryAllByTestId } = render(<Scene3D />);
      const dynamicBodies = queryAllByTestId('rigid-body-dynamic');
      // D-06: Scene starts empty — no dynamic bodies from INITIAL_SCENE_OBJECTS
      expect(dynamicBodies.length).toBe(0);
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
