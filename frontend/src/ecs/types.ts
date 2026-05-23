/**
 * ECS 组件类型联合 — Phase 2 五件套 (D-02)
 * Transform | RigidBody | Collider | Velocity | Material
 */

export type ComponentType = AnyComponent['type'];

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
  charge: number;       // C, Phase 3 D-03-02: 电荷量，默认 0
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

export interface TrailComponent extends Component {
  type: 'trail';
  visible: boolean;
}

export interface VectorComponent extends Component {
  type: 'vector';
  showVelocity: boolean;
  showForces: boolean;
}

// ── Phase 3: ForceField 组件族 (D-03-01 / D-03-03) ──

export type ForceFieldKind = 'uniform' | 'gravity' | 'electric' | 'magnetic';

export interface BaseForceFieldComponent extends Component {
  type: 'forceField';
  kind: ForceFieldKind;
  position: [number, number, number];  // 力场中心位置
  range: number;                        // 作用半径 (m)
}

export interface UniformFieldComponent extends BaseForceFieldComponent {
  kind: 'uniform';
  direction: [number, number, number];  // 力方向
  strength: number;                     // 力强度 (N)
}

export interface GravityFieldComponent extends BaseForceFieldComponent {
  kind: 'gravity';
  strength: number;                     // G*M (N·m²)
  decay: boolean;                       // true: 1/r² 衰减；false: 恒定大小
}

export interface ElectricFieldComponent extends BaseForceFieldComponent {
  kind: 'electric';
  charge: number;                       // 场源电荷 Q (C)
  decay: boolean;                       // true: 1/r² 衰减
}

export interface MagneticFieldComponent extends BaseForceFieldComponent {
  kind: 'magnetic';
  direction: [number, number, number];  // B 场方向（内部归一化）
  strength: number;                     // B 场强度 (T)
}

export type ForceFieldComponent =
  | UniformFieldComponent
  | GravityFieldComponent
  | ElectricFieldComponent
  | MagneticFieldComponent;

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
  | ConstraintComponent
  | TrailComponent
  | VectorComponent
  | ForceFieldComponent;
