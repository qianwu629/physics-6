import { describe, it, expect, beforeEach } from 'vitest';
import { useSnapshotStore, type Snapshot } from '../snapshotSlice';
import type { EnvironmentState } from '../simulationSlice';
import type { Entity } from '../../ecs/types';

/**
 * snapshotSlice 单元测试 — 10 个 behavior cases
 */
describe('snapshotSlice', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSnapshotStore.setState({ slots: Array(5).fill(null) as (Snapshot | null)[] });
    localStorage.clear();
  });

  // ── Helpers ──

  function createMockEntity(id: string, name: string): Entity {
    return { id, name, components: new Map() };
  }

  function createMockStore(entities?: Map<string, Entity>) {
    return {
      entities: entities ?? new Map<string, Entity>(),
      environment: {
        gravity: [0, -9.81, 0] as [number, number, number],
        frictionScale: 1.0,
        restitutionScale: 1.0,
        drag: 0.1,
      } as EnvironmentState,
    };
  }

  // ── Tests ──

  describe('initial state', () => {
    it('Test 1: slots is Array(5).fill(null)', () => {
      const { slots } = useSnapshotStore.getState();
      expect(slots).toHaveLength(5);
      for (const slot of slots) {
        expect(slot).toBeNull();
      }
    });
  });

  describe('saveSnapshot', () => {
    it('Test 2: saveSnapshot fills slot with correct name and ISO 8601 date', () => {
      const mockStore = createMockStore();
      const result = useSnapshotStore.getState().saveSnapshot(0, '测试场景', mockStore);

      expect(result.success).toBe(true);
      const slot = useSnapshotStore.getState().slots[0];
      expect(slot).not.toBeNull();
      expect(slot!.name).toBe('测试场景');
      expect(() => new Date(slot!.createdAt)).not.toThrow();
      expect(slot!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('Test 3: saveSnapshot records entityCount from store.entities.size', () => {
      const entities = new Map<string, Entity>();
      entities.set('e1', createMockEntity('e1', 'Ball'));
      entities.set('e2', createMockEntity('e2', 'Box'));
      const mockStore = createMockStore(entities);

      const result = useSnapshotStore.getState().saveSnapshot(0, '多实体', mockStore);
      expect(result.success).toBe(true);
      expect(useSnapshotStore.getState().slots[0]!.entityCount).toBe(2);
    });
  });

  describe('loadSnapshot', () => {
    it('Test 4: loadSnapshot returns the complete saved Snapshot', () => {
      const entities = new Map<string, Entity>();
      entities.set('e1', createMockEntity('e1', 'Ball'));
      const mockStore = createMockStore(entities);

      useSnapshotStore.getState().saveSnapshot(0, '测试', mockStore);
      const loaded = useSnapshotStore.getState().loadSnapshot(0);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('测试');
      expect(loaded!.entityCount).toBe(1);
      expect(loaded!.data).toBeDefined();
      expect(loaded!.data.environment.gravity).toEqual([0, -9.81, 0]);
    });
  });

  describe('renameSnapshot', () => {
    it('Test 5: renameSnapshot updates name while preserving other fields', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '旧名称', mockStore);
      const before = useSnapshotStore.getState().slots[0]!;

      const result = useSnapshotStore.getState().renameSnapshot(0, '新名称');
      expect(result.success).toBe(true);

      const after = useSnapshotStore.getState().slots[0]!;
      expect(after.name).toBe('新名称');
      expect(after.entityCount).toBe(before.entityCount);
      expect(after.createdAt).toBe(before.createdAt);
    });

    it('Test 6: renameSnapshot on empty slot is safe no-op', () => {
      const stateBefore = [...useSnapshotStore.getState().slots];

      const result = useSnapshotStore.getState().renameSnapshot(0, '新名称');
      expect(result.success).toBe(false);
      expect(useSnapshotStore.getState().slots).toEqual(stateBefore);
    });
  });

  describe('deleteSnapshot', () => {
    it('Test 7: deleteSnapshot sets slot back to null', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '删除测试', mockStore);
      expect(useSnapshotStore.getState().slots[0]).not.toBeNull();

      useSnapshotStore.getState().deleteSnapshot(0);
      expect(useSnapshotStore.getState().slots[0]).toBeNull();
    });
  });

  describe('duplicate name detection', () => {
    it('Test 8: saveSnapshot rejects duplicate name across slots', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '同名快照', mockStore);

      const result = useSnapshotStore.getState().saveSnapshot(1, '同名快照', mockStore);
      expect(result.success).toBe(false);
      expect(result.error).toBe('名称已被使用');
    });

    it('isNameDuplicate returns true for existing name', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '存在', mockStore);
      expect(useSnapshotStore.getState().isNameDuplicate('存在')).toBe(true);
      expect(useSnapshotStore.getState().isNameDuplicate('不存在')).toBe(false);
    });

    it('isNameDuplicate with excludeIndex ignores that slot (for rename)', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '存在', mockStore);
      expect(useSnapshotStore.getState().isNameDuplicate('存在', 0)).toBe(false);
    });
  });

  describe('persist configuration', () => {
    it('Test 9: persist stores data under "physis-snapshots" key', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '持久化测试', mockStore);

      const raw = localStorage.getItem('physis-snapshots');
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed.state.slots).toBeDefined();
      expect(parsed.state.slots).toHaveLength(5);
      expect(parsed.state.slots[0]).not.toBeNull();
      expect(parsed.state.slots[0].name).toBe('持久化测试');
    });

    it('Test 10: persist stores only data (no action functions)', () => {
      const mockStore = createMockStore();
      useSnapshotStore.getState().saveSnapshot(0, '函数过滤', mockStore);

      const raw = localStorage.getItem('physis-snapshots');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);

      const slot0 = parsed.state.slots[0];
      expect(typeof slot0).not.toBe('function');
      expect(parsed.state.saveSnapshot).toBeUndefined();
      expect(parsed.state.loadSnapshot).toBeUndefined();
      expect(parsed.state.deleteSnapshot).toBeUndefined();
    });
  });
});
