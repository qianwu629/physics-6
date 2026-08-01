import { useState, useEffect, useCallback, useRef } from 'react';
import { useSimulationStore } from '../store';
import Toolbar from './Toolbar';
import ObjectBuilder from './ObjectBuilder';
import TrackBuilder from './TrackBuilder';
import FixedJointBanner from './FixedJointBanner';
import FixedJointDialog from './FixedJointDialog';
import ForceFieldDialog from './ForceFieldDialog';
import CreationDock from './CreationDock';
import LoadingScreen from './LoadingScreen';
import ErrorFallback from './ErrorFallback';
import type { ErrorType } from './ErrorFallback';
// Phase 1: 持久化与场景库组件
import MenuBar from './MenuBar';
import SnapshotManager from './SnapshotManager';
import type { Snapshot } from '../store/snapshotSlice';
import PresetSelector from './PresetSelector';
import { SceneBanner, ConfirmDialogRoot, loadSceneWithConfirm, useSceneBanner } from './SceneLoader';
import { deserializeScene } from '../utils/sceneSerializer';
// Ticket 1: 停靠布局壳
import { DockApiProvider, useDock } from './dock/DockApiContext';
import DockShell from './dock/DockShell';

/**
 * App — Phase 2 应用根组件
 *
 * 负责:
 * 1. WASM 引擎初始化协调 (Rapier.init())
 * 2. WebGL 可用性检测 (canvas.getContext('webgl2'))
 * 3. 键盘快捷键注册 (D-08 + Phase 2: Space, R, B, N, C, S, Delete, Backspace)
 * 4. 页面可见性变化处理 (PITFALLS #1: 切标签页自动暂停)
 * 5. 加载/错误/正常状态的渲染切换
 * 6. 4 层 z-index 布局 (Toolbar/Canvas/Toolbox+PropertyPanel/Dialogs)
 *
 * 状态机:
 *   init → WebGL 检测 → WASM 加载 → ready (渲染场景 + 工具栏 + 工具箱 + 属性面板)
 *              ↓ 失败              ↓ 失败
 *         ErrorFallback(webgl)  ErrorFallback(wasm)
 *
 * D-04: 就绪后场景渲染但物理暂停——用户需手动点击播放。
 * D-06: 初始状态为空场景（无硬编码物体）。
 * D-11: WASM 加载期间显示 LoadingScreen。
 */

