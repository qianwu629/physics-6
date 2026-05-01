export type { MaterialComponent } from '../types';

/** Phase 2 默认实体颜色 — 柔和调色板 (UI-SPEC + Phase 1 延续) */
export const DEFAULT_COLORS: Record<string, string> = {
  sphere: '#f4a261',    // 珊瑚橙
  box: '#2a9d8f',       // 薄荷绿
  cylinder: '#457b9d',  // 天空蓝
  slope: '#9b5de5',     // 淡紫
};

export const DEFAULT_MATERIAL: Omit<MaterialComponent, 'type' | 'color'> = {
  roughness: 0.6,
  metalness: 0.1,
};
