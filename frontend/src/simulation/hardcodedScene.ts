import type { SceneObject } from './types';

/**
 * Phase 1 硬编码初始场景
 *
 * D-01: ~10+ 个随机物体，作为压力测试场景
 * D-02: 地面是隐式基础设施（由 Scene3D 组件直接创建，不在此列表中）
 * D-03: 每个物体随机分配柔和色彩（从预定义调色板选取）
 * D-12: 此硬编码场景仅用于 Phase 1 引擎验证，Phase 2 将替换为 UI 自由添加
 *
 * 柔和色彩调色板（设计为视觉差异明显但不刺眼）:
 *   珊瑚红 #e08a7d, 天空蓝 #7eb8da, 薄荷绿 #8fbc8f,
 *   暖橙 #f0a878, 薰衣草 #b8a0d0, 向日葵黄 #e8d878,
 *   玫瑰粉 #e8a0b8, 浅蓝灰 #90b8c8, 杏色 #e8c8a0,
 *   鼠尾草绿 #a0c8a8, 柔紫 #c0a8d8, 奶白 #e8e0d0
 */

export const INITIAL_SCENE_OBJECTS: SceneObject[] = [
  // ──── 球体 (3个，不同大小/高度) ────
  {
    id: 'ball-01',
    name: '大球',
    kind: 'dynamic',
    shape: 'sphere',
    shapeArgs: [1.0, 0, 0],           // radius=1.0
    position: [-3.5, 6.0, 0],
    rotation: [0, 0, 0],
    color: '#7eb8da',                  // 天空蓝
    restitution: 0.7,
  },
  {
    id: 'ball-02',
    name: '中球',
    kind: 'dynamic',
    shape: 'sphere',
    shapeArgs: [0.7, 0, 0],           // radius=0.7
    position: [0.5, 8.0, 1.5],
    rotation: [0, 0, 0],
    color: '#e8a0b8',                  // 玫瑰粉
    restitution: 0.6,
  },
  {
    id: 'ball-03',
    name: '小球',
    kind: 'dynamic',
    shape: 'sphere',
    shapeArgs: [0.4, 0, 0],           // radius=0.4
    position: [3.0, 10.0, -1.0],
    rotation: [0, 0, 0],
    color: '#f0a878',                  // 暖橙
    restitution: 0.85,
  },

  // ──── 方块 (4个，不同尺寸/位置，部分用于堆叠) ────
  {
    id: 'box-01',
    name: '大方块',
    kind: 'dynamic',
    shape: 'cuboid',
    shapeArgs: [1.5, 1.5, 1.5],       // 3x3x3
    position: [-5.0, 3.0, 0],
    rotation: [0, 0, 0],
    color: '#e08a7d',                  // 珊瑚红
    restitution: 0.3,
  },
  {
    id: 'box-02',
    name: '中方块',
    kind: 'dynamic',
    shape: 'cuboid',
    shapeArgs: [1.0, 0.8, 1.0],       // 2x1.6x2
    position: [-5.5, 6.5, 0],          // 叠在大方块上方
    rotation: [0, 0.3, 0],             // 轻微旋转，增加不稳定性
    color: '#b8a0d0',                  // 薰衣草
    restitution: 0.4,
  },
  {
    id: 'box-03',
    name: '扁方块',
    kind: 'dynamic',
    shape: 'cuboid',
    shapeArgs: [1.8, 0.4, 1.2],       // 扁长方体
    position: [4.0, 2.5, 0],
    rotation: [0, 0, 0.15],
    color: '#a0c8a8',                  // 鼠尾草绿
    restitution: 0.2,
  },
  {
    id: 'box-04',
    name: '高方块',
    kind: 'dynamic',
    shape: 'cuboid',
    shapeArgs: [0.6, 2.0, 0.6],       // 高柱形
    position: [-2.0, 1.5, 2.5],
    rotation: [0, 0, 0],
    color: '#e8d878',                  // 向日葵黄
    restitution: 0.35,
  },

  // ──── 圆柱体 (2个，会滚动的视觉元素) ────
  {
    id: 'cylinder-01',
    name: '大圆柱',
    kind: 'dynamic',
    shape: 'cylinder',
    shapeArgs: [1.2, 0.6, 0],         // halfHeight=1.2, radius=0.6
    position: [2.0, 5.0, 2.0],
    rotation: [0, 0, 0],
    color: '#90b8c8',                  // 浅蓝灰
    restitution: 0.5,
  },
  {
    id: 'cylinder-02',
    name: '小圆柱',
    kind: 'dynamic',
    shape: 'cylinder',
    shapeArgs: [0.8, 0.35, 0],        // halfHeight=0.8, radius=0.35
    position: [-3.0, 4.5, -2.0],
    rotation: [Math.PI / 2, 0, 0],     // 横放——会滚动！
    color: '#e8c8a0',                  // 杏色
    restitution: 0.55,
  },

  // ──── 静态斜面 (D-02: ground is infrastructure, static slopes are objects) ────
  {
    id: 'slope-01',
    name: '长斜面',
    kind: 'fixed',                     // 静态——不移动
    shape: 'cuboid',
    shapeArgs: [4.0, 0.3, 2.0],       // 薄长块
    position: [6.0, 0.5, 2.0],
    rotation: [0, 0, Math.PI / 6],     // 绕 Z 轴 30°
    color: '#c0a8d8',                  // 柔紫
    restitution: 0.5,
  },
  {
    id: 'slope-02',
    name: '短斜面',
    kind: 'fixed',                     // 静态
    shape: 'cuboid',
    shapeArgs: [2.5, 0.3, 1.5],
    position: [-6.0, 1.0, -1.5],
    rotation: [0, 0, -Math.PI / 8],    // 反方向
    color: '#8fbc8f',                  // 薄荷绿
    restitution: 0.5,
  },

  // ──── 静态平台 (额外水平平台，丰富场景层次) ────
  {
    id: 'platform-01',
    name: '小平板',
    kind: 'fixed',
    shape: 'cuboid',
    shapeArgs: [2.0, 0.3, 2.0],
    position: [0, 2.0, -3.0],
    rotation: [0, 0, 0],
    color: '#e8e0d0',                  // 奶白
    restitution: 0.4,
  },

  // ──── 额外动态物体 (增加碰撞多样性) ────
  {
    id: 'ball-04',
    name: '高速球',
    kind: 'dynamic',
    shape: 'sphere',
    shapeArgs: [0.55, 0, 0],
    position: [7.0, 9.0, -2.0],        // 从斜面上方高处释放
    rotation: [0, 0, 0],
    color: '#e0a070',                  // 暖杏色
    restitution: 0.9,                   // 高弹性——会有更多弹跳
  },
  {
    id: 'box-05',
    name: '超大块',
    kind: 'dynamic',
    shape: 'cuboid',
    shapeArgs: [2.0, 1.0, 2.0],       // 4x2x4 大方块
    position: [-1.0, 12.0, -2.5],      // 高处释放——大量动能
    rotation: [0, 0.2, 0.1],
    color: '#d0a0c0',                  // 浅粉紫
    restitution: 0.15,                  // 低弹性——落地冲击明显
  },
];

// 统计信息（运行时验证用）
export const SCENE_STATS = {
  totalObjects: INITIAL_SCENE_OBJECTS.length,
  dynamicCount: INITIAL_SCENE_OBJECTS.filter(o => o.kind === 'dynamic').length,
  fixedCount: INITIAL_SCENE_OBJECTS.filter(o => o.kind === 'fixed').length,
};
// 预期: totalObjects=14, dynamicCount=11, fixedCount=3
