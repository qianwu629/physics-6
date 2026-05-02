import type { StateCreator } from 'zustand';

/**
 * UI 状态切片
 *
 * 管理面板开关、对话框状态等纯 UI 状态。
 * 不与实体数据耦合——entitySlice 持有实体 CRUD 逻辑。
 */

export type ShapeType = 'sphere' | 'box' | 'cylinder' | 'slope';
export type SpringCreationStage = 'idle' | 'pendingA' | 'pendingB' | 'dialog';

export interface UiSlice {
  /** 左侧工具箱是否折叠 */
  toolboxCollapsed: boolean;
  /** 创建对话框是否打开 */
  dialogOpen: boolean;
  /** 创建对话框预选形状 (D-05: 点击工具箱按钮设置) */
  dialogDefaultShape: ShapeType;
  /** 删除确认对话框是否打开 */
  deleteDialogOpen: boolean;
  /** 右侧属性面板是否折叠 */
  propertyPanelCollapsed: boolean;

  // ── Phase 3: 弹簧创建状态机 + 环境面板 ──

  springCreationStage: SpringCreationStage;
  springEntityAId: string | null;
  springDialogOpen: boolean;
  environmentPanelOpen: boolean;

  // ── Actions ──

  toggleToolbox: () => void;
  openDialog: (shape: ShapeType) => void;
  closeDialog: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  /** 切换属性面板折叠状态 */
  togglePropertyPanel: () => void;

  // ── Spring Creation Actions ──

  enterSpringMode: () => void;
  exitSpringMode: () => void;
  selectSpringEndpointA: (id: string | null) => void;
  selectSpringEndpointB: (id: string) => void;
  openSpringDialog: () => void;
  closeSpringDialog: () => void;

  // ── Environment Panel Actions ──

  toggleEnvironmentPanel: () => void;
  closeEnvironmentPanel: () => void;
}

export type UiStore = UiSlice;

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  toolboxCollapsed: false,    // 默认展开 — 空场景引导用户使用
  dialogOpen: false,
  dialogDefaultShape: 'sphere',
  deleteDialogOpen: false,
  propertyPanelCollapsed: false,    // 默认展开 — 引导用户使用属性编辑

  // Phase 3 弹簧 + 环境
  springCreationStage: 'idle',
  springEntityAId: null,
  springDialogOpen: false,
  environmentPanelOpen: false,

  toggleToolbox: () => set((s) => ({ toolboxCollapsed: !s.toolboxCollapsed })),
  openDialog: (shape: ShapeType) => set({ dialogOpen: true, dialogDefaultShape: shape }),
  closeDialog: () => set({ dialogOpen: false }),
  openDeleteDialog: () => set({ deleteDialogOpen: true }),
  closeDeleteDialog: () => set({ deleteDialogOpen: false }),
  togglePropertyPanel: () => set((s) => ({ propertyPanelCollapsed: !s.propertyPanelCollapsed })),

  // ── Spring Creation Actions ──

  enterSpringMode: () => set({ springCreationStage: 'pendingA', springEntityAId: null }),
  exitSpringMode: () => set({ springCreationStage: 'idle', springEntityAId: null }),
  selectSpringEndpointA: (id) => set(id === null ? { springCreationStage: 'idle', springEntityAId: null } : { springCreationStage: 'pendingB', springEntityAId: id }),
  selectSpringEndpointB: (_id) => set({ springCreationStage: 'dialog', springDialogOpen: true }),
  openSpringDialog: () => set({ springDialogOpen: true }),
  closeSpringDialog: () => set({ springDialogOpen: false, springCreationStage: 'idle', springEntityAId: null }),

  // ── Environment Panel Actions ──

  toggleEnvironmentPanel: () => set((s) => ({ environmentPanelOpen: !s.environmentPanelOpen })),
  closeEnvironmentPanel: () => set({ environmentPanelOpen: false }),
});
