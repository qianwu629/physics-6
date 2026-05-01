import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createEntitySlice, MAX_ENTITIES, type EntitySlice } from '../entitySlice';
import { createSphereEntity, createBoxEntity, resetEntityCounter } from '../../ecs/Entity';
import type { Entity } from '../../ecs/types';

/** 独立 test store — 仅含 entitySlice */
function createTestStore() {
  return create<EntitySlice>()((...args) => ({
    ...createEntitySlice(...args),
  }));
}

describe('EntitySlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    resetEntityCounter();
    store = createTestStore();
  });

  const makeSphere = (_n: number = 1): Entity =>
    createSphereEntity(1.0, 1.0, 0.5, 0.3, '#ff0000');

  it('addEntity adds entity and increments size', () => {
    const entity = makeSphere();
    const result = store.getState().addEntity(entity);
    expect(result).toBe(true);
    expect(store.getState().entities.size).toBe(1);
    expect(store.getState().entities.get(entity.id)).toEqual(entity);
  });

  it('addEntity rejects when at MAX_ENTITIES limit', () => {
    // Fill to capacity — 不要每轮 resetEntityCounter()，否则所有实体 ID 相同被 Map 覆盖
    for (let i = 0; i < MAX_ENTITIES; i++) {
      const result = store.getState().addEntity(createSphereEntity(1.0, 1.0, 0.5, 0.3));
      expect(result).toBe(true);
    }
    expect(store.getState().entities.size).toBe(MAX_ENTITIES);
    // 第 51 个被拒绝
    const rejected = store.getState().addEntity(makeSphere());
    expect(rejected).toBe(false);
    expect(store.getState().entities.size).toBe(MAX_ENTITIES);
  });

  it('removeEntity deletes entity and clears selection if selected', () => {
    const entity = makeSphere();
    store.getState().addEntity(entity);
    store.getState().selectEntity(entity.id);
    expect(store.getState().selectedEntityId).toBe(entity.id);

    store.getState().removeEntity(entity.id);
    expect(store.getState().entities.size).toBe(0);
    expect(store.getState().selectedEntityId).toBeNull();
  });

  it('removeEntity does not clear selection if different entity selected', () => {
    const e1 = createSphereEntity(1.0, 1.0, 0.5, 0.3, '#ff0000');
    const e2 = createBoxEntity(0.5, 0.5, 0.5, 1.0, 0.5, 0.3, '#00ff00');
    store.getState().addEntity(e1);
    store.getState().addEntity(e2);
    store.getState().selectEntity(e1.id);

    store.getState().removeEntity(e2.id);
    expect(store.getState().selectedEntityId).toBe(e1.id); // 未清除
  });

  it('selectEntity sets and clears selection', () => {
    store.getState().selectEntity('abc-123');
    expect(store.getState().selectedEntityId).toBe('abc-123');
    store.getState().selectEntity(null);
    expect(store.getState().selectedEntityId).toBeNull();
  });

  it('updateComponent performs partial update', () => {
    const entity = makeSphere();
    store.getState().addEntity(entity);

    store.getState().updateComponent(entity.id, 'rigidBody', { mass: 5.0 });
    const updated = store.getState().entities.get(entity.id)!;
    const rb = updated.components.get('rigidBody')!;
    expect(rb.mass).toBe(5.0);
    expect(rb.restitution).toBe(0.5);  // 保留未修改字段
  });

  it('updateComponent on non-existent entity is no-op', () => {
    const initialState = store.getState();
    store.getState().updateComponent('nonexistent', 'transform', { position: [99, 99, 99] });
    // 状态引用应不变（same state — no mutation）
    expect(store.getState().entities).toBe(initialState.entities);
  });

  it('resetEntities clears everything', () => {
    const entity = makeSphere();
    store.getState().addEntity(entity);
    store.getState().selectEntity(entity.id);

    store.getState().resetEntities();
    expect(store.getState().entities.size).toBe(0);
    expect(store.getState().selectedEntityId).toBeNull();
  });

  it('mutations create new Map reference (immutable update)', () => {
    const entity = makeSphere();
    store.getState().addEntity(entity);
    const mapAfterAdd = store.getState().entities;

    store.getState().removeEntity(entity.id);
    const mapAfterRemove = store.getState().entities;

    // 引用应改变（新 Map 实例）
    expect(mapAfterRemove).not.toBe(mapAfterAdd);
  });
});
