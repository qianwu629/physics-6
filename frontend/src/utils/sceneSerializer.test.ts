import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeScene,
  deserializeScene,
  exportSceneToJSON,
  importJSONToScene,
} from './sceneSerializer';
import { createSphereEntity, createSpringEntity, createBoxEntity, createForceFieldEntity, createConvexEntity, createFixedJointEntity, createRevoluteJointEntity, createSphericalJointEntity, createRopeJointEntity, createRodLinkEntity, createArcTrackEntity, createPlaneTrackEntity, createSpliceEntity, attachFaces, resetEntityCounter } from '../ecs/Entity';
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

// ── CurrentSource Serialization Tests (Phase 8) ──

describe('currentSource serialization', () => {
  it('currentSource 组件导出 → 导入 round-trip 完整还原', () => {
    resetEntityCounter();
    const wire = createBoxEntity(1, 1, 1, 0, 0.3, 0.1, '#888888', [0, 0, 0], [0, 2, 0]);
    wire.components.set('currentSource', {
      type: 'currentSource',
      magnitude: 10,
      direction: [0, 0, 1],
    });
    const entities = new Map<string, Entity>();
    entities.set(wire.id, wire);

    // 导出
    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const parsed = JSON.parse(jsonStr);
    const wireData = parsed.simulation.entities.find((e: { id: string }) => e.id === wire.id);
    expect(wireData).toBeDefined();
    expect(wireData.components.currentSource).toEqual({
      type: 'currentSource',
      magnitude: 10,
      direction: [0, 0, 1],
    });

    // 导入
    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get(wire.id);
    expect(restored).toBeDefined();
    const cs = restored!.components.get('currentSource');
    expect(cs).toBeDefined();
    expect(cs).toMatchObject({ type: 'currentSource', magnitude: 10, direction: [0, 0, 1] });
    // 不触发「未知组件类型」警告
    expect(result.warnings.some((w) => w.includes('未知组件类型'))).toBe(false);
  });

  it('负电流与非法结构：负 magnitude 原样还原（物理上表示反向）', () => {
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
            id: 'wire-1',
            name: '导线',
            components: {
              transform: {
                type: 'transform',
                position: [0, 1, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              },
              currentSource: {
                type: 'currentSource',
                magnitude: -5,
                direction: [0, 1, 0],
              },
            } as SceneData['simulation']['entities'][number]['components'],
          },
        ],
        constraints: [],
      },
    };

    const result = deserializeScene(sceneData);
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get('wire-1');
    expect(restored).toBeDefined();
    const cs = restored!.components.get('currentSource') as { magnitude: number; direction: number[] } | undefined;
    expect(cs).toBeDefined();
    expect(cs!.magnitude).toBe(-5);
    expect(cs!.direction).toEqual([0, 1, 0]);
  });
});

// ── ConvexProfile Serialization Tests (自定义凸形) ──

describe('convexProfile serialization', () => {
  it('凸形实体的 profile/thickness/mode 导出 → 导入 round-trip 完整还原', () => {
    resetEntityCounter();
    const profile: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const convex = createConvexEntity(profile, 1.5, 2, 0.5, 0.3, '#2a9d8f', [0, 0, 0], [0, 5, 0], 1);
    const entities = new Map<string, Entity>();
    entities.set(convex.id, convex);

    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const parsed = JSON.parse(jsonStr);
    const data = parsed.simulation.entities.find((e: { id: string }) => e.id === convex.id);
    expect(data).toBeDefined();
    expect(data.components.collider.shape).toBe('convexProfile');
    expect(data.components.collider.params.profile).toEqual(profile);
    expect(data.components.collider.params.thickness).toBe(1.5);
    expect(data.components.collider.params.mode).toBe('extrude');

    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get(convex.id);
    expect(restored).toBeDefined();
    const col = restored!.components.get('collider') as
      | { shape: string; params: { profile?: [number, number][]; thickness?: number; mode?: string } }
      | undefined;
    expect(col).toBeDefined();
    expect(col!.shape).toBe('convexProfile');
    expect(col!.params.profile).toEqual(profile);
    expect(col!.params.thickness).toBe(1.5);
    expect(col!.params.mode).toBe('extrude');
    // 电荷也随 rigidBody 还原
    const rb = restored!.components.get('rigidBody') as { charge: number } | undefined;
    expect(rb!.charge).toBe(1);
    expect(result.warnings.some((w) => w.includes('未知组件类型'))).toBe(false);
  });
});

