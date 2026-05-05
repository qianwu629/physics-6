import { describe, it, expect } from 'vitest';
import {
  EntitySchema,
  validateSceneJSON,
} from './sceneValidation';
import type { SceneData } from './sceneValidation';

// ── Helpers ──

function makeValidScene(overrides: Partial<SceneData> = {}): SceneData {
  return {
    schemaVersion: '1.0',
    savedAt: '2026-05-04T00:00:00.000Z',
    simulation: {
      environment: {
        gravity: [0, -9.81, 0],
        frictionScale: 1.0,
        restitutionScale: 1.0,
        drag: 0.1,
        peReferenceY: 0,
      },
      entities: [],
      constraints: [],
    },
    ...overrides,
  };
}

function makeValidEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entity-1',
    name: '测试实体',
    components: {
      transform: { type: 'transform', position: [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      rigidBody: { type: 'rigidBody', kind: 'dynamic', mass: 1, restitution: 0.5, friction: 0.3 },
      collider: { type: 'collider', shape: 'sphere', params: { radius: 0.5 } },
      material: { type: 'material', color: '#ff0000', roughness: 0.6, metalness: 0.1 },
      velocity: { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] },
    },
    ...overrides,
  };
}

// ── Tests 1-7: validateSceneJSON ──

describe('validateSceneJSON', () => {
  it('Test 1: 校验合法 JSON（schemaVersion="1.0" + valid simulation）返回 success', () => {
    const scene = makeValidScene();
    const result = validateSceneJSON(scene);
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data!.schemaVersion).toBe('1.0');
  });

  it('Test 2: 校验缺少 schemaVersion 字段返回 success=true + warnings 包含版本不匹配警告', () => {
    const { schemaVersion, ...rest } = makeValidScene();
    const result = validateSceneJSON(rest);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some(w => w.includes('schemaVersion') || w.includes('version') || w.includes('版本'))).toBe(true);
  });

  it('Test 3: 校验 schemaVersion="0.9" 返回 success=true + warnings 包含版本不匹配警告', () => {
    const scene = makeValidScene({ schemaVersion: '0.9' });
    const result = validateSceneJSON(scene);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('schemaVersion') || w.includes('version') || w.includes('版本'))).toBe(true);
  });

  it('Test 4: 校验缺少 simulation 对象但 Zod .default() 填充默认值后返回 success=true', () => {
    const result = validateSceneJSON({
      schemaVersion: '1.0',
      savedAt: '2026-05-04T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.simulation).toBeDefined();
    expect(result.data!.simulation.environment).toBeDefined();
    expect(result.data!.simulation.entities).toEqual([]);
    expect(result.data!.simulation.constraints).toEqual([]);
  });

  it('Test 5: 校验空 entities 数组 + 空 constraints 数组返回 success', () => {
    const scene = makeValidScene({
      simulation: {
        environment: { gravity: [0, -9.81, 0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1, peReferenceY: 0 },
        entities: [],
        constraints: [],
      },
    });
    const result = validateSceneJSON(scene);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Test 6: validateSceneJSON 遇到非对象输入（如裸字符串）返回 success=false + errors 包含解析错误', () => {
    const result = validateSceneJSON('not valid json');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 7: validateSceneJSON 遇到未知顶层字段（如 "camera"）返回 success=true + warnings 包含忽略字段名', () => {
    const json = {
      schemaVersion: '1.0',
      camera: { position: [0, 0, 0] },
      simulation: {
        environment: { gravity: [0, -9.81, 0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1 },
        entities: [],
        constraints: [],
      },
    };
    const result = validateSceneJSON(json);
    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('camera') || w.includes('忽略') || w.includes('未知'))).toBe(true);
  });
});

// ── Tests 8-10: EntitySchema / entity validation ──

describe('EntitySchema', () => {
  it('Test 8: 校验合法实体（transform+rigidBody+collider+material+velocity 五个组件）返回 success', () => {
    const entity = makeValidEntity();
    const result = EntitySchema.safeParse(entity);
    expect(result.success).toBe(true);
  });

  it('Test 9: 校验缺少 transform 组件（必填）返回 success=false', () => {
    const entity = makeValidEntity();
    // Remove transform from components
    const { transform, ...rest } = entity.components;
    const invalidEntity = { ...entity, components: rest };
    const result = EntitySchema.safeParse(invalidEntity);
    expect(result.success).toBe(false);
  });

  it('Test 10: 校验未知组件类型返回 warnings（宽容模式）+ 过滤未知组件后 success=true', () => {
    // Test through validateSceneJSON with an entity that has unknown component type
    const entity = makeValidEntity();
    (entity as { components: Record<string, unknown> }).components = {
      ...entity.components,
      unknownType: { type: 'unknownType', value: 42 },
      anotherUnknown: { type: 'anotherUnknown', data: 'test' },
    };
    const scene = makeValidScene({
      simulation: {
        environment: { gravity: [0, -9.81, 0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1, peReferenceY: 0 },
        entities: [entity],
        constraints: [],
      },
    });
    const result = validateSceneJSON(scene);
    expect(result.success).toBe(true);
    // Should have warnings about unknown component types
    expect(result.warnings.some(w => w.includes('unknownType') || w.includes('anotherUnknown') || w.includes('组件'))).toBe(true);
    // The data should still be valid
    expect(result.data).toBeDefined();
    expect(result.data!.simulation.entities).toHaveLength(1);
  });
});
