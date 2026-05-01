export type { RigidBodyComponent, RigidBodyKind } from '../types';

export const DEFAULT_RIGID_BODY: Omit<RigidBodyComponent, 'type'> = {
  kind: 'dynamic',
  mass: 1.0,
  restitution: 0.5,
  friction: 0.3,
};
