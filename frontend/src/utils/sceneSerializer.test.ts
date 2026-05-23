import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeScene,
  deserializeScene,
  exportSceneToJSON,
  importJSONToScene,
} from './sceneSerializer';
import { createSphereEntity, createSpringEntity, createBoxEntity, createForceFieldEntity, resetEntityCounter } from '../ecs/Entity';
import type { Entity, ConstraintComponent, ForceFieldComponent } from '../ecs/types';
import type { EnvironmentState, SceneData } from './sceneValidation';
import type { ImportResult } from './sceneSerializer';

// ── Helpers ──

function makeStoreState(
  entities: Map<string, Entity>,
  envOverrides: Partial<EnvironmentState> = {}
): { entities: Map<string, Entity>; environment: EnvironmentState } {
  return {
    entities,
    environment: {
      gravity: [0, -9.81, 0],
      frictionScale: 1.0,
      restitutionScale: 1.0,
      drag: 0.1,
      peReferenceY: 0,
      ...envOverrides,
    },
  };
}

beforeEach(() => {
  resetEntityCounter();
});

// ── serializeScene Tests (Tests 1-3) ──

describe('serializeScene', () => {
  it('Test 1: serializeScene 将包含 2 个实体的 store 状态序列化为 SceneData，entities 数组长度为 2，不含 trail/vector 组件字段', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const s2 = createSphereEntity(1.0, 2, 0.3, 0.1, '#00ff00', [0, 0, 0], [3, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    entities.set(s2.id, s2);

    const state = makeStoreState(entities);
    const result = serializeScene(state);

    expect(result.simulation.entities).toHaveLength(2);
    expect(result.simulation.constraints).toHaveLength(0);

    // Verify no trail/vector in serialized components
    for (const entity of result.simulation.entities) {
      expect(entity.components.trail).toBeUndefined();
      expect(entity.components.vector).toBeUndefined();
    }
  });

  it('Test 2: serializeScene 输出包含 schemaVersion="1.0"、savedAt 为 ISO 8601 字符串、simulation.environment.gravity 为 store 中的值', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);

    const state = makeStoreState(entities, { gravity: [0, -5, 0] });
    const result = serializeScene(state);

    expect(result.schemaVersion).toBe('1.0');
    expect(result.savedAt).toBeDefined();
    // ISO 8601 format check
    expect(() => new Date(result.savedAt!)).not.toThrow();
    expect(result.simulation.environment.gravity).toEqual([0, -5, 0]);
    expect(result.simulation.environment.frictionScale).toBe(1.0);
    expect(result.simulation.environment.restitutionScale).toBe(1.0);
    expect(result.simulation.environment.drag).toBe(0.1);
  });

  it('Test 3: serializeScene 将约束实体放到 simulation.constraints 数组，非约束实体放到 simulation.entities 数组', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const s2 = createSphereEntity(0.5, 1, 0.5, 0.3, '#00ff00', [0, 0, 0], [3, 5, 0]);
    const spring = createSpringEntity(s1.id, s2.id);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    entities.set(s2.id, s2);
    entities.set(spring.id, spring);

    const state = makeStoreState(entities);
    const result = serializeScene(state);

    expect(result.simulation.entities).toHaveLength(2);
    expect(result.simulation.constraints).toHaveLength(1);

    const constraintEntity = result.simulation.constraints[0];
    expect(constraintEntity.id).toBe(spring.id);
    expect(constraintEntity.components.constraint).toBeDefined();
    expect((constraintEntity.components.constraint as any).entityAId).toBe(s1.id);
    expect((constraintEntity.components.constraint as any).entityBId).toBe(s2.id);
  });
});

// ── deserializeScene Tests (Tests 4-9) ──

