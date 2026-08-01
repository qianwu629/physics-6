import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DockviewApi } from 'dockview-react';
import { addPanelFor, type PanelId } from './panels';

/**
 * DockApiContext — 停靠布局壳的 React 接口
 *
 * 让 dock 外的组件（MenuBar、Toolbar）能开关面板，
 * 让 dock 内的组件（PropertyPanel 关闭按钮）能关闭自身面板。
 *
 * provider 外调用 useDock() 返回 null —— 兼容独立渲染面板的旧测试。
 */

export interface DockContextValue {
  api: DockviewApi | null;
  /** 当前存在的面板 id 列表（响应式） */
  panels: string[];
  hasPanel: (id: PanelId) => boolean;
  /** 不存在则添加，存在则移除 */
  togglePanel: (id: PanelId) => void;
  closePanel: (id: PanelId) => void;
}

const DockContext = createContext<DockContextValue | null>(null);

export function useDock(): DockContextValue | null {
  return useContext(DockContext);
}

export function DockApiProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const [panels, setPanels] = useState<string[]>([]);

  // DockShell 的 onReady 经此注册 api
  const register = useCallback((next: DockviewApi) => {
    setApi(next);
    setPanels(next.panels.map((p) => p.id));
  }, []);

  useEffect(() => {
    if (!api) return;
    // 订阅时先同步一次（onReady 期间的布局构建可能早于订阅）
    setPanels(api.panels.map((p) => p.id));
    const disposable = api.onDidLayoutChange(() => {
      setPanels(api.panels.map((p) => p.id));
    });
    return () => disposable.dispose();
  }, [api]);

  const hasPanel = useCallback((id: PanelId) => panels.includes(id), [panels]);

  const togglePanel = useCallback(
    (id: PanelId) => {
      if (!api || id === 'viewport') return;
      const existing = api.getPanel(id);
      if (existing) {
        api.removePanel(existing);
      } else {
        addPanelFor(api, id);
      }
    },
    [api]
  );

  const closePanel = useCallback(
    (id: PanelId) => {
      if (!api || id === 'viewport') return;
      const existing = api.getPanel(id);
      if (existing) api.removePanel(existing);
    },
    [api]
  );

  const value = useMemo<DockContextValue>(
    () => ({ api, panels, hasPanel, togglePanel, closePanel }),
    [api, panels, hasPanel, togglePanel, closePanel]
  );

  return (
    <DockContext.Provider value={value}>
      <DockRegistrarContext.Provider value={register}>
        {children}
      </DockRegistrarContext.Provider>
    </DockContext.Provider>
  );
}

// DockShell 专用：把 ready 的 api 注册进 provider
const DockRegistrarContext = createContext<(api: DockviewApi) => void>(() => {});

export function useDockRegistrar(): (api: DockviewApi) => void {
  return useContext(DockRegistrarContext);
}
