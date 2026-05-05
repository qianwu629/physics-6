import type { StateCreator } from 'zustand';

/**
 * 仿真控制状态切片
 *
 * Phase 1: 管理播放/暂停/重置/调试开关。
 * Phase 3: 新增 environment 全局环境参数（重力、摩擦倍率、弹性倍率、空气阻力）。
 * 注意：物理帧数据（物体位姿）不经过 Zustand（避免重渲染风暴——PITFALLS #6）。
 * 只有仿真控制元数据（运行状态、开关）通过 store 驱动 React UI。
 */

export interface EnvironmentState {
  gravity: [number, number, number];
  frictionScale: number;
  restitutionScale: number;
  drag: number;
  peReferenceY: number;
}

export const DEFAULT_ENVIRONMENT: EnvironmentState = {
  gravity: [0, -9.81, 0],
  frictionScale: 1.0,
  restitutionScale: 1.0,
  drag: 0.1,
  peReferenceY: 0,
};

export interface SimulationSlice {
  /** 仿真是否正在运行 — D-04: 初始 false（启动后暂停等待用户操作） */
  isRunning: boolean;
  /** 物理调试线框/碰撞体可视化 — D-07: 默认关闭 */
  showDebug: boolean;
  /** 当前实时帧率 */
  fps: number;
  /** 场景中动态物体数量 */
  objectCount: number;
  /** 重置计数器——递增时触发 Physics 组件 key 变化，强制重新挂载物理世界 */
  resetCounter: number;

  /** 全局环境参数 (Phase 3) */
  environment: EnvironmentState;

  // Actions
  /** 开始仿真 */
  play: () => void;
  /** 暂停仿真 */
  pause: () => void;
  /** 播放/暂停切换 */
  toggle: () => void;
  /** 重置仿真——递增 resetCounter 触发物理世界重新挂载，恢复所有物体到初始位置/速度 */
  reset: () => void;
  /** 切换物理调试线框显示 */
  setShowDebug: (value: boolean) => void;
  /** 更新 FPS 计数器 */
  setFps: (fps: number) => void;
  /** 设置物体数量 */
  setObjectCount: (count: number) => void;

  // ── Environment Actions (Phase 3) ──

  setGravity: (g: [number, number, number]) => void;
  setFrictionScale: (v: number) => void;
  setRestitutionScale: (v: number) => void;
  setDrag: (v: number) => void;
  resetEnvironment: () => void;
  setPeReferenceY: (y: number) => void;
}

export type SimulationStore = SimulationSlice;

export const createSimulationSlice: StateCreator<SimulationSlice, [], [], SimulationSlice> = (set) => ({
  // D-04: 初始状态为暂停——场景渲染但物理不运行，给用户时间观察初始布局
  isRunning: false,
  // D-07: 调试线框默认关闭
  showDebug: false,
  fps: 0,
  objectCount: 0,
  resetCounter: 0,
  environment: { ...DEFAULT_ENVIRONMENT },

  play: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  toggle: () => set((state) => ({ isRunning: !state.isRunning })),
  // D-04: reset 不触碰 environment（仅清空实体）
  reset: () => set((state) => ({ isRunning: false, resetCounter: state.resetCounter + 1 })),
  setShowDebug: (value) => set({ showDebug: value }),
  setFps: (fps) => set({ fps }),
  setObjectCount: (count) => set({ objectCount: count }),

  // ── Environment Actions ──
  setGravity: (g) => set((s) => ({ environment: { ...s.environment, gravity: [...g] } })),
  setFrictionScale: (v) => set((s) => ({ environment: { ...s.environment, frictionScale: v } })),
  setRestitutionScale: (v) => set((s) => ({ environment: { ...s.environment, restitutionScale: v } })),
  setDrag: (v) => set((s) => ({ environment: { ...s.environment, drag: v } })),
  resetEnvironment: () => set({ environment: { ...DEFAULT_ENVIRONMENT } }),
  setPeReferenceY: (y) => set((s) => ({ environment: { ...s.environment, peReferenceY: y } })),
});
