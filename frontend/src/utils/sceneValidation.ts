import { z } from 'zod';

// ── Serialized component types ──

export interface SerializedTransformComponent {
  type: 'transform';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface SerializedRigidBodyComponent {
  type: 'rigidBody';
  kind: 'dynamic' | 'fixed';
  mass: number;
  restitution: number;
  friction: number;
  charge?: number;
}

export interface SerializedColliderComponent {
  type: 'collider';
  shape: 'sphere' | 'cuboid' | 'cylinder';
  params: { radius?: number; halfWidth?: number; halfHeight?: number; halfDepth?: number };
}

export interface SerializedVelocityComponent {
  type: 'velocity';
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
}

export interface SerializedMaterialComponent {
  type: 'material';
  color: string;
  roughness: number;
  metalness: number;
}

export interface SerializedConstraintComponent {
  type: 'constraint';
  kind: 'spring';
  entityAId: string;
  entityBId: string;
  params: { stiffness: number; restLength: number; damping: number };
}

export interface SerializedUniformFieldComponent {
  type: 'forceField';
  kind: 'uniform';
  position: [number, number, number];
  range: number;
  direction: [number, number, number];
  strength: number;
}

export interface SerializedGravityFieldComponent {
  type: 'forceField';
  kind: 'gravity';
  position: [number, number, number];
  range: number;
  strength: number;
  decay: boolean;
}

export interface SerializedElectricFieldComponent {
  type: 'forceField';
  kind: 'electric';
  position: [number, number, number];
  range: number;
  charge: number;
  decay: boolean;
}

export interface SerializedMagneticFieldComponent {
  type: 'forceField';
  kind: 'magnetic';
  position: [number, number, number];
  range: number;
  direction: [number, number, number];
  strength: number;
}

export type SerializedForceFieldComponent =
  | SerializedUniformFieldComponent
  | SerializedGravityFieldComponent
  | SerializedElectricFieldComponent
  | SerializedMagneticFieldComponent;

export type SerializedComponent =
  | SerializedTransformComponent
  | SerializedRigidBodyComponent
  | SerializedColliderComponent
  | SerializedVelocityComponent
  | SerializedMaterialComponent
  | SerializedConstraintComponent
  | SerializedForceFieldComponent;

export interface SerializedEntity {
  id: string;
  name: string;
  components: Record<string, SerializedComponent>;
}

export interface EnvironmentState {
  gravity: [number, number, number];
  frictionScale: number;
  restitutionScale: number;
  drag: number;
  peReferenceY: number;
}

export interface SceneData {
  schemaVersion: string;
  savedAt?: string;
  simulation: {
    environment: EnvironmentState;
    entities: SerializedEntity[];
    constraints: SerializedEntity[];
  };
}

export interface ValidationResult {
  success: boolean;
  data?: SceneData;
  warnings: string[];
  errors: string[];
}

// ── Zod Schemas ──

const EnvironmentSchema = z.object({
  gravity: z.tuple([z.number(), z.number(), z.number()]).default([0, -9.81, 0]),
  frictionScale: z.number().default(1.0),
  restitutionScale: z.number().default(1.0),
  drag: z.number().default(0.1),
  peReferenceY: z.number().default(0),
});

const TransformSchema = z.object({
  type: z.literal('transform'),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number()]),
  scale: z.tuple([z.number(), z.number(), z.number()]),
});

const RigidBodySchema = z.object({
  type: z.literal('rigidBody'),
  kind: z.enum(['dynamic', 'fixed']),
  mass: z.number().min(0),
  restitution: z.number().min(0).max(1),
  friction: z.number().min(0).max(1),
  charge: z.number().default(0),
});

const ColliderSchema = z.object({
  type: z.literal('collider'),
  shape: z.enum(['sphere', 'cuboid', 'cylinder']),
  params: z.object({
    radius: z.number().optional(),
    halfWidth: z.number().optional(),
    halfHeight: z.number().optional(),
    halfDepth: z.number().optional(),
  }).passthrough(),
});

const VelocitySchema = z.object({
  type: z.literal('velocity'),
  linearVelocity: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  angularVelocity: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
});

const MaterialSchema = z.object({
  type: z.literal('material'),
  color: z.string(),
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
});

const ConstraintSchema = z.object({
  type: z.literal('constraint'),
  kind: z.literal('spring'),
  entityAId: z.string().min(1),
  entityBId: z.string().min(1),
  params: z.object({
    stiffness: z.number(),
    restLength: z.number(),
    damping: z.number(),
  }),
});

const UniformFieldSchema = z.object({
  type: z.literal('forceField'),
  kind: z.literal('uniform'),
  position: z.tuple([z.number(), z.number(), z.number()]),
  range: z.number().min(0),
  direction: z.tuple([z.number(), z.number(), z.number()]),
  strength: z.number(),
});

const GravityFieldSchema = z.object({
  type: z.literal('forceField'),
  kind: z.literal('gravity'),
  position: z.tuple([z.number(), z.number(), z.number()]),
  range: z.number().min(0),
  strength: z.number(),
  decay: z.boolean(),
});

const ElectricFieldSchema = z.object({
  type: z.literal('forceField'),
  kind: z.literal('electric'),
  position: z.tuple([z.number(), z.number(), z.number()]),
  range: z.number().min(0),
  charge: z.number(),
  decay: z.boolean(),
});

