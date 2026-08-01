import type { FunctionComponent } from 'react';
import type { DockviewApi, IDockviewPanelProps } from 'dockview-react';
import Scene3D from '../Scene3D';
import PropertyPanel from '../PropertyPanel';
import EntityList from '../EntityList';
import EnvironmentPanel from '../EnvironmentPanel';
import { ChartPanel } from '../ChartPanel';

/**
 * dock 面板注册表 + 默认布局
 *
 * 面板内容组件经 React portal 渲染（dockview 行为），
 * zustand / Radix context 天然保留，面板组件本身零侵入。
 *
 * W8：左侧「工具箱」面板已移除，创建入口改由底部 CreationDock 悬浮栏提供。
 */

export const PANEL_IDS = ['viewport', 'property', 'entityList', 'environment', 'chart'] as const;
export type PanelId = (typeof PANEL_IDS)[number];

export const PANEL_TITLES: Record<PanelId, string> = {
  viewport: '视口',
  property: '实体属性',
  entityList: '实体列表',
  environment: '环境参数',
  chart: '实时物理量图表',
};

// ──── 面板内容包装器 ────

function ViewportContent(_props: IDockviewPanelProps) {
  return <Scene3D />;
}

function PropertyContent(_props: IDockviewPanelProps) {
  return <PropertyPanel />;
}

function EntityListContent(_props: IDockviewPanelProps) {
  return <EntityList />;
}

function EnvironmentContent(_props: IDockviewPanelProps) {
  return <EnvironmentPanel />;
}

// ChartPanel 适配器：dock 面板存在即 open；关闭走 dock tab 的关闭按钮
function ChartContent(props: IDockviewPanelProps) {
  return <ChartPanel open onClose={() => props.api.close()} />;
}

export const dockComponents: Record<PanelId, FunctionComponent<IDockviewPanelProps>> = {
  viewport: ViewportContent,
  property: PropertyContent,
  entityList: EntityListContent,
  environment: EnvironmentContent,
  chart: ChartContent,
};

// ──── 面板添加（含默认位置） ────

export function addPanelFor(api: DockviewApi, id: PanelId): void {
  switch (id) {
    case 'viewport':
      api.addPanel({ id, component: id, title: PANEL_TITLES[id], tabComponent: 'viewport' });
      break;
    case 'property':
      api.addPanel({
        id,
        component: id,
        title: PANEL_TITLES[id],
        position: { referencePanel: 'viewport', direction: 'right' },
        initialWidth: 320,
      });
      break;
    case 'entityList':
      api.addPanel({
        id,
        component: id,
        title: PANEL_TITLES[id],
        position: { referencePanel: 'property', direction: 'below' },
        initialHeight: 260,
      });
      break;
    case 'environment':
      api.addPanel({
        id,
        component: id,
        title: PANEL_TITLES[id],
        position: { referencePanel: 'viewport', direction: 'left' },
        initialWidth: 240,
      });
      break;
    case 'chart':
      // renderer: 'always' — 隐藏时保留 DOM，避免 lightweight-charts canvas 重建丢曲线
      api.addPanel({
        id,
        component: id,
        title: PANEL_TITLES[id],
        position: { referencePanel: 'viewport', direction: 'below' },
        initialHeight: 360,
        renderer: 'always',
      });
      break;
  }
}

// ──── 默认布局：viewport 居中，environment 左，property/entityList 右 ────

export function buildDefaultLayout(api: DockviewApi): void {
  addPanelFor(api, 'viewport');
  addPanelFor(api, 'environment');
  addPanelFor(api, 'property');
  addPanelFor(api, 'entityList');
  api.getPanel('viewport')?.api.setActive();
}