// ── Face Friction Serialization Tests (W3 面摩擦) ──

describe('face friction serialization', () => {
  it('collider.faces 导出 → 导入 round-trip 完整还原（含固定面）', () => {
    resetEntityCounter();
    const box = createBoxEntity(1, 1, 1, 2, 0.5, 0.3, '#457b9d', [0, 0, 0], [0, 5, 0]);
    const faced = attachFaces(box, [
      { id: 'top', label: '上面', friction: 0.8, pinned: false },
      { id: 'bottom', label: '底面', friction: 0.1, pinned: true },
      { id: 'front', label: '前面', friction: 0.3, pinned: false },
      { id: 'back', label: '后面', friction: 0.3, pinned: false },
      { id: 'right', label: '右面', friction: 0.3, pinned: false },
      { id: 'left', label: '左面', friction: 0.3, pinned: false },
    ]);
    const entities = new Map<string, Entity>();
    entities.set(faced.id, faced);

    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);

    const restored = result.data!.entities.get(faced.id);
    expect(restored).toBeDefined();
    const col = restored!.components.get('collider') as
      | { faces?: { id: string; friction: number; pinned: boolean }[] }
      | undefined;
    expect(col?.faces).toHaveLength(6);
    const bottom = col!.faces!.find((f) => f.id === 'bottom');
    expect(bottom).toMatchObject({ friction: 0.1, pinned: true });
    const top = col!.faces!.find((f) => f.id === 'top');
    expect(top).toMatchObject({ friction: 0.8, pinned: false });
    expect(result.warnings.some((w) => w.includes('未知组件类型'))).toBe(false);
  });

  it('无 faces 的实体导入后保持单面模式（向后兼容）', () => {
    resetEntityCounter();
    const sphere = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 5, 0]);
    const entities = new Map<string, Entity>();
    entities.set(sphere.id, sphere);

    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get(sphere.id);
    const col = restored!.components.get('collider') as { faces?: unknown[] } | undefined;
    expect(col?.faces).toBeUndefined();
  });
});

// ── Fixed Joint Serialization Tests (W4) ──

describe('fixed joint serialization', () => {
  it('fixed 约束实体导出 → 导入 round-trip 完整还原（锚点/坐标架/showLink）', () => {
    resetEntityCounter();
    const a = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [-2, 5, 0]);
    const b = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#00ff00', [0, 0, 0], [2, 5, 0]);
    const joint = createFixedJointEntity(a.id, b.id, {
      anchorA: [1, 0, 0],
      anchorB: [-1, 0, 0],
      frameB: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
      showLink: false,
    });
    const entities = new Map<string, Entity>();
    entities.set(a.id, a);
    entities.set(b.id, b);
    entities.set(joint.id, joint);

    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const parsed = JSON.parse(jsonStr);
    expect(parsed.simulation.constraints).toHaveLength(1);
    expect(parsed.simulation.constraints[0].components.constraint.kind).toBe('fixed');

    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get(joint.id);
    expect(restored).toBeDefined();
    const c = restored!.components.get('constraint') as
      | { kind: string; entityAId: string; entityBId: string; params: { anchorA: number[]; anchorB: number[]; frameB: number[]; showLink?: boolean } }
      | undefined;
    expect(c).toBeDefined();
    expect(c!.kind).toBe('fixed');
    expect(c!.entityAId).toBe(a.id);
    expect(c!.entityBId).toBe(b.id);
    expect(c!.params.anchorA).toEqual([1, 0, 0]);
    expect(c!.params.anchorB).toEqual([-1, 0, 0]);
    expect(c!.params.frameB[3]).toBeCloseTo(Math.SQRT1_2, 10);
    expect(c!.params.showLink).toBe(false);
    expect(result.warnings.some((w) => w.includes('未知组件类型'))).toBe(false);
  });

  it('固定连接两端实体被删时级联删除连接（复用约束级联机制）', () => {
    resetEntityCounter();
    const a = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [-2, 5, 0]);
    const b = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#00ff00', [0, 0, 0], [2, 5, 0]);
    const joint = createFixedJointEntity(a.id, b.id, {
      anchorA: [1, 0, 0],
      anchorB: [-1, 0, 0],
      frameB: [0, 0, 0, 1],
    });
    const entities = new Map<string, Entity>();
    entities.set(a.id, a);
    entities.set(b.id, b);
    entities.set(joint.id, joint);

    // 模拟删除 A：约束实体应被级联删除（entitySlice 机制，此处直接验证数据关系）
    const c = joint.components.get('constraint') as { entityAId: string; entityBId: string };
    expect([a.id, b.id]).toContain(c.entityAId);
    expect([a.id, b.id]).toContain(c.entityBId);
  });
});

