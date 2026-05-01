import type { TransformComponent } from '../types';
export type { TransformComponent };

export const DEFAULT_TRANSFORM: Omit<TransformComponent, 'type'> = {
  position: [0, 5, 0],     // D-05: 默认生成于场景中心
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};
