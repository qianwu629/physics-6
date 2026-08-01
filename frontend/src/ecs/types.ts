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
  // ── convexProfile（Phase 10 自定义凸形）：存源数据，几何/碰撞从它派生 ──
  profile?: [number, number][];  // 2D 轮廓顶点（XY 平面，凸多边形）
  thickness?: number;            // 挤出厚度 (m)；arc：环扇厚度 (m)
  mode?: 'extrude' | 'revolve';  // 成型方式（revolve 为二期车削预留）
  // ── arc（圆弧轨道）：环形扇区，按段分解凸楔块 ──
  innerR?: number;      // 内弧半径 (m)；doubleArc：内环壁接触面半径
  arcAngle?: number;    // 弧角（度，关于 +Y 轴对称；doubleArc 可到 360 整环）
  width?: number;       // 轨道宽度（Z 方向, m）
  segments?: number;    // 分解段数（arc 默认 12；doubleArc 默认 48）
  // ── doubleArc（双弧圆轨道）：同圆心内外两道环壁形成环形通道 ──
  channelGap?: number;  // 通道宽度 = 内外环壁间距（内径, m）
}

export type ColliderShape = 'sphere' | 'cuboid' | 'cylinder' | 'convexProfile' | 'arc' | 'doubleArc';

/**
 * 面摩擦配置（W3：面级摩擦/固定）
 * 缺省时回退到 rigidBody.friction 单面模式（旧场景兼容）。
 */
export interface FaceFriction {
  id: string;        // 面标识：'top' | 'bottom' | 'side-0' | 'surface' | ...
  label: string;     // 显示名（'上面' / '侧面 1' / ...）
  friction: number;  // 该面摩擦系数（接触摩擦 = 两面系数相乘）
  pinned: boolean;   // 固定面 → 摩擦视为 ∞（实现 1e6），接触点不发生相对滑动
}

export interface ColliderComponent extends Component {
  type: 'collider';
  shape: ColliderShape;
  params: ColliderParams;
  faces?: FaceFriction[];  // 面摩擦/固定配置（可选，缺省 = 单面模式）
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

export type ConstraintKind = 'spring' | 'fixed' | 'revolute' | 'spherical' | 'rope' | 'splice';

export interface SpringConstraintParams {
  stiffness: number;   // k, N/m, 范围 1-1000
  restLength: number;  // L0, m, 范围 0.1-50
  damping: number;     // c, N·s/m, 范围 0-50
}

/** 固定关节参数（W4）：两刚体相对位姿锁定（Rapier fixed joint，锚点为各自局部坐标） */
export interface FixedJointParams {
  anchorA: [number, number, number];        // A 局部锚点
  anchorB: [number, number, number];        // B 局部锚点
  frameB: [number, number, number, number]; // B 局部坐标架的旋转（四元数 qB⁻¹·qA，保持创建时相对姿态）
  showLink?: boolean;                       // 连接线可视化开关（默认 true）
}

/** 铰链关节参数（二期）：绕共享轴的相对旋转（门/轮/摆） */
export interface RevoluteJointParams {
  anchorA: [number, number, number];  // A 局部锚点
  anchorB: [number, number, number];  // B 局部锚点
  axisA: [number, number, number];    // A 局部铰链轴（创建时由世界轴逆旋转得到）
  axisB: [number, number, number];    // B 局部铰链轴（存档；Rapier revolute 使用共享轴 axisA）
  showLink?: boolean;
}

/** 球窝关节参数（二期）：锚点重合，全向旋转（钟摆/球铰链） */
export interface SphericalJointParams {
  anchorA: [number, number, number];
  anchorB: [number, number, number];
  showLink?: boolean;
}

/** 轻绳参数（W8）：只受拉的最大距离约束（松弛下垂，不可推） */
export interface RopeJointParams {
  anchorA: [number, number, number];
  anchorB: [number, number, number];
  length: number;        // 最大绳长 (m)
  showLink?: boolean;
}

/** 轨道拼接参数（P5）：接缝检测盒 + 通过损耗 */
export interface SpliceParams {
  faceId: string;                          // 母版被拼的拼接面
  center: [number, number, number];        // 接缝中心（世界）
  normal: [number, number, number];        // 接缝法线（世界）
  halfExtents: [number, number, number];   // 检测盒半尺寸（seam 局部系：x=法线薄壳, y=竖直, z=面宽）
  quaternion: [number, number, number, number]; // seam 局部系旋转（+x 对齐法线）
  lossType: 'value' | 'percent';           // 数值损耗 / 百分比损耗
  loss: number;                            // 损耗量（value: m/s；percent: 0-1）
  showLink?: boolean;                      // 接缝标记显示开关（默认 true）
}

export interface SpringConstraintComponent extends Component {
  type: 'constraint';
  kind: 'spring';
  entityAId: string;
  entityBId: string;
  params: SpringConstraintParams;
}

export interface FixedJointComponent extends Component {
  type: 'constraint';
  kind: 'fixed';
  entityAId: string;
  entityBId: string;
  params: FixedJointParams;
}

export interface RevoluteJointComponent extends Component {
  type: 'constraint';
  kind: 'revolute';
  entityAId: string;
  entityBId: string;
  params: RevoluteJointParams;
}

export interface SphericalJointComponent extends Component {
  type: 'constraint';
  kind: 'spherical';
  entityAId: string;
  entityBId: string;
  params: SphericalJointParams;
}

export interface RopeJointComponent extends Component {
  type: 'constraint';
  kind: 'rope';
  entityAId: string;
  entityBId: string;
  params: RopeJointParams;
}

export interface SpliceComponent extends Component {
  type: 'constraint';
  kind: 'splice';
  entityAId: string;  // 母版轨道
  entityBId: string;  // 新拼接轨道
  params: SpliceParams;
}

export type ConstraintComponent =
  | SpringConstraintComponent
  | FixedJointComponent
  | RevoluteJointComponent
  | SphericalJointComponent
  | RopeJointComponent
  | SpliceComponent;

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

// ── Phase 8: CurrentSource 组件 — 场-源关系 ──
// 电荷源无需组件：任何 charge≠0 的 rigidBody 实体自动成为库仑场源（同号相斥、异号相吸）。
// 电流源等效为无限长直导线（毕奥-萨伐尔简化），典型用法：fixed 圆柱 + 本组件。

export interface CurrentSourceComponent extends Component {
  type: 'currentSource';
  magnitude: number;                    // 电流大小 (A)，负值表示反向
  direction: [number, number, number];  // 电流方向（世界坐标系）
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
  | ConstraintComponent
  | TrailComponent
  | VectorComponent
  | ForceFieldComponent
  | CurrentSourceComponent;
