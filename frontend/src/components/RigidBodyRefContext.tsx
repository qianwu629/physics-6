import { createContext, useContext, type RefObject } from 'react';

/** RigidBody API 子集 — 覆盖本项目实际使用的 Rapier 方法 */
export interface RigidBodyAPI {
  translation(): { x: number; y: number; z: number };
  linvel(): { x: number; y: number; z: number };
  applyForce(force: { x: number; y: number; z: number }, wakeUp: boolean): void;
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