const MagneticFieldSchema = z.object({
  type: z.literal('forceField'),
  kind: z.literal('magnetic'),
  position: z.tuple([z.number(), z.number(), z.number()]),
  range: z.number().min(0),
  direction: z.tuple([z.number(), z.number(), z.number()]),
  strength: z.number(),
});

const BaseComponentSchema = z.discriminatedUnion('type', [
  TransformSchema,
  RigidBodySchema,
  ColliderSchema,
  VelocitySchema,
  MaterialSchema,
  ConstraintSchema,
]);

const ForceFieldSchema = z.discriminatedUnion('kind', [
  UniformFieldSchema,
  GravityFieldSchema,
  ElectricFieldSchema,
  MagneticFieldSchema,
]);

// 联合两种 schema — 用于 lenient 校验时接受任何组件
const ComponentSchema = z.union([BaseComponentSchema, ForceFieldSchema]);

// Known component type keys for filtering
const KNOWN_COMPONENT_TYPES = new Set(['transform', 'rigidBody', 'collider', 'velocity', 'material', 'constraint', 'forceField']);

// Lenient entity schema used inside SceneSchema (accepts any components)
const _SceneEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  components: z.record(z.string(), z.any()),
});

// Strict entity schema for individual validation
export const EntitySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  components: z.record(z.string(), ComponentSchema),
}).refine((e) => 'transform' in e.components, {
  message: 'Entity must have a transform component',
});

// SceneSchema — lenient, with defaults for missing simulation/entities/constraints
export const SceneSchema = z.object({
  schemaVersion: z.string().optional(),
  savedAt: z.string().optional(),
  simulation: z.object({
    environment: EnvironmentSchema,
    entities: z.array(_SceneEntitySchema).default([]),
    constraints: z.array(_SceneEntitySchema).default([]),
  }).default({
    environment: { gravity: [0, -9.81, 0], frictionScale: 1.0, restitutionScale: 1.0, drag: 0.1, peReferenceY: 0 },
    entities: [],
    constraints: [],
  }),
});

// ── Validation Functions ──

const KNOWN_TOP_KEYS = new Set(['schemaVersion', 'savedAt', 'simulation']);

/**
 * Check if the JSON has a schemaVersion that differs from "1.0"
 */
export function isVersionMismatch(json: unknown): boolean {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return true;
  const version = (json as any)?.schemaVersion;
  return version !== '1.0';
}

/**
 * Sanitize user-controlled strings in warning messages:
 * - truncate to maxLen
 * - filter control characters
 */
function sanitizeWarning(value: string, maxLen = 100): string {
  if (value.length > maxLen) {
    return value.slice(0, maxLen) + '...';
  }
  return value.replace(/[ -]/g, '');
}

/**
 * Validate scene JSON with tolerance:
 * - schemaVersion mismatch → warning (still loads)
 * - Unknown top-level fields → warning
 * - Unknown component types in entities → warning + filter
 * - Structural errors → error
 */
export function validateSceneJSON(json: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Must be an object
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    errors.push('JSON 解析错误: 输入不是有效的 JSON 对象');
    return { success: false, warnings, errors };
  }

  const obj = json as Record<string, unknown>;

  // 1. Check schemaVersion
  if (!('schemaVersion' in obj) || obj.schemaVersion !== '1.0') {
    const version = 'schemaVersion' in obj ? sanitizeWarning(String(obj.schemaVersion)) : '缺失';
    warnings.push(`schemaVersion 不匹配: 期望 "1.0"，得到 "${version}"，将尽力加载`);
  }

  // 2. Check unknown top-level keys
  const unknownTopKeys = Object.keys(obj).filter(k => !KNOWN_TOP_KEYS.has(k));
  for (const key of unknownTopKeys) {
    warnings.push(`忽略未知顶层字段: ${sanitizeWarning(key)}`);
  }

  // 3. Parse with lenient SceneSchema
  const parsed = SceneSchema.safeParse(json);
  if (!parsed.success) {
    // Check if errors are only soft (we already handle unknown fields)
    const hardErrors = parsed.error.issues.filter(
      i => i.code !== 'unrecognized_keys'
    );
    if (hardErrors.length > 0) {
      errors.push(...hardErrors.map(e => e.message));
      return { success: false, warnings, errors };
    }
    // Only unrecognized_keys — these are already handled as warnings above
  }

  if (!parsed.success) {
    // Fallback: if parse failed and we couldn't recover
    errors.push('场景数据格式无效');
    return { success: false, warnings, errors };
  }

  const data = parsed.data;

  // 4. Per-entity validation: detect unknown component types
  for (const entity of [...data.simulation.entities, ...data.simulation.constraints]) {
    if (entity.components && typeof entity.components === 'object') {
      const unknownTypes = Object.keys(entity.components).filter(
        k => !KNOWN_COMPONENT_TYPES.has(k)
      );
      for (const ut of unknownTypes) {
        warnings.push(`忽略实体 "${sanitizeWarning(entity.id)}" 中的未知组件类型: ${sanitizeWarning(ut)}`);
        // Filter out unknown component types
        delete entity.components[ut];
      }
    }
  }

  return { success: true, data: data as unknown as SceneData, warnings, errors };
}
