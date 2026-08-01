import { useCallback, useRef } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
} from 'dockview-react';
import { themeScifi } from './dockTheme';
import './dockTheme.css';
import { buildDefaultLayout, dockComponents, PANEL_IDS } from './panels';
import { useDockRegistrar } from './DockApiContext';

/**
 * DockShell — 工作区停靠布局壳
 *
 * - Scene3D 作为中央"视口"面板（自定义 tab，无关闭按钮）
 * - 布局变更防抖 500ms 后序列化存 localStorage
 * - 启动时恢复布局；恢复失败回退默认布局
 */

const LAYOUT_STORAGE_KEY = 'physics4.dock-layout.v1';

// viewport 专用 tab：只显示标题，不提供关闭按钮（防止误关 3D 视口）
function ViewportTab(props: IDockviewPanelHeaderProps) {
  return (
    <div className="dv-default-tab" style={{ padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' }}>
      <span className="dv-default-tab-content">{props.api.title ?? '视口'}</span>
    </div>
  );
}

const tabComponents = { viewport: ViewportTab };

export default function DockShell() {
  const register = useDockRegistrar();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const { api } = event;

      // ── 恢复布局，失败回退默认 ──
      // 迁移规则：恢复出的面板必须全部是当前已注册的面板 id
      // （如旧布局含已移除的 'toolbox' 面板 → 整体回退默认布局）
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      let restored = false;
      if (saved) {
        try {
          api.fromJSON(JSON.parse(saved));
          const known = new Set<string>(PANEL_IDS);
          restored =
            api.panels.length > 0 && api.panels.every((p) => known.has(p.id as (typeof PANEL_IDS)[number]));
        } catch {
          restored = false;
        }
      }
      if (!restored) {
        api.clear();
        buildDefaultLayout(api);
      }

      // 布局就绪后再注册 — register 会读取当前面板列表
      register(api);

      // ── 布局持久化（防抖 500ms） ──
      api.onDidLayoutChange(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try {
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(api.toJSON()));
          } catch {
            // 序列化失败不阻塞使用
          }
        }, 500);
      });
    },
    [register]
  );

  return (
    <div className="absolute inset-0 top-9">
      <DockviewReact
        components={dockComponents}
        tabComponents={tabComponents}
        onReady={onReady}
        theme={themeScifi}
        className="h-full w-full"
      />
    </div>
  );
}
