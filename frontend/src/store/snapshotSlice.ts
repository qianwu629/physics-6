import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EnvironmentState } from './simulationSlice';
import type { Entity } from '../ecs/types';

/**
 * 快照状态切片 — Zustand persist 中间件
 *
 * 管理 5 个快照槽位，数据持久化到 localStorage key 'physis-snapshots'。
 * 独立 store（不合并到 useSimulationStore），遵循单 store 职责原则。
 */

// ── Data Types ──

/** 快照中存储的序列化场景数据（Map 已转为 Array/Record，避免 Pitfall #1） */
export interface SnapshotData {
  environment: EnvironmentState;
  entities: Array<{ id: string; name: string; components: Record<string, unknown> }>;
  constraints: Array<{ id: string; name: string; components: Record<string, unknown> }>;
}

/** 单个快照 */
export interface Snapshot {
  name: string;
  createdAt: string;
  entityCount: number;
  data: SnapshotData;
}

// ── Store Interface ──

export interface SnapshotSlice {
  /** 5 个快照槽位（索引 0-4），未使用时为 null */
  slots: (Snapshot | null)[];

  /** 保存快照到指定槽位。内部将 Map<Entity> 转为可序列化的数组 */
  saveSnapshot: (
    slotIndex: number,
    name: string,
    store: { entities: Map<string, Entity>; environment: EnvironmentState }
  ) => { success: boolean; error?: string };

  /** 加载快照数据（由上级协调器执行恢复流程） */
  loadSnapshot: (slotIndex: number) => Snapshot | null;

  /** 重命名快照（空槽位 no-op） */
  renameSnapshot: (slotIndex: number, newName: string) => { success: boolean; error?: string };

  /** 删除快照（槽位设为 null） */
  deleteSnapshot: (slotIndex: number) => void;

  /** 检查名称是否已被占用（可选排除指定槽位，用于覆盖确认流程） */
  isNameDuplicate: (name: string, excludeIndex?: number) => boolean;
}

// ── Store Implementation ──

/**
 * 将 Entity Map 转换为可序列化的实体数组，分离 constraint 实体
 */
function serializeEntities(entities: Map<string, Entity>): {
  regular: SnapshotData['entities'];
  constraints: SnapshotData['constraints'];
} {
  const regular: SnapshotData['entities'] = [];
  const constraints: SnapshotData['constraints'] = [];

  for (const [id, entity] of entities.entries()) {
    const comps: Record<string, unknown> = {};
    for (const [ctype, comp] of entity.components.entries()) {
      comps[ctype] = comp;
    }
    const entry = { id, name: entity.name, components: comps };
    if (entity.components.has('constraint')) {
      constraints.push(entry);
    } else {
      regular.push(entry);
    }
  }

  return { regular, constraints };
}

export const useSnapshotStore = create<SnapshotSlice>()(
  persist(
    (set, get) => ({
      slots: Array(5).fill(null) as (Snapshot | null)[],

      saveSnapshot: (slotIndex, name, store) => {
        // 1. Check duplicate names across all non-empty slots
        const existing = get().slots.some(
          (s, i) => s !== null && i !== slotIndex && s.name === name
        );
        if (existing) {
          return { success: false, error: '名称已被使用' };
        }

        // 2. Serialize entities (Map → Array, Pitfall #1)
        const { regular, constraints } = serializeEntities(store.entities);

        // 3. Build snapshot object
        const snapshot: Snapshot = {
          name,
          createdAt: new Date().toISOString(),
          entityCount: store.entities.size,
          data: {
            environment: { ...store.environment },
            entities: regular,
            constraints,
          },
        };

        // 4. Persist with QuotaExceededError guard (Pitfall #4, T-02-02)
        try {
          set((state) => {
            const next = [...state.slots];
            next[slotIndex] = snapshot;
            return { slots: next };
          });
          return { success: true };
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            return { success: false, error: '存储空间不足，请删除旧快照后重试' };
          }
          return { success: false, error: (e as Error).message };
        }
      },

      loadSnapshot: (slotIndex) => get().slots[slotIndex] ?? null,

      renameSnapshot: (slotIndex, newName) => {
        const slot = get().slots[slotIndex];
        if (!slot) {
          return { success: false, error: '槽位为空' };
        }

        // Check duplicate (exclude current slot)
        const dup = get().slots.some(
          (s, i) => s !== null && i !== slotIndex && s.name === newName
        );
        if (dup) {
          return { success: false, error: '名称已被使用' };
        }

        set((state) => {
          const next = [...state.slots];
          next[slotIndex] = { ...slot, name: newName };
          return { slots: next };
        });
        return { success: true };
      },

      deleteSnapshot: (slotIndex) => {
        set((state) => {
          const next = [...state.slots];
          next[slotIndex] = null;
          return { slots: next };
        });
      },

      isNameDuplicate: (name, excludeIndex) => {
        return get().slots.some(
          (s, i) => s !== null && i !== excludeIndex && s.name === name
        );
      },
    }),
    {
      name: 'physis-snapshots',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ slots: state.slots }),
      version: 1,
    }
  )
);
