import type { StateCreator } from 'zustand';
import type { Entity, ComponentType, Component, ConstraintComponent } from '../ecs/types';
import { disposeBuffer, chartBuffers } from './chartBuffer';
import { useChartDataStore } from './chartDataStore';

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

  /** 切换轨迹可见性 (Phase 4: 可视化控制) */
  toggleTrailVisibility: (entityId: string, visible: boolean) => void;
  /** 切换矢量可见性 (Phase 4: 可视化控制) */
  toggleVectorVisibility: (entityId: string, visible: boolean) => void;
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
      return { entities: next };
    });
    return success;
  },

  removeEntity: (id: string) =>
    set((state) => {
      if (!state.entities.has(id)) return state;
      const next = new Map(state.entities);
      next.delete(id);

      // ── Phase 3: 级联删除引用了此 id 的 constraint entity ──
      const cascadeRemove: string[] = [];
      for (const [eid, entity] of next.entries()) {
        const constraint = entity.components.get('constraint') as ConstraintComponent | undefined;
        if (constraint && (constraint.entityAId === id || constraint.entityBId === id)) {
          cascadeRemove.push(eid);
        }
      }
      cascadeRemove.forEach((eid) => next.delete(eid));

      // ── C-05 fix: 释放 chart 资源 (untrack + dispose buffer ~52 MB / 实体) ──
      const chartStore = useChartDataStore.getState();
      for (const removedId of [id, ...cascadeRemove]) {
        chartStore.untrackEntity(removedId);
        disposeBuffer(removedId);
      }

      return {
        entities: next,
        selectedEntityId:
          state.selectedEntityId === id || cascadeRemove.includes(state.selectedEntityId ?? '')
            ? null
            : state.selectedEntityId,
      };
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
      return { entities: nextEntities };
    }),

  resetEntities: () =>
    set(() => {
      // ── C-05 fix: 重置场景时一并释放所有 chart 资源 ──
      // (a) 清空 trackedEntityIds (无论 buffer 是否存在);
      // (b) 释放所有 chartBuffers Float64Array (~52 MB / 实体)。
      useChartDataStore.setState({ trackedEntityIds: new Set() });
      for (const id of Array.from(chartBuffers.keys())) {
        disposeBuffer(id);
      }
      return {
        entities: new Map(),
        selectedEntityId: null,
      };
    }),

  toggleTrailVisibility: (entityId: string, visible: boolean) =>
    set((state) => {
      const entity = state.entities.get(entityId);
      if (!entity) return state;
      const newComponents = new Map(entity.components);
      newComponents.set('trail', {
        type: 'trail',
        visible,
      });
      const updated: Entity = { ...entity, components: newComponents };
      const next = new Map(state.entities);
      next.set(entityId, updated);
      return { entities: next };
    }),

  toggleVectorVisibility: (entityId: string, visible: boolean) =>
    set((state) => {
      const entity = state.entities.get(entityId);
      if (!entity) return state;
      const newComponents = new Map(entity.components);
      newComponents.set('vector', {
        type: 'vector',
        showVelocity: visible,
        showForces: visible,
      });
      const updated: Entity = { ...entity, components: newComponents };
      const next = new Map(state.entities);
      next.set(entityId, updated);
      return { entities: next };
    }),
});
