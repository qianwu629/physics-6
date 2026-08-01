import type { RigidBodyComponent, RigidBodyKind } from '../types';
export type { RigidBodyComponent, RigidBodyKind };

export const DEFAULT_RIGID_BODY: Omit<RigidBodyComponent, 'type'> = {
  kind: 'dynamic',
  mass: 1.0,
  restitution: 0.5,
  friction: 0.3,
  charge: 0,
};
