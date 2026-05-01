import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEntity, createSphereEntity, createBoxEntity,
  createCylinderEntity, createSlopeEntity, resetEntityCounter,
} from '../Entity';
import type { TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent } from '../types';

describe('ECS Entity Factory', () => {
  beforeEach(() => resetEntityCounter());

  it('createEntity assembles components into a Map', () => {
    const transform: TransformComponent = { type: 'transform', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] };
    const rigidBody: RigidBodyComponent = { type: 'rigidBody', kind: 'dynamic', mass: 1.0, restitution: 0.5, friction: 0.3 };
    const entity = createEntity('test-1', 'Test', [transform, rigidBody]);
    expect(entity.id).toBe('test-1');
    expect(entity.name).toBe('Test');
    expect(entity.components.size).toBe(2);
    expect(entity.components.get('transform')).toEqual(transform);
    expect(entity.components.get('rigidBody')).toEqual(rigidBody);
  });

  it('createSphereEntity produces valid sphere with 5 components', () => {
    const e = createSphereEntity(1.0, 1.0, 0.5, 0.3, '#ff0000');
    expect(e.id).toBe('sphere-1');
    expect(e.name).toBe('球体-1');
    expect(e.components.size).toBe(5);
    const collider = e.components.get('collider') as ColliderComponent;
    expect(collider.shape).toBe('sphere');
    expect(collider.params.radius).toBe(1.0);
    const material = e.components.get('material') as MaterialComponent;
    expect(material.color).toBe('#ff0000');
  });

  it('createBoxEntity produces valid cuboid with correct params', () => {
    const e = createBoxEntity(1.0, 0.5, 2.0, 1.0, 0.5, 0.3);
    expect(e.id).toBe('box-1');
    const collider = e.components.get('collider') as ColliderComponent;
    expect(collider.shape).toBe('cuboid');
    expect(collider.params).toEqual({ halfWidth: 1.0, halfHeight: 0.5, halfDepth: 2.0 });
  });

  it('createCylinderEntity produces valid cylinder', () => {
    const e = createCylinderEntity(1.0, 0.5, 1.0, 0.5, 0.3);
    const collider = e.components.get('collider') as ColliderComponent;
    expect(collider.shape).toBe('cylinder');
    expect(collider.params).toEqual({ halfHeight: 1.0, radius: 0.5 });
  });

  it('createSlopeEntity produces fixed rigidBody with Z rotation', () => {
    const e = createSlopeEntity(4.0, 2.0, 0.5);
    const rigidBody = e.components.get('rigidBody') as RigidBodyComponent;
    expect(rigidBody.kind).toBe('fixed');
    const transform = e.components.get('transform') as TransformComponent;
    expect(transform.rotation[2]).toBeCloseTo(Math.PI / 6);
    const collider = e.components.get('collider') as ColliderComponent;
    expect(collider.shape).toBe('cuboid');
    expect(collider.params.halfWidth).toBe(4.0);
  });

  it('entities have independent component maps', () => {
    const e1 = createSphereEntity(1.0, 1.0, 0.5, 0.3, '#ff0000');
    const e2 = createBoxEntity(0.5, 0.5, 0.5, 2.0, 0.3, 0.1, '#00ff00');
    const t1 = e1.components.get('transform') as TransformComponent;
    // Modify e1's position should not affect e2
    t1.position[1] = 999;
    expect((e2.components.get('transform') as TransformComponent).position[1]).toBe(5);
  });

  it('counter increments and never reuses numbers', () => {
    const e1 = createSphereEntity(1.0, 1.0, 0.5, 0.3);
    const e2 = createSphereEntity(1.0, 1.0, 0.5, 0.3);
    const e3 = createBoxEntity(0.5, 0.5, 0.5, 1.0, 0.5, 0.3);
    expect(e1.id).toBe('sphere-1');
    expect(e2.id).toBe('sphere-2');
    expect(e3.id).toBe('box-3');   // Global counter, never reuse
  });

  it('optional velocity defaults to [0,0,0]', () => {
    const e = createSphereEntity(1.0, 1.0, 0.5, 0.3);
    const vel = e.components.get('velocity') as VelocityComponent;
    expect(vel.linearVelocity).toEqual([0, 0, 0]);
    expect(vel.angularVelocity).toEqual([0, 0, 0]);
  });

  it('custom position overrides default (0,5,0)', () => {
    const e = createBoxEntity(1.0, 1.0, 1.0, 1.0, 0.5, 0.3, undefined, undefined, [3, 8, -1]);
    const t = e.components.get('transform') as TransformComponent;
    expect(t.position).toEqual([3, 8, -1]);
  });
});
