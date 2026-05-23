/**
 * 场景序列化/反序列化引擎
 *
 * D-01-01: 最小集 — environment + entities (excluding trail/vector) + constraints
 * D-01-02: 宽容模式 — schemaVersion 不匹配时仍加载 + 警告
 * D-01-08: 分级错误 — JSON 语法错误 / 文件 > 5MB 硬拒绝
 */

import type { Entity, Component, ComponentType, ConstraintComponent } from '../ecs/types';
import { createEntity } from '../ecs/Entity';
import { DEFAULT_ENVIRONMENT } from '../store/simulationSlice';
import type { EnvironmentState } from '../store/simulationSlice';
import { validateSceneJSON } from './sceneValidation';
import type {
  SceneData,
  SerializedEntity,
  SerializedComponent,
  ValidationResult,
} from './sceneValidation';

// Re-export types for convenience
export type { SceneData, SerializedEntity, SerializedComponent, ValidationResult };

// Re-export DeserializeResult as the return type for importJSONToScene
export interface ImportResult {
  success: boolean;
  data?: {
    entities: Map<string, Entity>;
    environment: EnvironmentState;
  };
  warnings: string[];
  errors: string[];
}

// ── Constants ──

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const KNOWN_COMPONENT_TYPES = new Set<string>([
  'transform', 'rigidBody', 'collider', 'velocity', 'material', 'constraint', 'forceField',
]);

// ── serializeScene ──

export interface SerializeState {
  entities: Map<string, Entity>;
  environment: EnvironmentState;
}

/**
 * 序列化场景状态为 SceneData (D-01-01 最小集)
 * - 排除 trail/vector 可视化组件
 * - 约束实体放入 simulation.constraints
 * - 非约束实体放入 simulation.entities
 */
export function serializeScene(state: SerializeState): SceneData {
  const serializedEntities: SerializedEntity[] = [];
  const serializedConstraints: SerializedEntity[] = [];

  for (const entity of state.entities.values()) {
    const components: Record<string, unknown> = {};

    // Iterate components, excluding trail and vector (D-01-01)
    for (const [type, comp] of entity.components) {
      if (type === 'trail' || type === 'vector') continue;
      components[type] = comp;
    }

    const serialized: SerializedEntity = {
      id: entity.id,
      name: entity.name,
      components: components as Record<string, SerializedComponent>,
    };

    // Determine if this is a constraint entity
    if ('constraint' in components) {
      serializedConstraints.push(serialized);
    } else {
      serializedEntities.push(serialized);
    }
  }

  return {
    schemaVersion: '1.0',
    savedAt: new Date().toISOString(),
    simulation: {
      environment: {
        gravity: [...state.environment.gravity] as [number, number, number],
        frictionScale: state.environment.frictionScale,
        restitutionScale: state.environment.restitutionScale,
        drag: state.environment.drag,
        peReferenceY: state.environment.peReferenceY,
      },
      entities: serializedEntities,
      constraints: serializedConstraints,
    },
  };
}

// ── deserializeScene ──

export interface DeserializeResult {
  success: boolean;
  data?: {
    entities: Map<string, Entity>;
    environment: EnvironmentState;
  };
  warnings: string[];
  errors: string[];
}

/**
 * 反序列化 SceneData JSON 为运行时 ECS 状态
 *
 * 1. 调用 validateSceneJSON 进行 Schema 校验（宽容模式）
 * 2. 使用 createEntity 工厂函数重建 Entity（自动附加 trail/vector）
 * 3. 恢复所有组件到 Entity.components Map
 * 4. 检查约束引用有效性（失效引用跳过 + 警告）
 */
