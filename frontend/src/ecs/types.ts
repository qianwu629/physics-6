/**
 * ECS 组件类型定义 (D-02: 五件套组件集)
 *
 * 组件为纯数据结构——行为由 System 函数操作。
 * Phase 2: 作为场景定义的权威数据模型。
 */

export type ComponentType = 'transform' | 'rigidBody' | 'collider' | 'velocity' | 'material';

export interface Entity {
  /** 唯一标识符 */
  id: string;
  /** 人类可读名称 */
  name: string;
  /** 组件映射 (ComponentType → Component 联合类型) */
  components: Map<ComponentType, Component>;
}

/** 位置/旋转/缩放组件 */
export interface TransformComponent {
  type: 'transform';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

/** 刚体物理属性组件 */
export interface RigidBodyComponent {
  type: 'rigidBody';
  kind: 'dynamic' | 'fixed';
  mass: number;
  restitution: number;
  friction: number;
}

/** 碰撞体形状组件 */
export interface ColliderComponent {
  type: 'collider';
  shape: 'sphere' | 'cuboid' | 'cylinder';
  params: {
    radius?: number;
    halfWidth?: number;
    halfHeight?: number;
    halfDepth?: number;
  };
}

/** 初速度组件 */
export interface VelocityComponent {
  type: 'velocity';
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
}

/** 材质/渲染组件 */
export interface MaterialComponent {
  type: 'material';
  color: string;
  roughness: number;
  metalness: number;
}

/** 所有组件类型的联合类型 */
export type Component =
  | TransformComponent
  | RigidBodyComponent
  | ColliderComponent
  | VelocityComponent
  | MaterialComponent;
