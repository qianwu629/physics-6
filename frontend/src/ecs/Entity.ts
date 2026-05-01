import type { Entity, Component, ComponentType, TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent } from './types';
import { DEFAULT_COLORS, DEFAULT_MATERIAL } from './components/Material';

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
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction } as RigidBodyComponent,
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
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction } as RigidBodyComponent,
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
    { type: 'rigidBody', kind: 'fixed', mass: 0, restitution: 0.5, friction } as RigidBodyComponent,
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