describe('deserializeScene', () => {
  it('Test 4: deserializeScene 将合法 SceneData 还原为 { entities: Map, environment }，Map 中有正确数量的实体', () => {
    // First serialize a scene
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const s2 = createBoxEntity(1, 1, 1, 2, 0.3, 0.1, '#0000ff', [0, 0, 0], [3, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    entities.set(s2.id, s2);
    const state = makeStoreState(entities);
    const sceneData = serializeScene(state);

    // Deserialize
    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.entities.size).toBe(2);
    expect(result.data!.entities.get(s1.id)).toBeDefined();
    expect(result.data!.entities.get(s2.id)).toBeDefined();
  });

  it('Test 5: deserializeScene 还原的 Entity 具有完整组件，且组件为 Map 类型', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [5, 8, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    const state = makeStoreState(entities);
    const sceneData = serializeScene(state);
    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);

    const restored = result.data!.entities.get(s1.id)!;
    expect(restored.components instanceof Map).toBe(true);
    expect(restored.components.has('transform')).toBe(true);
    expect(restored.components.has('rigidBody')).toBe(true);
    expect(restored.components.has('collider')).toBe(true);
    expect(restored.components.has('material')).toBe(true);
    expect(restored.components.has('velocity')).toBe(true);

    // Verify component values
    const vel = restored.components.get('velocity');
    expect(vel).toBeDefined();
    expect((vel as any).linearVelocity).toEqual([5, 8, 0]);
  });

  it('Test 6: deserializeScene 遇到 schemaVersion 不匹配（如 "0.9"）仍返回 success=true + data + warnings', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    const state = makeStoreState(entities);
    const sceneData = serializeScene(state);
    // Modify version
    (sceneData as any).schemaVersion = '0.9';

    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some(w => w.includes('schemaVersion') || w.includes('version'))).toBe(true);
  });

  it('Test 7: deserializeScene 遇到无效 JSON（如字符串）返回 success=false + errors', () => {
    const result = deserializeScene('not valid');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 8: deserializeScene 遇到未知组件类型时过滤该组件，警告记录忽略信息，其余组件正常还原', () => {
    // Create a scene with known entities
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    const state = makeStoreState(entities);
    const sceneData = serializeScene(state);

    // Inject unknown component type into the serialized form
    (sceneData.simulation.entities[0].components as any).unknownType = { type: 'unknownType', value: 42 };

    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.warnings.some(w => w.includes('unknownType') || w.includes('组件'))).toBe(true);

    // The restored entity should have the known components but not the unknown one
    const restored = result.data!.entities.get(s1.id)!;
    expect(restored.components.has('transform')).toBe(true);
    expect(restored.components.has('unknownType' as any)).toBe(false);
  });

  it('Test 9: deserializeScene 还原的 Entity.id 和 Entity.name 与原始 JSON 一致', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    const state = makeStoreState(entities);
    const sceneData = serializeScene(state);

    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get(s1.id)!;
    expect(restored.id).toBe(s1.id);
    expect(restored.name).toBe(s1.name);
  });
});

// ── Roundtrip Test (Test 10) ──

describe('roundtrip', () => {
  it('Test 10: deserializeScene + serializeScene 往返：先序列化再反序列化再序列化，两次序列化结果一致（幂等性）', () => {
    resetEntityCounter();
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [5, 8, 0], [0, 5, 0]);
    const s2 = createBoxEntity(1, 0.5, 1, 2, 0.3, 0.1, '#00ff00', [0, 3, 0], [3, 5, 0]);
    const spring = createSpringEntity(s1.id, s2.id);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    entities.set(s2.id, s2);
    entities.set(spring.id, spring);
    const state = makeStoreState(entities);

    // First serialization
    const first = serializeScene(state);

    // Deserialize back
    const restored = deserializeScene(first);
    expect(restored.success).toBe(true);

    // Second serialization
    const second = serializeScene({
      entities: restored.data!.entities,
      environment: restored.data!.environment,
    });

    // Compare: remove savedAt since it changes
    const { savedAt: _s1, ...firstData } = first;
    const { savedAt: _s2, ...secondData } = second;

    expect(firstData).toEqual(secondData);
  });
});

// ── exportSceneToJSON / importJSONToScene Tests ──

