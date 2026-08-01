import type {
  Entity, Component, ComponentType,
  TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent,
  ConstraintComponent, TrailComponent, VectorComponent, SpringConstraintParams, FixedJointParams,
  RevoluteJointParams, SphericalJointParams, RopeJointParams, SpliceParams,
  ForceFieldKind, ForceFieldComponent,
  UniformFieldComponent, GravityFieldComponent, ElectricFieldComponent, MagneticFieldComponent,
  CurrentSourceComponent, FaceFriction,
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
  charge = 0,
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
      charge,
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
  charge = 0,
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction, charge } as RigidBodyComponent,
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
  charge = 0,
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction, charge } as RigidBodyComponent,
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
  angle = Math.PI / 6,
): Entity {
  const n = nextNumber();
  const halfHeight = 0.3; // 斜面是薄板 — 固定厚度 (per Phase 1 slope pattern)
  const components: Component[] = [
    {
      type: 'transform',
      position: position ?? [0, 5, 0],
      rotation: [0, 0, angle],  // 绕 Z 轴倾角（默认 30°）
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

/**
 * 为实体附加面摩擦/固定配置 (W3)
 * 不可变更新 collider 组件的 faces 字段；faces=undefined 时移除面配置（回退单面模式）。
 */
export function attachFaces(entity: Entity, faces: FaceFriction[] | undefined): Entity {
  const col = entity.components.get('collider');
  if (!col) return entity;
  const newComponents = new Map(entity.components);
  if (faces) {
    newComponents.set('collider', { ...col, faces } as Component);
  } else {
    const { faces: _dropped, ...rest } = col as ColliderComponent;
    newComponents.set('collider', { ...rest } as Component);
  }
  return { ...entity, components: newComponents };
}

/**
 * 创建载流导线实体 (Phase 8: 场-源关系)
 * fixed 圆柱 + currentSource 组件 — 等效无限长直导线产生环形磁场。
 * 默认半径 0.15、半高 3、电流方向 +y（调用方均可覆盖）。
 */
export function createWireEntity(
  radius: number,
  halfHeight: number,
  current: number,
  direction: [number, number, number],
  color?: string,
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'fixed', mass: 1, restitution: 0.5, friction: 0.3, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'cylinder', params: { halfHeight, radius } } as ColliderComponent,
    { type: 'material', color: color ?? '#888888', roughness: 0.4, metalness: 0.8 } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
    { type: 'currentSource', magnitude: current, direction } as CurrentSourceComponent,
  ];
  return createEntity(`wire-${n}`, `导线-${n}`, components);
}

/**
 * 创建自定义凸形实体（2D 轮廓成型 → 凸包）
 * collider.params 存源轮廓 + 成型参数（mode: 'extrude' 挤出 / 'revolve' 车削），
 * 视觉/碰撞由同一数据派生。车削时 thickness 不使用（传 0 占位）。
 */
export function createConvexEntity(
  profile: [number, number][],
  thickness: number,
  mass: number,
  restitution: number,
  friction: number,
  color?: string,
  velocity?: [number, number, number],
  position?: [number, number, number],
  charge = 0,
  mode: 'extrude' | 'revolve' = 'extrude',
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'dynamic', mass, restitution, friction, charge } as RigidBodyComponent,
    { type: 'collider', shape: 'convexProfile', params: { profile, thickness, mode } } as ColliderComponent,
    { type: 'material', color: color ?? '#2a9d8f', roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: velocity ?? [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`convex-${n}`, `凸形-${n}`, components);
}

/** 创建平面轨道（薄板，fixed；面摩擦由调用方 attachFaces 配置） */
export function createPlaneTrackEntity(
  halfWidth: number,
  halfDepth: number,
  friction: number,
  color?: string,
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'fixed', mass: 0, restitution: 0.5, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'cuboid', params: { halfWidth, halfHeight: 0.15, halfDepth } } as ColliderComponent,
    { type: 'material', color: color ?? '#8b7fd4', roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`track-plane-${n}`, `平面轨道-${n}`, components);
}

/** 创建圆弧轨道（环形扇区，fixed；楔块分解凸碰撞体） */
export function createArcTrackEntity(
  innerR: number,
  thickness: number,
  arcAngleDeg: number,
  width: number,
  friction: number,
  color?: string,
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'fixed', mass: 0, restitution: 0.5, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'arc', params: { innerR, thickness, arcAngle: arcAngleDeg, width } } as ColliderComponent,
    { type: 'material', color: color ?? '#8b7fd4', roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`track-arc-${n}`, `圆弧轨道-${n}`, components);
}

