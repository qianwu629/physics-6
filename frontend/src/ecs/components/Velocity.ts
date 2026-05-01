export type { VelocityComponent } from '../types';

export const DEFAULT_VELOCITY: Omit<VelocityComponent, 'type'> = {
  linearVelocity: [0, 0, 0],
  angularVelocity: [0, 0, 0],
};
