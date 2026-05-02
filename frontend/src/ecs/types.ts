/**
 * ECS 组件类型联合 — Phase 2 五件套 (D-02)
 * Transform | RigidBody | Collider | Velocity | Material
 */

export type ComponentType = 'transform' | 'rigidBody' | 'collider' | 'velocity' | 'material' | 'constraint';

export interface Component {
  type: ComponentType;
}

export interface TransformComponent extends Component {
  type: 'transform';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export type RigidBodyKind = 'dynamic' | 'fixed';

export interface RigidBodyComponent extends Component {
  type: 'rigidBody';
  kind: RigidBodyKind;
  mass: number;
  restitution: number;  // 0-1, 弹性系数
  friction: number;     // 0-1, 摩擦系数
}

export interface ColliderParams {
  radius?: number;      // sphere + cylinder
  halfWidth?: number;   // cuboid
  halfHeight?: number;  // cuboid + cylinder (半高)
  halfDepth?: number;   // cuboid
}

export type ColliderShape = 'sphere' | 'cuboid' | 'cylinder';

export interface ColliderComponent extends Component {
  type: 'collider';
  shape: ColliderShape;
  params: ColliderParams;
}

export interface VelocityComponent extends Component {
  type: 'velocity';
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
}

export interface MaterialComponent extends Component {
  type: 'material';
  color: string;       // hex string '#xxxxxx'
  roughness: number;   // 0-1, default 0.6
  metalness: number;   // 0-1, default 0.1
}

export type ConstraintKind = 'spring';  // Phase 3: 'spring' only — 预留 'revolute' | 'prismatic' | 'fixed'

export interface SpringConstraintParams {
  stiffness: number;   // k, N/m, 范围 1-1000
  restLength: number;  // L0, m, 范围 0.1-50
  damping: number;     // c, N·s/m, 范围 0-50
}

export interface ConstraintComponent extends Component {
  type: 'constraint';
  kind: ConstraintKind;
  entityAId: string;
  entityBId: string;
  params: SpringConstraintParams;
}

/**
 * Entity — ECS 场景图节点 (D-01, ARCHITECTURE.md Pattern 1)
 * 行为由其附加的组件集合决定 (DIF-01)
 */
export interface Entity {
  id: string;
  name: string;
  components: Map<ComponentType, Component>;
}

/** 所有组件类型的联合 */
export type AnyComponent =
  | TransformComponent
  | RigidBodyComponent
  | ColliderComponent
  | VelocityComponent
  | MaterialComponent
  | ConstraintComponent;
