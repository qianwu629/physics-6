/**
 * Entity 工厂函数 (D-02: 组件式实体创建)
 *
 * 提供类型安全的实体创建，自动填充默认组件值。
 * 每个实体在创建时自动获取完整的 Transform + RigidBody + Collider + Velocity + Material 组件集。
 */

import type { Entity, ComponentType, Component } from './types';
import type { TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent } from './types';

/** 全局实体计数器——确保唯一 ID */
let entityCounter = 0;

/** 重置实体计数器 (用于测试隔离) */
export function resetEntityCounter(): void {
  entityCounter = 0;
}

/** 基础实体创建——填充默认组件 */
export function createEntity(
  name: string,
  components: Map<ComponentType, Component>,
): Entity {
  entityCounter++;
  return {
    id: `entity-${entityCounter}`,
    name,
    components,
  };
}

/** 创建默认 Transform 组件 */
function makeTransform(x = 0, y = 5, z = 0): TransformComponent {
  return {
    type: 'transform',
    position: [x, y, z],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

/** 创建默认 RigidBody 组件 */
function makeRigidBody(mass: number, restitution = 0.5, friction = 0.3): RigidBodyComponent {
  return {
    type: 'rigidBody',
    kind: 'dynamic',
    mass,
    restitution,
    friction,
  };
}

/** 创建默认 Velocity 组件 */
function makeVelocity(): VelocityComponent {
  return {
    type: 'velocity',
    linearVelocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
  };
}

/** 创建默认 Material 组件 */
function makeMaterial(color = '#4488ff'): MaterialComponent {
  return {
    type: 'material',
    color,
    roughness: 0.4,
    metalness: 0.1,
  };
}

/** 创建球体实体 */
export function createSphereEntity(
  radius: number,
  mass: number,
  restitution = 0.5,
  friction = 0.3,
  color?: string,
): Entity {
  const collider: ColliderComponent = {
    type: 'collider',
    shape: 'sphere',
    params: { radius },
  };
  const components = new Map<ComponentType, Component>();
  components.set('transform', makeTransform());
  components.set('rigidBody', makeRigidBody(mass, restitution, friction));
  components.set('collider', collider);
  components.set('velocity', makeVelocity());
  components.set('material', makeMaterial(color));
  return createEntity(`球体-${entityCounter + 1}`, components);
}

/** 创建立方体实体 */
export function createBoxEntity(
  halfWidth: number,
  halfHeight: number,
  halfDepth: number,
  mass: number,
  restitution = 0.5,
  friction = 0.3,
  color?: string,
): Entity {
  const collider: ColliderComponent = {
    type: 'collider',
    shape: 'cuboid',
    params: { halfWidth, halfHeight, halfDepth },
  };
  const components = new Map<ComponentType, Component>();
  components.set('transform', makeTransform());
  components.set('rigidBody', makeRigidBody(mass, restitution, friction));
  components.set('collider', collider);
  components.set('velocity', makeVelocity());
  components.set('material', makeMaterial(color));
  return createEntity(`方块-${entityCounter + 1}`, components);
}

/** 创建圆柱体实体 */
export function createCylinderEntity(
  halfHeight: number,
  radius: number,
  mass: number,
  restitution = 0.5,
  friction = 0.3,
  color?: string,
): Entity {
  const collider: ColliderComponent = {
    type: 'collider',
    shape: 'cylinder',
    params: { radius, halfHeight },
  };
  const components = new Map<ComponentType, Component>();
  components.set('transform', makeTransform());
  components.set('rigidBody', makeRigidBody(mass, restitution, friction));
  components.set('collider', collider);
  components.set('velocity', makeVelocity());
  components.set('material', makeMaterial(color));
  return createEntity(`圆柱-${entityCounter + 1}`, components);
}

/** 创建斜面实体 */
export function createSlopeEntity(
  halfWidth: number,
  halfHeight: number,
  halfDepth: number,
  mass: number,
  restitution = 0.5,
  friction = 0.3,
  color?: string,
): Entity {
  const collider: ColliderComponent = {
    type: 'collider',
    shape: 'cuboid',
    params: { halfWidth, halfHeight, halfDepth },
  };
  const components = new Map<ComponentType, Component>();
  components.set('transform', makeTransform());
  components.set('rigidBody', makeRigidBody(mass, restitution, friction));
  components.set('collider', collider);
  components.set('velocity', makeVelocity());
  components.set('material', makeMaterial(color ?? '#999999'));
  return createEntity(`斜面-${entityCounter + 1}`, components);
}