describe('exportSceneToJSON / importJSONToScene', () => {
  it('exportSceneToJSON 返回格式化的 JSON 字符串', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    const state = makeStoreState(entities);

    const jsonStr = exportSceneToJSON(state);
    expect(typeof jsonStr).toBe('string');

    // Should be valid JSON
    const parsed = JSON.parse(jsonStr);
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.simulation.entities).toHaveLength(1);
  });

  it('importJSONToScene 解析合法 JSON 字符串并返回场景数据', () => {
    const s1 = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(s1.id, s1);
    const state = makeStoreState(entities);
    const jsonStr = exportSceneToJSON(state);

    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.entities.size).toBe(1);
  });

  it('importJSONToScene 拒绝超过 5MB 的 JSON 字符串', () => {
    // Create a string larger than 5MB
    const largeData = {
      schemaVersion: '1.0',
      simulation: { environment: { gravity: [0, -9.81, 0], frictionScale: 1, restitutionScale: 1, drag: 0.1 }, entities: [], constraints: [] },
      bigField: 'x'.repeat(5 * 1024 * 1024 + 10), // > 5MB
    };
    const largeStr = JSON.stringify(largeData);

    const result = importJSONToScene(largeStr);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('5MB') || e.includes('大小'))).toBe(true);
  });

  it('importJSONToScene 处理 JSON 语法错误返回 failure', () => {
    const result = importJSONToScene('{ invalid json }');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});

// ── ForceField & Charge Serialization Tests (03-05) ──

describe('forceField serialization', () => {
  it('序列化包含力场实体的场景 → forceField 出现在 JSON 中', () => {
    resetEntityCounter();
    const sphere = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const field = createForceFieldEntity('uniform', [0, 0, 0], 10, { direction: [0, 1, 0], strength: 5 });
    const entities = new Map<string, Entity>();
    entities.set(sphere.id, sphere);
    entities.set(field.id, field);

    const state = makeStoreState(entities);
    const result = serializeScene(state);

    // forceField 实体应该在 entities 中（不是 constraints）
    const fieldEntity = result.simulation.entities.find((e) => e.id === field.id);
    expect(fieldEntity).toBeDefined();
    expect(fieldEntity!.components.forceField).toBeDefined();
    expect((fieldEntity!.components.forceField as any).kind).toBe('uniform');
  });

  it('反序列化包含 charge 的 rigidBody → charge 正确还原', () => {
    resetEntityCounter();
    const sceneData: SceneData = {
      schemaVersion: '1.0',
      savedAt: new Date().toISOString(),
      simulation: {
        environment: {
          gravity: [0, -9.81, 0],
          frictionScale: 1.0,
          restitutionScale: 1.0,
          drag: 0.1,
          peReferenceY: 0,
        },
        entities: [
          {
            id: 'charged-ball',
            name: '带电球',
            components: {
              transform: {
                type: 'transform',
                position: [0, 5, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
              rigidBody: {
                type: 'rigidBody',
                kind: 'dynamic',
                mass: 1,
                restitution: 0.5,
                friction: 0.3,
                charge: 2.5,
              },
              collider: {
                type: 'collider',
                shape: 'sphere',
                params: { radius: 0.5 },
              },
              material: {
                type: 'material',
                color: '#ff0000',
                roughness: 0.6,
                metalness: 0.1,
              },
              velocity: {
                type: 'velocity',
                linearVelocity: [0, 0, 0],
                angularVelocity: [0, 0, 0],
              },
            },
          },
        ],
        constraints: [],
      },
    };

    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const restored = result.data!.entities.get('charged-ball');
    expect(restored).toBeDefined();

    const rb = restored!.components.get('rigidBody') as { charge: number } | undefined;
    expect(rb).toBeDefined();
    expect(rb!.charge).toBe(2.5);
  });

  it('反序列化包含 forceField 的实体 → components Map 包含 forceField', () => {
    resetEntityCounter();
    const sceneData: SceneData = {
      schemaVersion: '1.0',
      savedAt: new Date().toISOString(),
      simulation: {
        environment: {
          gravity: [0, -9.81, 0],
          frictionScale: 1.0,
          restitutionScale: 1.0,
          drag: 0.1,
          peReferenceY: 0,
        },
        entities: [
          {
            id: 'electric-field',
            name: '电场',
            components: {
              transform: {
                type: 'transform',
                position: [0, 5, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
              forceField: {
                type: 'forceField',
                kind: 'electric',
                position: [0, 5, 0],
                range: 20,
                charge: 10,
                decay: true,
              } as any,
            },
          },
        ],
        constraints: [],
      },
    };

    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const restored = result.data!.entities.get('electric-field');
    expect(restored).toBeDefined();
    expect(restored!.components.has('forceField')).toBe(true);

    const ff = restored!.components.get('forceField') as ForceFieldComponent | undefined;
    expect(ff).toBeDefined();
    expect(ff!.kind).toBe('electric');
    expect((ff as any).charge).toBe(10);
    expect((ff as any).range).toBe(20);
  });
});