export function deserializeScene(json: unknown): DeserializeResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Validate with tolerant schema checker
  const validated = validateSceneJSON(json);
  warnings.push(...validated.warnings);

  if (!validated.success) {
    errors.push(...validated.errors);
    return { success: false, warnings, errors };
  }

  const data = validated.data!;

  // 2. Build environment (merge with defaults for safety)
  const environment: EnvironmentState = {
    gravity: [...(data.simulation.environment.gravity)] as [number, number, number],
    frictionScale: data.simulation.environment.frictionScale ?? DEFAULT_ENVIRONMENT.frictionScale,
    restitutionScale: data.simulation.environment.restitutionScale ?? DEFAULT_ENVIRONMENT.restitutionScale,
    drag: data.simulation.environment.drag ?? DEFAULT_ENVIRONMENT.drag,
    peReferenceY: data.simulation.environment.peReferenceY ?? DEFAULT_ENVIRONMENT.peReferenceY,
  };

  // 3. Build entities Map
  const entitiesMap = new Map<string, Entity>();

  // Helper: build an entity from SerializedEntity
  const buildEntity = (serializedEntity: SerializedEntity): Entity | null => {
    try {
      // Use factory that auto-attaches trail and vector
      const entity = createEntity(serializedEntity.id, serializedEntity.name, []);

      // Transfer components from serialized record to entity's Map
      if (serializedEntity.components && typeof serializedEntity.components === 'object') {
        for (const [key, comp] of Object.entries(serializedEntity.components)) {
          // Filter unknown component types
          if (!KNOWN_COMPONENT_TYPES.has(key)) {
            warnings.push(`忽略实体 "${serializedEntity.id}" 中的未知组件类型: ${key}`);
            continue;
          }
          entity.components.set(key as ComponentType, comp as Component);
        }
      }

      return entity;
    } catch (err) {
      warnings.push(`无法创建实体 "${serializedEntity.id}": ${(err as Error).message}`);
      return null;
    }
  };

  // 3. Build all entities first (regular + constraints)
  const allSerializedEntities = [
    ...data.simulation.entities,
    ...data.simulation.constraints,
  ];

  const failedEntityIds = new Set<string>();

  for (const serializedEntity of allSerializedEntities) {
    const entity = buildEntity(serializedEntity);
    if (entity) {
      entitiesMap.set(entity.id, entity);
    } else {
      failedEntityIds.add(serializedEntity.id);
    }
  }

  // 4. Validate constraint references after ALL entities are built
  //    (D-01-08: 引用失效 → 跳过 + 警告)
  let skippedConstraints = 0;
  for (const entity of entitiesMap.values()) {
    const constraintComp = entity.components.get('constraint') as ConstraintComponent | undefined;
    if (constraintComp) {
      const entityAExists = entitiesMap.has(constraintComp.entityAId);
      const entityBExists = entitiesMap.has(constraintComp.entityBId);
      const entityAFailed = failedEntityIds.has(constraintComp.entityAId);
      const entityBFailed = failedEntityIds.has(constraintComp.entityBId);

      if (!entityAExists || !entityBExists) {
        const missingIds: string[] = [];
        if (!entityAExists) missingIds.push(constraintComp.entityAId);
        if (!entityBExists) missingIds.push(constraintComp.entityBId);
        warnings.push(
          `约束实体 "${entity.id}" 引用的实体 ${missingIds.join(', ')} 不存在，已跳过该约束`
        );
        entitiesMap.delete(entity.id);
        skippedConstraints++;
      } else if (entityAFailed || entityBFailed) {
        const failedIds: string[] = [];
        if (entityAFailed) failedIds.push(constraintComp.entityAId);
        if (entityBFailed) failedIds.push(constraintComp.entityBId);
        warnings.push(
          `实体 ${failedIds.join(', ')} 创建失败，导致约束 "${entity.id}" 被跳过`
        );
        entitiesMap.delete(entity.id);
        skippedConstraints++;
      }
    }
  }
  if (skippedConstraints > 0) {
    warnings.push(`${skippedConstraints} 个约束已跳过`);
  }

  return {
    success: true,
    data: { entities: entitiesMap, environment },
    warnings,
    errors,
  };
}

// ── exportSceneToJSON ──

/**
 * 序列化场景并格式化为 JSON 字符串
 */
export function exportSceneToJSON(state: SerializeState): string {
  const sceneData = serializeScene(state);
  return JSON.stringify(sceneData, null, 2);
}

// ── importJSONToScene ──

/**
 * 从 JSON 字符串导入场景
 * - 检查文件大小 > 5MB → 拒绝 (D-01-08)
 * - JSON 语法错误 → 拒绝
 * - 解析成功后调用 deserializeScene
 */
export function importJSONToScene(jsonString: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // File size check (D-01-08)
  const byteSize = new TextEncoder().encode(jsonString).length;
  if (byteSize > MAX_FILE_SIZE) {
    errors.push(`文件大小超过 5MB 限制（当前 ${(byteSize / (1024 * 1024)).toFixed(1)}MB），无法加载`);
    return { success: false, warnings, errors };
  }

  // JSON parse with error handling
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    errors.push(`JSON 语法错误: ${(err as Error).message}`);
    return { success: false, warnings, errors };
  }

  // Delegate to deserializeScene
  const result = deserializeScene(parsed);

  return {
    success: result.success,
    data: result.data,
    warnings: [...warnings, ...result.warnings],
    errors: [...errors, ...result.errors],
  };
}
