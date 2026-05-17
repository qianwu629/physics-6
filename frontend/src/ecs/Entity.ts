import type {
  Entity, Component, ComponentType,
  TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent,
  ConstraintComponent, TrailComponent, VectorComponent, SpringConstraintParams,
  ForceFieldKind, ForceFieldComponent,
  UniformFieldComponent, GravityFieldComponent, ElectricFieldComponent, MagneticFieldComponent,
} from './types';
import { DEFAULT_COLORS, DEFAULT_MATERIAL } from './components/Material';

export const DEFAULT_SPRING_PARAMS: SpringConstraintParams = {
  stiffness: 100,
  restLength: 2.0,
  damping: 0.1,
};

/**
 * ECS Entity 工厂 (D-01)
 * 创建 EntityNode + Component Map — 行为由组件集合决定 (DIF-01)
 */

export function createEntity(
  id: string,
  name: string,
  components: Component[],
): Entity {
  const compMap = new Map<ComponentType, Component>();
  for (const comp of components) {
    compMap.set(comp.type, comp);
  }
  // Phase 4: 新实体默认附加 trail 和 vector 组件
  if (!compMap.has('trail')) {
    compMap.set('trail', { type: 'trail', visible: true } as TrailComponent);
  }
  if (!compMap.has('vector')) {
    compMap.set('vector', { type: 'vector', showVelocity: true, showForces: true } as VectorComponent);
  }
  return { id, name, components: compMap };
}

// ── 形状特定工厂 (D-05: 默认 spawn 于 (0, 5, 0)) ──

let entityCounter = 0; // 全局递增计数器 — 永不重用 (per RESEARCH Open Question #3 推荐)

function nextNumber(): number {
  return ++entityCounter;
}

export function createSphereEntity(
  radius: number,
  mass: number,
  restitution: number,
  friction: number,
  color?: string,
  velocity?: [number, number, number],
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    {
      type: 'transform',
      position: position ?? [0, 5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    } as TransformComponent,
    {
      type: 'rigidBody',
      kind: 'dynamic',
      mass,
      restitution,
      friction,
      charge: 0,
    } as RigidBodyComponent,
    {
      type: 'collider',
      shape: 'sphere',
      params: { radius },
    } as ColliderComponent,
    {
      type: 'material',
      color: color ?? DEFAULT_COLORS.sphere,
      roughness: DEFAULT_MATERIAL.roughness,
      metalness: DEFAULT_MATERIAL.metalness,
    } as MaterialComponent,
    {
      type: 'velocity',
      linearVelocity: velocity ?? [0, 0, 0],
      angularVelocity: [0, 0, 0],
    } as VelocityComponent,
  ];
  return createEntity(`sphere-${n}`, `球体-${n}`, components);
}

export function createBoxEntity(
  halfWidth: number,
  halfHeight: number,
  halfDepth: number,
  mass: number,
  restitution: number,
  friction: number,
  color?: string,
  velocity?: [number, number, number],
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'cuboid', params: { halfWidth, halfHeight, halfDepth } } as ColliderComponent,
    { type: 'material', color: color ?? DEFAULT_COLORS.box, roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: velocity ?? [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`box-${n}`, `方块-${n}`, components);
}

export function createCylinderEntity(
  halfHeight: number,
  radius: number,
  mass: number,
  restitution: number,
  friction: number,
  color?: string,
  velocity?: [number, number, number],
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'cylinder', params: { halfHeight, radius } } as ColliderComponent,
    { type: 'material', color: color ?? DEFAULT_COLORS.cylinder, roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: velocity ?? [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`cylinder-${n}`, `圆柱-${n}`, components);
}

export function createSlopeEntity(
  halfWidth: number,
  halfDepth: number,
  friction: number,
  color?: string,
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const halfHeight = 0.3; // 斜面是薄板 — 固定厚度 (per Phase 1 slope pattern)
  const components: Component[] = [
    {
      type: 'transform',
      position: position ?? [0, 5, 0],
      rotation: [0, 0, Math.PI / 6],  // 绕 Z 轴 30° — 标准斜面角度
      scale: [1, 1, 1],
    } as TransformComponent,
    { type: 'rigidBody', kind: 'fixed', mass: 0, restitution: 0.5, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'cuboid', params: { halfWidth, halfHeight, halfDepth } } as ColliderComponent,
    { type: 'material', color: color ?? DEFAULT_COLORS.slope, roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`slope-${n}`, `斜面-${n}`, components);
}

/** 重置全局计数器（仅用于测试） */
export function resetEntityCounter(): void {
  entityCounter = 0;
}

export function createSpringEntity(
  entityAId: string,
  entityBId: string,
  params?: Partial<SpringConstraintParams>,
): Entity {
  const n = nextNumber();
  const mergedParams: SpringConstraintParams = {
    ...DEFAULT_SPRING_PARAMS,
    ...params,
  };
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'spring',
    entityAId,
    entityBId,
    params: mergedParams,
  };
  return createEntity(`spring-${n}`, `弹簧-${n}`, [constraintComp]);
}

// ── Phase 3: ForceField 工厂 (D-03-01) ──

/**
 * 力场工厂的「额外参数」映射 — 按 kind 决定具体字段形状。
 * 与 ForceFieldComponent 判别联合保持一致（types.ts D-03-03）。
 */
export type ForceFieldKindParams = {
  uniform: Omit<UniformFieldComponent, 'type' | 'kind' | 'position' | 'range'>;
  gravity: Omit<GravityFieldComponent, 'type' | 'kind' | 'position' | 'range'>;
  electric: Omit<ElectricFieldComponent, 'type' | 'kind' | 'position' | 'range'>;
  magnetic: Omit<MagneticFieldComponent, 'type' | 'kind' | 'position' | 'range'>;
};

/**
 * 创建力场实体 (D-03-01)
 * 仅含 transform + forceField — 不参与碰撞，不参与 EntityRenderer。
 */
export function createForceFieldEntity<K extends ForceFieldKind>(
  kind: K,
  position: [number, number, number],
  range: number,
  params: ForceFieldKindParams[K],
): Entity {
  const n = nextNumber();
  const transformComp: TransformComponent = {
    type: 'transform',
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  const forceFieldComp = {
    type: 'forceField' as const,
    kind,
    position,
    range,
    ...params,
  } as ForceFieldComponent;
  return createEntity(
    `forcefield-${n}`,
    `力场-${kind}-${n}`,
    [transformComp, forceFieldComp],
  );
}