/** 创建双弧圆轨道（同圆心内外两道环壁形成环形通道，fixed；楔块分解凸碰撞体） */
export function createDoubleArcTrackEntity(
  innerR: number,
  channelGap: number,
  thickness: number,
  arcAngleDeg: number,
  width: number,
  friction: number,
  color?: string,
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'fixed', mass: 0, restitution: 0.5, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'doubleArc', params: { innerR, channelGap, thickness, arcAngle: arcAngleDeg, width } } as ColliderComponent,
    { type: 'material', color: color ?? '#8b7fd4', roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`track-ring-${n}`, `双弧轨道-${n}`, components);
}

/** 创建楔形斜面轨道（梯形凸体，fixed；薄端在 +x 局部方向） */
export function createWedgeTrackEntity(
  profile: [number, number][],
  halfDepth: number,
  friction: number,
  color?: string,
  position?: [number, number, number],
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: position ?? [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'fixed', mass: 0, restitution: 0.5, friction, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'convexProfile', params: { profile, thickness: halfDepth * 2, mode: 'extrude' } } as ColliderComponent,
    { type: 'material', color: color ?? '#8b7fd4', roughness: DEFAULT_MATERIAL.roughness, metalness: DEFAULT_MATERIAL.metalness } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`track-slope-${n}`, `斜面轨道-${n}`, components);
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

/**
 * 创建固定关节约束实体 (W4)
 * 锚点应在创建时由调用方按两体当前位姿换算为各自局部坐标。
 */
export function createFixedJointEntity(
  entityAId: string,
  entityBId: string,
  params: FixedJointParams,
): Entity {
  const n = nextNumber();
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'fixed',
    entityAId,
    entityBId,
    params,
  };
  return createEntity(`joint-${n}`, `连接-${n}`, [constraintComp]);
}

/** 创建铰链关节约束实体（二期）：绕共享轴相对旋转 */
export function createRevoluteJointEntity(
  entityAId: string,
  entityBId: string,
  params: RevoluteJointParams,
): Entity {
  const n = nextNumber();
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'revolute',
    entityAId,
    entityBId,
    params,
  };
  return createEntity(`joint-${n}`, `铰链-${n}`, [constraintComp]);
}

/** 创建球窝关节约束实体（二期）：锚点重合，全向旋转 */
export function createSphericalJointEntity(
  entityAId: string,
  entityBId: string,
  params: SphericalJointParams,
): Entity {
  const n = nextNumber();
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'spherical',
    entityAId,
    entityBId,
    params,
  };
  return createEntity(`joint-${n}`, `球窝-${n}`, [constraintComp]);
}

/** 创建轻绳约束实体（W8）：只受拉的最大距离约束 */
export function createRopeJointEntity(
  entityAId: string,
  entityBId: string,
  params: RopeJointParams,
): Entity {
  const n = nextNumber();
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'rope',
    entityAId,
    entityBId,
    params,
  };
  return createEntity(`joint-${n}`, `轻绳-${n}`, [constraintComp]);
}

/** 创建轨道拼接约束实体（P5）：接缝损耗 + 拼接关系 */
export function createSpliceEntity(
  masterTrackId: string,
  newTrackId: string,
  params: SpliceParams,
): Entity {
  const n = nextNumber();
  const constraintComp: ConstraintComponent = {
    type: 'constraint',
    kind: 'splice',
    entityAId: masterTrackId,
    entityBId: newTrackId,
    params,
  };
  return createEntity(`splice-${n}`, `拼接-${n}`, [constraintComp]);
}

/**
 * 创建轻杆连杆实体（W8）：无质量刚性连杆（拉压双向）。
 * 细圆柱 dynamic 体、质量 0.01；两端通过球窝关节与被连物体相接（调用方创建）。
 * @param center   杆中心（世界坐标）
 * @param rotation 杆轴向（欧拉角，由 AB 方向换算）
 * @param length   杆长 (m)
 */
export function createRodLinkEntity(
  center: [number, number, number],
  rotation: [number, number, number],
  length: number,
): Entity {
  const n = nextNumber();
  const components: Component[] = [
    { type: 'transform', position: center, rotation, scale: [1, 1, 1] } as TransformComponent,
    { type: 'rigidBody', kind: 'dynamic', mass: 0.01, restitution: 0.1, friction: 0.3, charge: 0 } as RigidBodyComponent,
    { type: 'collider', shape: 'cylinder', params: { halfHeight: length / 2, radius: 0.05 } } as ColliderComponent,
    { type: 'material', color: '#c0c8d0', roughness: 0.5, metalness: 0.6 } as MaterialComponent,
    { type: 'velocity', linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] } as VelocityComponent,
  ];
  return createEntity(`rod-${n}`, `轻杆-${n}`, components);
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
