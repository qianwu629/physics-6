import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSimulationStore } from '../store';
import Scene3D from './Scene3D';
import Toolbar from './Toolbar';
import LoadingScreen from './LoadingScreen';
import ErrorFallback from './ErrorFallback';
import type { ErrorType } from './ErrorFallback';

/**
 * App — Phase 1 应用根组件
 *
 * 负责:
 * 1. WASM 引擎初始化协调 (Rapier.init())
 * 2. WebGL 可用性检测 (canvas.getContext('webgl2'))
 * 3. 键盘快捷键注册 (D-08: Space = 播放/暂停, R = 重置)
 * 4. 页面可见性变化处理 (PITFALLS #1: 切标签页自动暂停)
 * 5. 加载/错误/正常状态的渲染切换
 *
 * 状态机:
 *   init → WebGL 检测 → WASM 加载 → ready (渲染场景 + 工具栏)
 *              ↓ 失败              ↓ 失败
 *         ErrorFallback(webgl)  ErrorFallback(wasm)
 *
 * D-04: 就绪后场景渲染但物理暂停——用户需手动点击播放。
 * D-11: WASM 加载期间显示 LoadingScreen。
 * D-12: 硬编码场景仅为引擎验证——Phase 2 替换为自由添加。
 */

type AppState = 'loading' | 'error' | 'ready';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);

  const toggle = useSimulationStore((s) => s.toggle);
  const reset = useSimulationStore((s) => s.reset);

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
            reset();                     // D-08: R = 重置
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle, reset]);

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
    </>
  );
}
