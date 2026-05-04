/**
 * Phase 5 Task 2 — EntityRenderer 运行时属性同步单元测试 (REN-03)
 *
 * 验证 EntityRenderer.tsx 中的 useEffect 通过 Rapier imperative API
 * 同步 mass / restitution / friction / drag / 环境倍率到底层物理引擎。
 *
 * 策略：
 * - mock @react-three/rapier RigidBody/Collider，附加 vi.fn() spy 到 ref.current
 * - mock @react-three/drei Outlines（避免 Three.js 上下文需求）
 * - mock 顶层 R3F 元素（mesh / sphereGeometry / meshStandardMaterial 等）使其
 *   在非 Canvas 环境下不抛错
 * - mock useSimulationStore selector，返回受测试控制的 environment 对象
 *
 * 不依赖真实 Rapier WASM；纯契约测试（断言"调用了什么 + 参数是什么"）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';

// ── Spies attached to mocked RigidBody ref.current ────────────────────────
const mockColliderSpies = {
  setRestitution: vi.fn(),
  setFriction: vi.fn(),
};

const mockRigidBodySpies = {
  setAdditionalMass: vi.fn(),
  setLinearDamping: vi.fn(),
  setAngularDamping: vi.fn(),
  numColliders: vi.fn(() => 1),
  collider: vi.fn(() => mockColliderSpies),
};

// 控制 ref 是否被附加（用于 Test F）
let attachRefToCurrent = true;

// ── Mock @react-three/rapier ───────────────────────────────────────────────
vi.mock('@react-three/rapier', () => ({
  RigidBody: ({ children, ...props }: any) => {
    // React 19 forwards ref via the `ref` prop.
    // Rapier's actual <RigidBody> uses forwardRef; we simulate that here by
    // synchronously assigning the spies to whatever ref the consumer passed.
    const ref = (props as any).ref;
    if (ref && attachRefToCurrent) {
      if (typeof ref === 'function') ref(mockRigidBodySpies);
      else ref.current = mockRigidBodySpies;
    }
    return React.createElement(React.Fragment, null, children);
  },
  BallCollider: () => null,
  CuboidCollider: () => null,
  CylinderCollider: () => null,
}));

// ── Mock @react-three/drei Outlines (avoid Three.js context need) ─────────
vi.mock('@react-three/drei', () => ({
  Outlines: () => null,
}));

// ── Mock contactForceStore (no-op) ────────────────────────────────────────
vi.mock('../components/contactForceStore', () => ({
  setContactForce: vi.fn(),
}));

// ── Mock RigidBodyRefContext ──────────────────────────────────────────────
vi.mock('../components/RigidBodyRefContext', () => ({
  useRigidBodyRefRegistry: () => ({
    register: vi.fn(),
    unregister: vi.fn(),
    getRef: () => undefined,
  }),
}));

// ── Mock useSimulationStore — controllable environment ────────────────────
let mockEnv = { frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1 };
vi.mock('../store', () => ({
  useSimulationStore: (selector: any) => selector({ environment: mockEnv }),
}));

// ── Mock R3F intrinsic JSX elements (mesh / geometry / material) ──────────
// EntityRenderer renders <mesh>/<sphereGeometry>/<meshStandardMaterial> which
// require an R3F <Canvas> ancestor at runtime. In a JSDOM unit test these are
// unknown HTML elements — React 19 will render them as custom elements which
// is fine (no runtime crash, only a console warning). We silence the warning
// to keep test output clean; useEffect behaviour is unaffected.
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('is using incorrect casing') ||
      msg.includes('The tag <') ||
      msg.includes('unrecognized in this browser') ||
      msg.includes('does not recognize the `castShadow`') ||
      msg.includes('does not recognize the `receiveShadow`'))
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// ── Imports after mocks (vi.mock is hoisted but explicit ordering helps) ──
import EntityRenderer from '../components/EntityRenderer';
import type { Entity, RigidBodyComponent } from '../ecs/types';

function makeEntity(
  overrides?: Partial<{ mass: number; restitution: number; friction: number }>,
): Entity {
  const components = new Map<any, any>();
  components.set('transform', {
    type: 'transform',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });
  const rb: RigidBodyComponent = {
    type: 'rigidBody',
    kind: 'dynamic',
    mass: overrides?.mass ?? 1,
    restitution: overrides?.restitution ?? 0.5,
    friction: overrides?.friction ?? 0.5,
  };
  components.set('rigidBody', rb);
  components.set('collider', {
    type: 'collider',
    shape: 'sphere',
    params: { radius: 1 },
  });
  components.set('material', {
    type: 'material',
    color: '#ffffff',
    roughness: 0.6,
    metalness: 0.1,
  });
  return { id: 'e1', name: 'test', components };
}

describe('EntityRenderer runtime prop sync (REN-03 / Phase 5)', () => {
  beforeEach(() => {
    Object.values(mockRigidBodySpies).forEach((fn: any) => {
      if (typeof fn?.mockClear === 'function') fn.mockClear();
    });
    Object.values(mockColliderSpies).forEach((fn: any) => fn.mockClear());
    mockEnv = { frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1 };
    attachRefToCurrent = true;
    // numColliders default returns 1 (re-arm after mockClear)
    mockRigidBodySpies.numColliders.mockImplementation(() => 1);
    mockRigidBodySpies.collider.mockImplementation(() => mockColliderSpies);
  });

  it('Test A: 初次挂载触发所有 Rapier setters', () => {
    render(
      <EntityRenderer
        entity={makeEntity()}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(mockRigidBodySpies.setAdditionalMass).toHaveBeenCalled();
    expect(mockRigidBodySpies.setLinearDamping).toHaveBeenCalled();
    expect(mockColliderSpies.setRestitution).toHaveBeenCalled();
    expect(mockColliderSpies.setFriction).toHaveBeenCalled();
  });

  it('Test B: restitution 0.5 → 0.95 触发 setRestitution 重新调用', () => {
    const { rerender } = render(
      <EntityRenderer
        entity={makeEntity({ restitution: 0.5 })}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const beforeCount = mockColliderSpies.setRestitution.mock.calls.length;
    rerender(
      <EntityRenderer
        entity={makeEntity({ restitution: 0.95 })}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(mockColliderSpies.setRestitution.mock.calls.length).toBeGreaterThan(
      beforeCount,
    );
    const last = mockColliderSpies.setRestitution.mock.calls.at(-1)?.[0];
    expect(last).toBeCloseTo(Math.min(0.95 * 1.0, 1.0), 5);
  });

  it('Test C: mass 1 → 5 触发 setAdditionalMass(5, true)', () => {
    const { rerender } = render(
      <EntityRenderer
        entity={makeEntity({ mass: 1 })}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const beforeCount = mockRigidBodySpies.setAdditionalMass.mock.calls.length;
    rerender(
      <EntityRenderer
        entity={makeEntity({ mass: 5 })}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(
      mockRigidBodySpies.setAdditionalMass.mock.calls.length,
    ).toBeGreaterThan(beforeCount);
    const lastCall = mockRigidBodySpies.setAdditionalMass.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(5);
    expect(lastCall?.[1]).toBe(true);
  });

  it('Test D: friction 0.5 → 0.1 触发 setFriction 参数 ≈ 0.1', () => {
    const { rerender } = render(
      <EntityRenderer
        entity={makeEntity({ friction: 0.5 })}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const beforeCount = mockColliderSpies.setFriction.mock.calls.length;
    rerender(
      <EntityRenderer
        entity={makeEntity({ friction: 0.1 })}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(mockColliderSpies.setFriction.mock.calls.length).toBeGreaterThan(
      beforeCount,
    );
    const last = mockColliderSpies.setFriction.mock.calls.at(-1)?.[0];
    expect(last).toBeCloseTo(Math.min(0.1 * 1.0, 2.0), 5);
  });

  it('Test E: environment.drag 0.1 → 0.5 触发 setLinearDamping(0.5)', () => {
    const entity = makeEntity();
    const { rerender } = render(
      <EntityRenderer entity={entity} isSelected={false} onSelect={() => {}} />,
    );
    const beforeCount = mockRigidBodySpies.setLinearDamping.mock.calls.length;
    // 切换 environment 并强制重渲染 — 由于 useSimulationStore 是 mock，
    // 我们直接改 mockEnv 然后 rerender 让 selector 取到新值。
    mockEnv = { ...mockEnv, drag: 0.5 };
    rerender(
      <EntityRenderer entity={entity} isSelected={false} onSelect={() => {}} />,
    );
    expect(
      mockRigidBodySpies.setLinearDamping.mock.calls.length,
    ).toBeGreaterThan(beforeCount);
    const last = mockRigidBodySpies.setLinearDamping.mock.calls.at(-1)?.[0];
    expect(last).toBe(0.5);
  });

  it('Test F: ref.current 为 null 时 useEffect 不抛错且不调用 setter', () => {
    attachRefToCurrent = false;
    expect(() => {
      render(
        <EntityRenderer
          entity={makeEntity()}
          isSelected={false}
          onSelect={() => {}}
        />,
      );
    }).not.toThrow();
    // 因 ref.current === null，所有 setter 不应被触发
    expect(mockRigidBodySpies.setAdditionalMass).not.toHaveBeenCalled();
    expect(mockRigidBodySpies.setLinearDamping).not.toHaveBeenCalled();
    expect(mockColliderSpies.setRestitution).not.toHaveBeenCalled();
    expect(mockColliderSpies.setFriction).not.toHaveBeenCalled();
  });
});
