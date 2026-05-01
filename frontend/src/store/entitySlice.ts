import type { StateCreator } from 'zustand';
import type { Entity, ComponentType, Component } from '../ecs/types';

/**
 * Entity 集合状态切片 (D-03: ECS 作为场景定义数据模型)
 *
 * 存储所有实体的权威定义（组件参数、初始状态）。
 * 物理帧数据不经过 Zustand（维持 PITFALLS #6 防护）。
 */

/** 场景最大实体数 — T-02-02 防护 (DoS via WASM 内存耗尽) */
export const MAX_ENTITIES = 50;

export interface EntitySlice {
  /** 场景中所有实体的权威集合 (Map保证插入顺序 + O(1) 查找/删除) */
  entities: Map<string, Entity>;
  /** 当前选中的实体 ID (null = 无选中) */
  selectedEntityId: string | null;

  // ── Actions ──

  /** 添加实体到场景 (D-05: creation dialog confirm) */
  addEntity: (entity: Entity) => boolean;
  /** 删除实体 (D-11: panel delete button / Delete/Backspace key) */
  removeEntity: (id: string) => void;
  /** 选中/取消选中实体 (D-07: 3D click selection) */
  selectEntity: (id: string | null) => void;
  /** 更新实体指定组件的部分字段 (D-10: property panel edit) */
  updateComponent: (entityId: string, componentType: ComponentType, data: Partial<Component>) => void;
  /** 重置——清空所有实体 (D-12: reset = empty scene) */
  resetEntities: () => void;
}

export type EntityStore = EntitySlice;

export const createEntitySlice: StateCreator<EntitySlice, [], [], EntitySlice> = (set) => ({
  entities: new Map(),
  selectedEntityId: null,

  addEntity: (entity: Entity): boolean => {
    let success = false;
    set((state) => {
      if (state.entities.size >= MAX_ENTITIES) return state; // T-02-02: 硬上限
      const next = new Map(state.entities);
      next.set(entity.id, entity);
      success = true;
      return { entities: next, objectCount: next.size } as Partial<EntitySlice & { objectCount: number }>;
    });
    return success;
  },

  removeEntity: (id: string) =>
    set((state) => {
      if (!state.entities.has(id)) return state;
      const next = new Map(state.entities);
      next.delete(id);
      return {
        entities: next,
        selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
        objectCount: next.size,
      } as Partial<EntitySlice & { objectCount: number }>;
    }),

  selectEntity: (id: string | null) => set({ selectedEntityId: id }),

  updateComponent: (entityId: string, componentType: ComponentType, data: Partial<Component>) =>
    set((state) => {
      const entity = state.entities.get(entityId);
      if (!entity) return state;
      const comp = entity.components.get(componentType);
      if (!comp) return state;

      // 深层不可变更新: new component → new components Map → new Entity → new entities Map
      const updatedComp = { ...comp, ...data } as Component;
      const newComponents = new Map(entity.components);
      newComponents.set(componentType, updatedComp);
      const updatedEntity: Entity = { ...entity, components: newComponents };

      const nextEntities = new Map(state.entities);
      nextEntities.set(entityId, updatedEntity);
      return { entities: nextEntities } as Partial<EntitySlice>;
    }),

  resetEntities: () =>
    set(() => ({
      entities: new Map(),
      selectedEntityId: null,
      objectCount: 0,
    } as Partial<EntitySlice & { objectCount: number }>)),
});