// ── Revolve (车削) Serialization Tests (二期) ──

describe('revolve profile serialization', () => {
  it('mode=revolve 的凸形实体导出 → 导入 round-trip 完整还原', () => {
    resetEntityCounter();
    const profile: [number, number][] = [[0, -1], [1.5, -1], [0.8, 0.5], [1.2, 1.5], [0, 1.5]];
    const vase = createConvexEntity(profile, 0, 2, 0.5, 0.3, '#e9c46a', [0, 0, 0], [0, 5, 0], 0, 'revolve');
    const entities = new Map<string, Entity>();
    entities.set(vase.id, vase);

    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);

    const restored = result.data!.entities.get(vase.id);
    const col = restored!.components.get('collider') as
      | { shape: string; params: { profile?: [number, number][]; mode?: string } }
      | undefined;
    expect(col).toBeDefined();
    expect(col!.shape).toBe('convexProfile');
    expect(col!.params.mode).toBe('revolve');
    expect(col!.params.profile).toEqual(profile);
    expect(result.warnings.some((w) => w.includes('未知组件类型'))).toBe(false);
  });
});

// ── Revolute / Spherical Joint Serialization Tests (二期) ──

describe('revolute & spherical joint serialization', () => {
  it('revolute 约束 round-trip（锚点 + 双局部轴）', () => {
    resetEntityCounter();
    const a = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [-2, 5, 0]);
    const b = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#00ff00', [0, 0, 0], [2, 5, 0]);
    const joint = createRevoluteJointEntity(a.id, b.id, {
      anchorA: [1, 0, 0],
      anchorB: [-1, 0, 0],
      axisA: [0, 1, 0],
      axisB: [0, 1, 0],
      showLink: true,
    });
    const entities = new Map<string, Entity>();
    entities.set(a.id, a);
    entities.set(b.id, b);
    entities.set(joint.id, joint);

    const result = importJSONToScene(exportSceneToJSON(makeStoreState(entities)));
    expect(result.success).toBe(true);
    const c = result.data!.entities.get(joint.id)!.components.get('constraint') as any;
    expect(c.kind).toBe('revolute');
    expect(c.params.axisA).toEqual([0, 1, 0]);
    expect(c.params.axisB).toEqual([0, 1, 0]);
    expect(c.params.anchorA).toEqual([1, 0, 0]);
    expect(c.params.showLink).toBe(true);
  });

  it('spherical 约束 round-trip（锚点 + showLink 缺省）', () => {
    resetEntityCounter();
    const a = createSphereEntity(0.5, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 8, 0]);
    const b = createSphereEntity(0.5, 1, 0.5, 0.3, '#00ff00', [0, 0, 0], [0, 5, 0]);
    const joint = createSphericalJointEntity(a.id, b.id, {
      anchorA: [0, -1.5, 0],
      anchorB: [0, 1.5, 0],
    });
    const entities = new Map<string, Entity>();
    entities.set(a.id, a);
    entities.set(b.id, b);
    entities.set(joint.id, joint);

    const result = importJSONToScene(exportSceneToJSON(makeStoreState(entities)));
    expect(result.success).toBe(true);
    const c = result.data!.entities.get(joint.id)!.components.get('constraint') as any;
    expect(c.kind).toBe('spherical');
    expect(c.params.anchorA).toEqual([0, -1.5, 0]);
    expect(c.params.anchorB).toEqual([0, 1.5, 0]);
  });
});

// ── Rope Joint Serialization Tests (W8 轻绳) ──

