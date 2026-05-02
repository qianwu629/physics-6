import { useState, useEffect, useCallback, Suspense } from 'react';
import { PanelRight } from 'lucide-react';
import { useSimulationStore } from '../store';
import Scene3D from './Scene3D';
import Toolbar from './Toolbar';
import Toolbox from './Toolbox';
import PropertyPanel from './PropertyPanel';
import CreationDialog from './CreationDialog';
import LoadingScreen from './LoadingScreen';
import ErrorFallback from './ErrorFallback';
import type { ErrorType } from './ErrorFallback';

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

  const toggle = useSimulationStore((s) => s.toggle);
  const reset = useSimulationStore((s) => s.reset);
  // Phase 2: 新增 store 访问器
  const openDialog = useSimulationStore((s) => s.openDialog);
  const openDeleteDialog = useSimulationStore((s) => s.openDeleteDialog);
  const resetEntities = useSimulationStore((s) => s.resetEntities);
  const selectedEntityId = useSimulationStore((s) => s.selectedEntityId);
  const propertyPanelCollapsed = useSimulationStore((s) => s.propertyPanelCollapsed);
  const togglePropertyPanel = useSimulationStore((s) => s.togglePropertyPanel);

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内按键
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;  // WR-04: 类型守卫代替不安全断言
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
          e.preventDefault();           // 防止页面滚动
          toggle();                      // D-08: Space = 播放/暂停
          break;
        case 'KeyR':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            // D-12: 重置 = 空场景 + 暂停
            // 使用 getState() 避免过期闭包问题 (Phase 1 模式)
            const state = useSimulationStore.getState();
            state.resetEntities();
            state.reset();
          }
          break;
        // ── Phase 2: 创建对话框快捷键 (D-04) ──
        case 'KeyB':
          e.preventDefault();
          openDialog('sphere');
          break;
        case 'KeyN':
          e.preventDefault();
          openDialog('box');
          break;
        case 'KeyC':
          e.preventDefault();
          openDialog('cylinder');
          break;
        case 'KeyS':
          e.preventDefault();
          openDialog('slope');
          break;
        // ── Phase 2: 删除实体快捷键 (D-11) ──
        case 'Delete':
        case 'Backspace': {
          const sid = useSimulationStore.getState().selectedEntityId;
          if (sid) {
            e.preventDefault();
            openDeleteDialog();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle, openDialog, openDeleteDialog, resetEntities, reset]);

  // ──── 重置计数器监听 (D-12: 工具栏重置按钮也需清空实体) ────
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

  // ──── 状态机渲染 ────
  if (appState === 'error' && errorType) {
    return <ErrorFallback type={errorType} />;
  }

  if (appState === 'loading') {
    return <LoadingScreen />;
  }

  // appState === 'ready' — 3D 场景 + 工具栏
  // CR-01 fix: Suspense 边界捕获 @react-three/rapier 的 WASM 加载挂起状态
  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Scene3D />
      </Suspense>
      <Toolbar />
      <Toolbox />
      {!propertyPanelCollapsed && <PropertyPanel />}
      {propertyPanelCollapsed && (
        <button
          type="button"
          onClick={togglePropertyPanel}
          aria-label="展开属性面板"
          title="展开属性面板"
          className="fixed z-40 flex items-center justify-center w-10 h-10 rounded-xl
            text-[#a0a0a0] hover:bg-[rgba(59,130,246,0.15)] hover:text-[#3b82f6]
            active:bg-[rgba(59,130,246,0.3)] active:scale-95
            transition-all duration-150"
          style={{
            right: '16px',
            top: '80px',
            background: 'rgba(26, 26, 26, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
          }}
        >
          <PanelRight size={16} strokeWidth={2} />
        </button>
      )}
      <CreationDialog />
    </>
  );
}