type AppState = 'loading' | 'error' | 'ready';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);

  // Phase 1: 快照 Drawer + 预设 Dialog 开关状态
  const [snapshotDrawerOpen, setSnapshotDrawerOpen] = useState(false);
  const [presetSelectorOpen, setPresetSelectorOpen] = useState(false);

  // ──── 步骤 1: WebGL 可用性检测 ────
  const checkWebGL = useCallback((): boolean => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      return gl !== null;
    } catch {
      return false;
    }
  }, []);

  // ──── 启动初始化流程 ────
  useEffect(() => {
    if (!checkWebGL()) {
      setErrorType('webgl');
      setAppState('error');
      return;
    }
    // 不再手动初始化 Rapier——@react-three/rapier 的 <Physics> 内部自行处理 WASM 加载。
    // 使用 Suspense 边界在 Physics 挂起时显示 LoadingScreen。
    setAppState('ready');
  }, [checkWebGL]);

  // ──── 键盘快捷键 (D-08) ────
  // Use ref to cache the latest handler so effect only subscribes once
  const handleKeyDownRef = useRef((e: KeyboardEvent) => {
    // 忽略输入框内按键
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        useSimulationStore.getState().toggle();
        break;
      case 'KeyR':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const state = useSimulationStore.getState();
          state.resetEntities();
          state.reset();
        }
        break;
      // ── W8: 物体建造器快捷键（B = 打开建造器；形状在建造器内选择）──
      case 'KeyB':
        e.preventDefault();
        useSimulationStore.getState().openObjectBuilder();
        break;
      // ── Phase 2: 删除实体快捷键 (D-11) ──
      case 'Delete':
      case 'Backspace': {
        const sid = useSimulationStore.getState().selectedEntityId;
        if (sid) {
          e.preventDefault();
          useSimulationStore.getState().openDeleteDialog();
        }
        break;
      }
      // ── Phase 3: 连接模式快捷键（K）──
      case 'KeyK':
        e.preventDefault();
        {
          const stage = useSimulationStore.getState().fixedJointStage;
          if (stage === 'idle') {
            useSimulationStore.getState().enterFixedJointMode();
          } else {
            useSimulationStore.getState().exitFixedJointMode();
          }
        }
        break;
      case 'Escape':
        {
          const jointStage = useSimulationStore.getState().fixedJointStage;
          if (jointStage !== 'idle') {
            e.preventDefault();
            useSimulationStore.getState().exitFixedJointMode();
          }
        }
        break;
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ──── 重置计数器监听 (D-12: 工具栏重置按钮也需清空实体) ────
  // 注意：KeyR 的 handler 中已经调用了 state.resetEntities() + state.reset()，
  // reset() 会递增 resetCounter。为避免双重调用，订阅中仅处理非键盘触发的 resetCounter 变化。
  useEffect(() => {
    const unsub = useSimulationStore.subscribe(
      (state, prev) => {
        if (state.resetCounter > prev.resetCounter) {
          state.resetEntities();
        }
      }
    );
    return unsub;
  }, []);

  // ──── 切标签页保护 (PITFALLS #1) ────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const store = useSimulationStore.getState();
        if (store.isRunning) {
          store.pause();               // 自动暂停
        }
      }
      // 切回时不会自动恢复——用户需手动播放
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ──── MenuBar 引入后调整 Toolbar 顶部偏移 (Phase 1 Plan 05) ────
  // MenuBar 高度 36px (h-9) + 固定定位 z-50; Toolbar 原有 top-4 (16px) 会与 MenuBar 重叠
  // 通过 CSS 注入将 Toolbar 下移，为 MenuBar 腾出空间
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'phase1-menu-offset';
    style.textContent = `
      [data-toolbar] { top: 44px !important; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('phase1-menu-offset');
      if (el) el.remove();
    };
  }, []);

  // ──── 状态机渲染 ────
  if (appState === 'error' && errorType) {
    return <ErrorFallback type={errorType} />;
  }

  if (appState === 'loading') {
    return <LoadingScreen />;
  }

  // appState === 'ready' — dock 停靠布局壳（Scene3D 为中央视口面板）
  // CR-01 fix: Suspense 边界捕获 @react-three/rapier 的 WASM 加载挂起状态（Scene3D 在 dock 视口面板内）
  return (
    <DockApiProvider>
      {/* Phase 1: MenuBar — 固定在页面顶部 z-50 */}
      <MenuBar
        onOpenSnapshots={() => setSnapshotDrawerOpen(true)}
        onOpenPresets={() => setPresetSelectorOpen(true)}
      />

      {/* Phase 1: SceneBanner — schema 版本不匹配等警告 (黄色横幅) */}
      <SceneBanner />

      {/* Phase 1: ConfirmDialogRoot — 全局确认对话框 (加载/覆盖/删除确认) */}
      <ConfirmDialogRoot />

      {/* Phase 1: SnapshotManager Drawer (Sheet side="right") — 由 MenuBar 触发 */}
      <SnapshotManager
        open={snapshotDrawerOpen}
        onOpenChange={setSnapshotDrawerOpen}
        onLoadSnapshot={async (snapshot: Snapshot) => {
          const sceneJSON = {
            schemaVersion: '1.0',
            savedAt: snapshot.createdAt,
            simulation: {
              environment: snapshot.data.environment,
              entities: snapshot.data.entities,
              constraints: snapshot.data.constraints,
            },
          };
          const result = deserializeScene(sceneJSON);
          if (result.success && result.data) {
            await loadSceneWithConfirm(result.data);
          } else {
            // WR-05: Handle deserializeScene failure
            const { addWarning } = useSceneBanner.getState?.() || {};
            result.errors.forEach((e) => addWarning?.(e));
          }
        }}
      />

      {/* Phase 1: PresetSelector Dialog — 由 MenuBar 触发 */}
      <PresetSelector
        open={presetSelectorOpen}
        onOpenChange={setPresetSelectorOpen}
      />

      {/* Ticket 1: 停靠布局壳 — Scene3D/Toolbox/PropertyPanel/EntityList/EnvironmentPanel/ChartPanel 全部迁入 */}
      <DockShell />

      {/* Toolbar 保持浮层；图表面板开关桥接 dock */}
      <ChartToolbarBridge />

      <ObjectBuilder />
      <TrackBuilder />
      <FixedJointBanner />
      <FixedJointDialog />
      <ForceFieldDialog />
      <CreationDock />
      <PlacementHint />
    </DockApiProvider>
  );
}

/** F3: 虚影放置模式提示条（placement 激活时悬浮在视口底部） */
function PlacementHint() {
  const active = useSimulationStore((s) => s.placement !== null);
  if (!active) return null;
  return (
    <div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full text-xs pointer-events-none"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--holo-a30)',
        color: 'var(--holo)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      移动鼠标吸附表面 · 滚轮调高度 · 左键放置 · Esc 取消
    </div>
  );
}

/** Toolbar 桥接：图表面板的开关状态 = dock 中 chart 面板的存在性 */
function ChartToolbarBridge() {
  const dock = useDock();
  return (
    <Toolbar
      chartPanelOpen={dock?.hasPanel('chart') ?? false}
      onToggleChartPanel={() => dock?.togglePanel('chart')}
    />
  );
}
