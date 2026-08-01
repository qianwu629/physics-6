import { createContext, useContext, type RefObject } from 'react';

/** RigidBody API 子集 — 覆盖本项目实际使用的 Rapier 方法 */
export interface RigidBodyAPI {
  translation(): { x: number; y: number; z: number };
  rotation(): { x: number; y: number; z: number; w: number };
  linvel(): { x: number; y: number; z: number };
  setLinvel(vel: { x: number; y: number; z: number }, wakeUp: boolean): void;
  addForce(force: { x: number; y: number; z: number }, wakeUp: boolean): void;
  applyImpulse(impulse: { x: number; y: number; z: number }, wakeUp: boolean): void;
  mass(): number;
  setAdditionalMass(mass: number, wakeUp: boolean): void;
  setLinearDamping(damping: number): void;
  setAngularDamping(damping: number): void;
  numColliders(): number;
  collider(index: number): {
    setRestitution(restitution: number): void;
    setFriction(friction: number): void;
  };
}

/**
 * 模块级活体注册表（仿 contactForceStore 模式）：
 * Canvas 外的组件（如 FixedJointDialog）可经此读取实体当前位姿，
 * 避免使用过期的 ECS store 初始位姿计算关节锚点。
 */
const liveBodies = new Map<string, RefObject<RigidBodyAPI | null>>();

export function registerLiveBody(entityId: string, ref: RefObject<RigidBodyAPI | null>): void {
  liveBodies.set(entityId, ref);
}

export function unregisterLiveBody(entityId: string): void {
  liveBodies.delete(entityId);
}

/** Canvas 外读取实体活体 RigidBody（可能 undefined：未注册或已卸载） */
export function getLiveRigidBodyRef(entityId: string): RefObject<RigidBodyAPI | null> | undefined {
  return liveBodies.get(entityId);
}

/** 共享 RigidBody ref 注册表，让 SpringRenderer 能获取其他 Entity 的物理体引用 */
export const RigidBodyRefContext = createContext<{
  register: (entityId: string, ref: RefObject<RigidBodyAPI | null>) => void;
  unregister: (entityId: string) => void;
  getRef: (entityId: string) => RefObject<RigidBodyAPI | null> | undefined;
}>({
  register: () => {},
  unregister: () => {},
  getRef: () => undefined,
});

export function useRigidBodyRefRegistry() {
  return useContext(RigidBodyRefContext);
}
