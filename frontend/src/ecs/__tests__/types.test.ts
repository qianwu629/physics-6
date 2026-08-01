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
  ForceFieldComponent,
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
  CurrentSourceComponent,
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
      charge: 0,
    };
    expect(rb.type).toBe('rigidBody');
    expect(rb.kind).toBe('dynamic');
    expect(rb.mass).toBe(1.0);
    expect(rb.restitution).toBe(0.5);
    expect(rb.friction).toBe(0.3);
    expect(rb.charge).toBe(0);
  });

  it('RigidBodyComponent supports non-zero charge', () => {
    const rb: RigidBodyComponent = {
      type: 'rigidBody',
      kind: 'dynamic',
      mass: 1.0,
      restitution: 0.5,
      friction: 0.3,
      charge: 2.5,
    };
    expect(rb.charge).toBe(2.5);
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

describe('ForceFieldComponent — discriminated union (D-03-03)', () => {
  it('UniformFieldComponent has direction + strength', () => {
    const f: UniformFieldComponent = {
      type: 'forceField',
      kind: 'uniform',
      position: [0, 0, 0],
      range: 10,
      direction: [0, 1, 0],
      strength: 5,
    };
    expect(f.type).toBe('forceField');
    expect(f.kind).toBe('uniform');
    expect(f.direction).toEqual([0, 1, 0]);
    expect(f.strength).toBe(5);
  });

  it('GravityFieldComponent has strength + decay', () => {
    const f: GravityFieldComponent = {
      type: 'forceField',
      kind: 'gravity',
      position: [0, 5, 0],
      range: 20,
      strength: 9.81,
      decay: true,
    };
    expect(f.kind).toBe('gravity');
    expect(f.decay).toBe(true);
  });

  it('ElectricFieldComponent has charge + decay', () => {
    const f: ElectricFieldComponent = {
      type: 'forceField',
      kind: 'electric',
      position: [0, 0, 0],
      range: 15,
      charge: -3,
      decay: true,
    };
    expect(f.kind).toBe('electric');
    expect(f.charge).toBe(-3);
  });

  it('MagneticFieldComponent has direction + strength', () => {
    const f: MagneticFieldComponent = {
      type: 'forceField',
      kind: 'magnetic',
      position: [0, 0, 0],
      range: 25,
      direction: [0, 0, 1],
      strength: 1,
    };
    expect(f.kind).toBe('magnetic');
    expect(f.direction).toEqual([0, 0, 1]);
  });

  it('ForceFieldComponent kind acts as a discriminator (type-guard)', () => {
    const fields: ForceFieldComponent[] = [
      { type: 'forceField', kind: 'uniform', position: [0,0,0], range: 5, direction: [0,1,0], strength: 1 },
      { type: 'forceField', kind: 'gravity', position: [0,0,0], range: 5, strength: 1, decay: true },
    ];
    const totalKinds = new Set(fields.map(f => f.kind));
    expect(totalKinds.has('uniform')).toBe(true);
    expect(totalKinds.has('gravity')).toBe(true);
  });

  it('ComponentType union includes forceField', () => {
    const ct: ComponentType = 'forceField';
    expect(ct).toBe('forceField');
  });

  it('CurrentSourceComponent has magnitude + direction (Phase 8)', () => {
    const c: CurrentSourceComponent = {
      type: 'currentSource',
      magnitude: 10,
      direction: [0, 0, 1],
    };
    expect(c.type).toBe('currentSource');
    expect(c.magnitude).toBe(10);
    expect(c.direction).toEqual([0, 0, 1]);
    const ct: ComponentType = 'currentSource';
    expect(ct).toBe('currentSource');
  });
});
