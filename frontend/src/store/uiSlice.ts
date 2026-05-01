import type { StateCreator } from 'zustand';

/**
 * UI 状态切片
 *
 * 管理面板开关、对话框状态等纯 UI 状态。
 * 不与实体数据耦合——entitySlice 持有实体 CRUD 逻辑。
 */

export type ShapeType = 'sphere' | 'box' | 'cylinder' | 'slope';

export interface UiSlice {
  /** 左侧工具箱是否折叠 */
  toolboxCollapsed: boolean;
  /** 创建对话框是否打开 */
  dialogOpen: boolean;
  /** 创建对话框预选形状 (D-05: 点击工具箱按钮设置) */
  dialogDefaultShape: ShapeType;
  /** 删除确认对话框是否打开 */
  deleteDialogOpen: boolean;

  // ── Actions ──

  toggleToolbox: () => void;
  openDialog: (shape: ShapeType) => void;
  closeDialog: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
}

export type UiStore = UiSlice;

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  toolboxCollapsed: false,    // 默认展开 — 空场景引导用户使用
  dialogOpen: false,
  dialogDefaultShape: 'sphere',
  deleteDialogOpen: false,

  toggleToolbox: () => set((s) => ({ toolboxCollapsed: !s.toolboxCollapsed })),
  openDialog: (shape: ShapeType) => set({ dialogOpen: true, dialogDefaultShape: shape }),
  closeDialog: () => set({ dialogOpen: false }),
  openDeleteDialog: () => set({ deleteDialogOpen: true }),
  closeDeleteDialog: () => set({ deleteDialogOpen: false }),
});
