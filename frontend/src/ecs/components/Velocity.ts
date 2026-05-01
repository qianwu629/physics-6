import type { VelocityComponent } from '../types';
export type { VelocityComponent };

export const DEFAULT_VELOCITY: Omit<VelocityComponent, 'type'> = {
  linearVelocity: [0, 0, 0],
  angularVelocity: [0, 0, 0],
};
