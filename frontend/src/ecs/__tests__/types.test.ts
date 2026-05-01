import { describe, it, expect } from 'vitest';
import type {
  Entity,
  ComponentType,
  Component,
  TransformComponent,
  RigidBodyComponent,
  ColliderComponent,
  VelocityComponent,
  MaterialComponent,
  AnyComponent,
  RigidBodyKind,
  ColliderShape,
  ColliderParams,
} from '../types';

describe('ECS Component Types', () => {
  it('TransformComponent has required fields', () => {
    const t: TransformComponent = {
      type: 'transform',
      position: [0, 5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(t.type).toBe('transform');
    expect(t.position).toEqual([0, 5, 0]);
    expect(t.rotation).toEqual([0, 0, 0]);
    expect(t.scale).toEqual([1, 1, 1]);
  });

  it('RigidBodyComponent has required fields', () => {
    const rb: RigidBodyComponent = {
      type: 'rigidBody',
      kind: 'dynamic',
      mass: 1.0,
      restitution: 0.5,
      friction: 0.3,
    };
    expect(rb.type).toBe('rigidBody');
    expect(rb.kind).toBe('dynamic');
    expect(rb.mass).toBe(1.0);
    expect(rb.restitution).toBe(0.5);
    expect(rb.friction).toBe(0.3);
  });

  it('ColliderComponent with sphere params', () => {
    const c: ColliderComponent = {
      type: 'collider',
      shape: 'sphere',
      params: { radius: 1.0 },
    };
    expect(c.shape).toBe('sphere');
    expect(c.params.radius).toBe(1.0);
  });

  it('ColliderComponent with cuboid params', () => {
    const c: ColliderComponent = {
      type: 'collider',
      shape: 'cuboid',
      params: { halfWidth: 1.0, halfHeight: 0.5, halfDepth: 2.0 },
    };
    expect(c.shape).toBe('cuboid');
    expect(c.params.halfWidth).toBe(1.0);
    expect(c.params.halfDepth).toBe(2.0);
  });

  it('VelocityComponent has required fields', () => {
    const v: VelocityComponent = {
      type: 'velocity',
      linearVelocity: [1, 0, 0],
      angularVelocity: [0, 0.5, 0],
    };
    expect(v.type).toBe('velocity');
    expect(v.linearVelocity).toEqual([1, 0, 0]);
    expect(v.angularVelocity).toEqual([0, 0.5, 0]);
  });

  it('MaterialComponent has required fields', () => {
    const m: MaterialComponent = {
      type: 'material',
      color: '#ff0000',
      roughness: 0.6,
      metalness: 0.1,
    };
    expect(m.type).toBe('material');
    expect(m.color).toBe('#ff0000');
    expect(m.roughness).toBe(0.6);
    expect(m.metalness).toBe(0.1);
  });

  it('Entity interface has id, name, and components Map', () => {
    const transformComp: TransformComponent = {
      type: 'transform',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    const e: Entity = {
      id: 'test-1',
      name: 'Test Entity',
      components: new Map<ComponentType, Component>(),
    };
    e.components.set('transform', transformComp);
    expect(e.id).toBe('test-1');
    expect(e.name).toBe('Test Entity');
    expect(e.components.size).toBe(1);
  });
});
