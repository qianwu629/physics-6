/**
 * objectFactory — 物体建造器共享的实体创建逻辑
 *
 * 从 ObjectBuilder 提取：BuilderState 类型、形状推导、合法性校验、
 * 「按 state 创建实体 + 面摩擦配置」的工厂函数。
 * ObjectBuilder（确认添加）与 PlacementGhost（虚影放置落位）共用，行为一致。
 */
import {
  createSphereEntity,
  createBoxEntity,
  createCylinderEntity,
  createWireEntity,
  createConvexEntity,
  attachFaces,
} from '../ecs/Entity';
import { getShapeFaces } from '../ecs/faceGeometry';
import {
  isConvexProfile,
  isValidRevolveProfile,
  type ProfilePoint,
} from '../ecs/profileGeometry';
import { saveProfile } from '../store/profileLibrary';
import type { ColliderShape, ColliderParams, FaceFriction, Entity } from '../ecs/types';

export type PresetKind = 'sphere' | 'box' | 'cylinder' | 'wire';

/** 面摩擦/固定覆盖（建造器右栏逐面编辑结果） */
export type FaceOverrides = Record<string, { friction: number; pinned: boolean }>;

/** 虚影放置快照：BuilderState + 面摩擦覆盖（放置模式跨组件传递） */
export interface PlacementSnapshot {
  state: BuilderState;
  faceOverrides: FaceOverrides;
}

export interface BuilderState {
  source: PresetKind | 'custom';
  // 尺寸
  radius: number;
  halfWidth: number;
  halfHeight: number;
  halfDepth: number;
  // 物理
  mass: number;
  restitution: number;
  friction: number; // 统一摩擦（各面默认值）
  charge: number;
  // 导线
  currentMagnitude: number;
  // 位置/初速度
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  // 自定义
  profile: ProfilePoint[];
  formMode: 'extrude' | 'revolve';
  thickness: number;
}

/** 形状/参数推导 */
export function deriveColliderShape(state: BuilderState): { shape: ColliderShape; params: ColliderParams } {
  switch (state.source) {
    case 'sphere':
      return { shape: 'sphere', params: { radius: state.radius } };
    case 'box':
      return { shape: 'cuboid', params: { halfWidth: state.halfWidth, halfHeight: state.halfHeight, halfDepth: state.halfDepth } };
    case 'cylinder':
    case 'wire':
      return { shape: 'cylinder', params: { radius: state.radius, halfHeight: state.halfHeight } };
    case 'custom':
      return {
        shape: 'convexProfile',
        params: {
          profile: state.profile,
          thickness: state.thickness,
          mode: state.formMode,
        },
      };
  }
}

export function isStateValid(state: BuilderState): { valid: boolean; reason: string | null } {
  if (state.source === 'custom') {
    if (state.profile.length < 3) return { valid: false, reason: '需要至少 3 个顶点' };
    const ok = state.formMode === 'revolve' ? isValidRevolveProfile(state.profile) : isConvexProfile(state.profile);
    if (!ok) {
      return {
        valid: false,
        reason: state.formMode === 'revolve' ? '轮廓必须为凸形且全在中心轴右侧' : '轮廓必须为凸形',
      };
    }
  }
  return { valid: true, reason: null };
}

/**
 * 按建造器状态创建实体（含面摩擦配置；自定义轮廓入库）。
 * position 覆盖 state.position（虚影放置落位用）。
 */
export function buildEntityFromState(
  state: BuilderState,
  faceOverrides: Record<string, { friction: number; pinned: boolean }>,
  position?: [number, number, number],
): Entity {
  const pos = position ?? state.position;
  let entity: Entity;
  switch (state.source) {
    case 'sphere':
      entity = createSphereEntity(state.radius, state.mass, state.restitution, state.friction, state.color, state.velocity, pos, state.charge);
      break;
    case 'box':
      entity = createBoxEntity(state.halfWidth, state.halfHeight, state.halfDepth, state.mass, state.restitution, state.friction, state.color, state.velocity, pos, state.charge);
      break;
    case 'cylinder':
      entity = createCylinderEntity(state.halfHeight, state.radius, state.mass, state.restitution, state.friction, state.color, state.velocity, pos, state.charge);
      break;
    case 'wire':
      entity = createWireEntity(state.radius, state.halfHeight, state.currentMagnitude, [0, 1, 0], state.color, pos);
      break;
    case 'custom': {
      entity = createConvexEntity(
        state.profile,
        state.formMode === 'extrude' ? state.thickness : 0,
        state.mass,
        state.restitution,
        state.friction,
        state.color,
        state.velocity,
        pos,
        state.charge,
        state.formMode,
      );
      // 新轮廓入库（library 来源的重复存也无妨——内容可能已被修改）
      saveProfile({
        name: `${state.formMode === 'revolve' ? '车削' : '挤出'}-${state.profile.length}边形`,
        profile: state.profile,
        mode: state.formMode,
        thickness: state.thickness,
      });
      break;
    }
  }

  // W8: 新实体默认挂 faces（导线除外 — 场源固定体不做面摩擦）
  if (state.source !== 'wire') {
    const { shape, params } = deriveColliderShape(state);
    const faceList = getShapeFaces(shape, params);
    if (faceList.length > 0) {
      const faces: FaceFriction[] = faceList.map((def) => ({
        id: def.id,
        label: def.label,
        friction: faceOverrides[def.id]?.friction ?? state.friction,
        pinned: faceOverrides[def.id]?.pinned ?? false,
      }));
      entity = attachFaces(entity, faces);
    }
  }

  return entity;
}
