/**
 * sceneSerializer — 场景序列化/反序列化核心
 *
 * Plan 01-03 依赖：将 Entity Map + Environment 转换为 SceneData（JSON 格式），
 * 以及从解析后的 JSON 反序列化为运行时 Entity Map。
 *
 * D-01-01: 只序列化核心仿真数据（transform, rigidBody, collider, velocity, material, constraint）
 * 不序列化可视化/UI 组件（trail, vector）。
 */

import type { Entity, ComponentType, Component } from '../ecs/types';
import type {
  SceneData,
  SerializedEntity,
  SerializedComponent,
  EnvironmentState,
} from './sceneValidation';
import { validateSceneJSON } from './sceneValidation';

/** 序列化时排除的可视化/UI 组件类型 */
const EXCLUDED_COMPONENT_TYPES: Set<ComponentType> = new Set(['trail', 'vector']);

/**
 * 将运行时 Entity Map + Environment 序列化为 SceneData
 *
 * @param state.entities - Map<string, Entity>，运行时实体集合
 * @param state.environment - 环境参数
 * @returns SceneData（符合 D-01-01 Schema）
 */
export function serializeScene(state: {
  entities: Map<string, Entity>;
  environment: EnvironmentState;
}): SceneData {
  const entities: SerializedEntity[] = [];
  const constraints: SerializedEntity[] = [];

  for (const [, entity] of state.entities) {
    const componentRecord: Record<string, SerializedComponent> = {};

    for (const [compType, comp] of entity.components) {
      if (EXCLUDED_COMPONENT_TYPES.has(compType)) continue;

      // Component type 已经是窄化的字面量类型，安全转换
      componentRecord[compType] = comp as unknown as SerializedComponent;
    }

    const serialized: SerializedEntity = {
      id: entity.id,
      name: entity.name,
      components: componentRecord,
    };

    // constraint 类型实体放入 constraints 数组，其他放入 entities
    if ('constraint' in componentRecord) {
      constraints.push(serialized);
    } else {
      entities.push(serialized);
    }
  }

  return {
    schemaVersion: '1.0',
    savedAt: new Date().toISOString(),
    simulation: {
      environment: {
        gravity: [...state.environment.gravity],
        frictionScale: state.environment.frictionScale,
        restitutionScale: state.environment.restitutionScale,
        drag: state.environment.drag,
      },
      entities,
      constraints,
    },
  };
}

/**
 * 从解析后的 JSON 反序列化为运行时对象
 *
 * 使用 sceneValidation.ts 中的 validateSceneJSON 进行 Zod 校验，
 * 然后将 SerializedEntity 转换为 Entity 对象。
 *
 * D-01-02: schemaVersion 不匹配时产生 warnings 但不阻断加载。
 * D-01-08: 约束引用失效时跳过约束并记录 warning。
 *
 * @param json - 已 JSON.parse 的未知对象
 * @returns { success, data?, warnings, errors }
 */
export function deserializeScene(json: unknown): {
  success: boolean;
  data?: { entities: Map<string, Entity>; environment: EnvironmentState };
  warnings: string[];
  errors: string[];
} {
  const result = validateSceneJSON(json);
  if (!result.success || !result.data) {
    return {
      success: false,
      warnings: result.warnings,
      errors: result.errors,
    };
  }

  const sceneData = result.data;
  const warnings = [...result.warnings];
  let skippedConstraints = 0;

  const entityMap = new Map<string, Entity>();

  // 1. 先反序列化实体（不含 constraint）
  for (const serEntity of sceneData.simulation.entities) {
    const components = new Map<ComponentType, Component>();

    for (const [compType, comp] of Object.entries(serEntity.components)) {
      // 类型安全：validateSceneJSON 已确保 compType 是已知类型
      components.set(compType as ComponentType, { ...comp } as Component);
    }

    const entity: Entity = {
      id: serEntity.id,
      name: serEntity.name,
      components,
    };

    entityMap.set(entity.id, entity);
  }

  // 2. 再反序列化约束（需要检查 entityAId/entityBId 引用）
  for (const serConstraint of sceneData.simulation.constraints) {
    const constraintComp = serConstraint.components['constraint'] as
      | SerializedComponent & { entityAId: string; entityBId: string }
      | undefined;

    if (!constraintComp) continue;

    const { entityAId, entityBId } = constraintComp;

    // D-01-08: 约束引用失效检查
    if (!entityMap.has(entityAId) || !entityMap.has(entityBId)) {
      skippedConstraints++;
      warnings.push(
        `约束 '${serConstraint.id}' 引用失效（${
          !entityMap.has(entityAId) ? `entityAId=${entityAId}` : ''
        }${!entityMap.has(entityAId) && !entityMap.has(entityBId) ? '/' : ''}${
          !entityMap.has(entityBId) ? `entityBId=${entityBId}` : ''
        } 不存在），已跳过`
      );
      continue;
    }

    const components = new Map<ComponentType, Component>();
    for (const [compType, comp] of Object.entries(serConstraint.components)) {
      components.set(compType as ComponentType, { ...comp } as Component);
    }

    const entity: Entity = {
      id: serConstraint.id,
      name: serConstraint.name,
      components,
    };

    entityMap.set(entity.id, entity);
  }

  if (skippedConstraints > 0) {
    warnings.push(`${skippedConstraints} 个约束已跳过`);
  }

  return {
    success: true,
    data: {
      entities: entityMap,
      environment: {
        gravity: [...sceneData.simulation.environment.gravity],
        frictionScale: sceneData.simulation.environment.frictionScale,
        restitutionScale: sceneData.simulation.environment.restitutionScale,
        drag: sceneData.simulation.environment.drag,
      },
    },
    warnings,
    errors: [],
  };
}

/**
 * SceneData -> JSON 字符串
 */
export function exportSceneToJSON(state: {
  entities: Map<string, Entity>;
  environment: EnvironmentState;
}): string {
  const sceneData = serializeScene(state);
  return JSON.stringify(sceneData, null, 2);
}

/**
 * JSON 字符串 -> 校验后的结果
 */
export function importJSONToScene(
  json: string
): { success: boolean; data?: { entities: Map<string, Entity>; environment: EnvironmentState }; warnings: string[]; errors: string[] } {
  try {
    const parsed = JSON.parse(json);
    return deserializeScene(parsed);
  } catch (err) {
    return {
      success: false,
      warnings: [],
      errors: [`JSON 解析错误: ${(err as Error).message}`],
    };
  }
}