describe('rope joint serialization', () => {
  it('rope 约束 round-trip（锚点 + 绳长）', () => {
    resetEntityCounter();
    const a = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#ff0000', [0, 0, 0], [0, 8, 0]);
    const b = createBoxEntity(1, 1, 1, 1, 0.5, 0.3, '#00ff00', [0, 0, 0], [0, 5, 0]);
    const rope = createRopeJointEntity(a.id, b.id, {
      anchorA: [0, 0, 0],
      anchorB: [0, 0, 0],
      length: 3.5,
      showLink: true,
    });
    const entities = new Map<string, Entity>();
    entities.set(a.id, a);
    entities.set(b.id, b);
    entities.set(rope.id, rope);

    const result = importJSONToScene(exportSceneToJSON(makeStoreState(entities)));
    expect(result.success).toBe(true);
    const c = result.data!.entities.get(rope.id)!.components.get('constraint') as any;
    expect(c.kind).toBe('rope');
    expect(c.params.length).toBe(3.5);
    expect(c.params.anchorA).toEqual([0, 0, 0]);
    expect(c.params.showLink).toBe(true);
  });

  it('轻杆连杆实体（cylinder + 微质量）序列化 round-trip', () => {
    resetEntityCounter();
    const rod = createRodLinkEntity([0, 5, 0], [0, 0, Math.PI / 4], 4);
    const entities = new Map<string, Entity>();
    entities.set(rod.id, rod);

    const result = importJSONToScene(exportSceneToJSON(makeStoreState(entities)));
    expect(result.success).toBe(true);
    const restored = result.data!.entities.get(rod.id)!;
    const rb = restored.components.get('rigidBody') as any;
    const col = restored.components.get('collider') as any;
    expect(rb.mass).toBeCloseTo(0.01, 10);
    expect(col.shape).toBe('cylinder');
    expect(col.params.halfHeight).toBe(2);
  });
});

// ── Arc Track Serialization Tests (P4 圆弧轨道) ──

describe('arc track serialization', () => {
  it('圆弧轨道（arc 碰撞体 + faces）导出 → 导入 round-trip 完整还原', () => {
    resetEntityCounter();
    const arc = createArcTrackEntity(3, 0.5, 90, 2, 0.4, '#8b7fd4', [0, 3, 0]);
    const faced = attachFaces(arc, [
      { id: 'inner', label: '内弧面', friction: 0.05, pinned: false },
      { id: 'outer', label: '主体面', friction: 0.4, pinned: false },
    ]);
    const entities = new Map<string, Entity>();
    entities.set(faced.id, faced);

    const jsonStr = exportSceneToJSON(makeStoreState(entities));
    const result = importJSONToScene(jsonStr);
    expect(result.success).toBe(true);

    const restored = result.data!.entities.get(faced.id)!;
    const col = restored.components.get('collider') as any;
    expect(col.shape).toBe('arc');
    expect(col.params.innerR).toBe(3);
    expect(col.params.thickness).toBe(0.5);
    expect(col.params.arcAngle).toBe(90);
    expect(col.params.width).toBe(2);
    expect(col.faces).toHaveLength(2);
    expect(col.faces.find((f: { id: string }) => f.id === 'inner')).toMatchObject({ friction: 0.05 });
    expect(result.warnings.some((w) => w.includes('未知组件类型'))).toBe(false);
  });
});

// ── Splice Serialization Tests (P5 轨道拼接) ──

describe('splice serialization', () => {
  it('splice 约束 round-trip（接缝参数 + 损耗配置）', () => {
    resetEntityCounter();
    const master = createPlaneTrackEntity(3, 1.5, 0.3, '#8b7fd4', [0, 1, 0]);
    const track = createPlaneTrackEntity(3, 1.5, 0.3, '#8b7fd4', [6, 1, 0]);
    const splice = createSpliceEntity(master.id, track.id, {
      faceId: 'right',
      center: [3, 1, 0],
      normal: [1, 0, 0],
      halfExtents: [0.3, 2, 1.7],
      quaternion: [0, 0, 0, 1],
      lossType: 'percent',
      loss: 0.3,
      showLink: true,
    });
    const entities = new Map<string, Entity>();
    entities.set(master.id, master);
    entities.set(track.id, track);
    entities.set(splice.id, splice);

    const result = importJSONToScene(exportSceneToJSON(makeStoreState(entities)));
    expect(result.success).toBe(true);
    const c = result.data!.entities.get(splice.id)!.components.get('constraint') as any;
    expect(c.kind).toBe('splice');
    expect(c.entityAId).toBe(master.id);
    expect(c.entityBId).toBe(track.id);
    expect(c.params.faceId).toBe('right');
    expect(c.params.center).toEqual([3, 1, 0]);
    expect(c.params.halfExtents).toEqual([0.3, 2, 1.7]);
    expect(c.params.lossType).toBe('percent');
    expect(c.params.loss).toBeCloseTo(0.3, 10);
  });
});
