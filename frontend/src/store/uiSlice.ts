import type { StateCreator } from 'zustand';
import type { ForceFieldKind } from '../ecs/types';
import type { BuilderState, PlacementSnapshot } from '../components/objectFactory';

/**
 * UI 状态切片
 *
 * 管理面板开关、对话框状态等纯 UI 状态。
 * 不与实体数据耦合——entitySlice 持有实体 CRUD 逻辑。
 */

export type SpringCreationStage = 'idle' | 'pendingA' | 'pendingB' | 'dialog';

export interface UiSlice {
  /** 删除确认对话框是否打开 */
  deleteDialogOpen: boolean;
  /** 右侧属性面板是否折叠 */
  propertyPanelCollapsed: boolean;

  // ── W8: 建造器对话框（物体/轨道）──
  objectBuilderOpen: boolean;
  trackBuilderOpen: boolean;

  // ── F3: 虚影放置（ObjectBuilder → 场景吸附放置）──
  /** 非 null 时处于放置模式：主场景显示虚影，鼠标吸附表面，滚轮调高度，左键落位，Esc 取消 */
  placement: PlacementSnapshot | null;

  // ── Phase 3: 环境面板 ──

  environmentPanelOpen: boolean;

  // ── W4: 固定连接创建状态机（与弹簧同构）──
  fixedJointStage: SpringCreationStage;
  fixedJointEntityAId: string | null;
  fixedJointEntityBId: string | null;
  fixedJointDialogOpen: boolean;

  // ── Phase 3 (03-03): 力场创建对话框 (D-03-04 / D-03-05) ──
  /** 力场创建对话框是否打开 */
  forceFieldDialogOpen: boolean;
  /** 当前预选的力场类型 (来自 Toolbox 按钮点击) */
  forceFieldDialogKind: ForceFieldKind | null;

  // ── Actions ──

  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  /** 切换属性面板折叠状态 */
  togglePropertyPanel: () => void;

  // ── W8 Builder Dialogs ──
  openObjectBuilder: () => void;
  closeObjectBuilder: () => void;
  openTrackBuilder: () => void;
  closeTrackBuilder: () => void;

  // ── F3 Placement Actions ──
  /** 进入虚影放置模式（关闭建造器对话框后由 PlacementGhost 接管） */
  startPlacement: (cfg: PlacementSnapshot) => void;
  /** 退出放置模式（落位确认或 Esc 取消后调用） */
  cancelPlacement: () => void;

  // ── Spring Creation Actions（已并入连接对话框，见 Fixed Joint Actions）──

  enterFixedJointMode: () => void;
  exitFixedJointMode: () => void;
  selectFixedJointEndpointA: (id: string | null) => void;
  selectFixedJointEndpointB: (id: string) => void;
  closeFixedJointDialog: () => void;

  // ── Environment Panel Actions ──

  toggleEnvironmentPanel: () => void;
  closeEnvironmentPanel: () => void;

  // ── Force Field Dialog Actions (D-03-04 / D-03-05) ──

  openForceFieldDialog: (kind: ForceFieldKind) => void;
  closeForceFieldDialog: () => void;
}

export type UiStore = UiSlice;

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  deleteDialogOpen: false,
  propertyPanelCollapsed: false,    // 默认展开 — 引导用户使用属性编辑

  // W8 建造器对话框
  objectBuilderOpen: false,
  trackBuilderOpen: false,

  // F3 虚影放置
  placement: null,

  // Phase 3 环境面板
  environmentPanelOpen: false,

  // W4 固定连接
  fixedJointStage: 'idle',
  fixedJointEntityAId: null,
  fixedJointEntityBId: null,
  fixedJointDialogOpen: false,

  // Phase 3 (03-03): 力场对话框
  forceFieldDialogOpen: false,
  forceFieldDialogKind: null,

  openDeleteDialog: () => set({ deleteDialogOpen: true }),
  closeDeleteDialog: () => set({ deleteDialogOpen: false }),
  togglePropertyPanel: () => set((s) => ({ propertyPanelCollapsed: !s.propertyPanelCollapsed })),

  // ── W8 Builder Dialogs ──
  openObjectBuilder: () => set({ objectBuilderOpen: true }),
  closeObjectBuilder: () => set({ objectBuilderOpen: false }),
  openTrackBuilder: () => set({ trackBuilderOpen: true }),
  closeTrackBuilder: () => set({ trackBuilderOpen: false }),

  // ── F3 Placement Actions ──
  startPlacement: (cfg) => set({ placement: cfg, objectBuilderOpen: false }),
  cancelPlacement: () => set({ placement: null }),

  // ── Fixed Joint Creation Actions (W4；弹簧/轻绳/轻杆同流程) ──

  enterFixedJointMode: () => set({ fixedJointStage: 'pendingA', fixedJointEntityAId: null, fixedJointEntityBId: null }),
  exitFixedJointMode: () => set({ fixedJointStage: 'idle', fixedJointEntityAId: null, fixedJointEntityBId: null }),
  selectFixedJointEndpointA: (id) => set(id === null ? { fixedJointStage: 'idle', fixedJointEntityAId: null } : { fixedJointStage: 'pendingB', fixedJointEntityAId: id }),
  selectFixedJointEndpointB: (id) => set({ fixedJointStage: 'dialog', fixedJointEntityBId: id, fixedJointDialogOpen: true }),
  closeFixedJointDialog: () => set({ fixedJointDialogOpen: false, fixedJointStage: 'idle', fixedJointEntityAId: null, fixedJointEntityBId: null }),

  // ── Environment Panel Actions ──

  toggleEnvironmentPanel: () => set((s) => ({ environmentPanelOpen: !s.environmentPanelOpen })),
  closeEnvironmentPanel: () => set({ environmentPanelOpen: false }),

  // ── Force Field Dialog Actions (D-03-04 / D-03-05) ──

  openForceFieldDialog: (kind: ForceFieldKind) =>
    set({ forceFieldDialogOpen: true, forceFieldDialogKind: kind }),
  closeForceFieldDialog: () =>
    set({ forceFieldDialogOpen: false, forceFieldDialogKind: null }),
});
