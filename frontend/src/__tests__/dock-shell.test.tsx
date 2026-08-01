import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { DockApiProvider, useDock, type DockContextValue } from '../components/dock/DockApiContext';
import DockShell from '../components/dock/DockShell';

/**
 * Ticket 1 — App 级 seam 测试（SPEC Testing Decisions Seam 1）
 *
 * 断言外部行为：dock 壳渲染全部默认面板、布局序列化/恢复往返。
 * 不断言 CSS 类名之外的实现细节。
 */

// Scene3D 依赖 R3F/WebGL，无法在 jsdom 运行 — mock 掉
vi.mock('../components/Scene3D', () => ({
  default: () => <div data-testid="scene3d-mock" />,
}));

const LAYOUT_STORAGE_KEY = 'physics4.dock-layout.v1';

// 探针：把 dock context 暴露给测试体
let dockCtx: DockContextValue | null = null;
function Probe() {
  dockCtx = useDock();
  return null;
}

function renderShell() {
  return render(
    <DockApiProvider>
      <Probe />
      <DockShell />
    </DockApiProvider>
  );
}

describe('DockShell', () => {
  beforeEach(() => {
    dockCtx = null;
    localStorage.clear();
  });

  it('默认布局渲染全部面板（视口/实体属性/实体列表/环境参数）', async () => {
    const { container } = renderShell();

    await waitFor(() => expect(dockCtx?.api).toBeTruthy());
    await waitFor(() => {
      expect(dockCtx!.panels).toEqual(
        expect.arrayContaining(['viewport', 'property', 'entityList', 'environment'])
      );
    });

    // tab 标题可见
    const tabTexts = Array.from(container.querySelectorAll('.dv-default-tab-content')).map(
      (el) => el.textContent
    );
    expect(tabTexts).toEqual(
      expect.arrayContaining(['视口', '实体属性', '实体列表', '环境参数'])
    );

    // 视口面板渲染 Scene3D
    expect(screen.getByTestId('scene3d-mock')).toBeInTheDocument();

    // Sci-fi Lab 主题已应用（Ticket 2）
    expect(container.querySelector('.dockview-theme-scifi')).toBeInTheDocument();
  });

  it('布局序列化/恢复往返：toJSON → clear → fromJSON 后面板还原', async () => {
    renderShell();
    await waitFor(() => expect(dockCtx?.api).toBeTruthy());
    await waitFor(() => expect(dockCtx!.panels.length).toBeGreaterThan(0));

    const api = dockCtx!.api!;
    const snapshot = api.toJSON();

    act(() => {
      api.clear();
    });
    await waitFor(() => expect(dockCtx!.panels).toHaveLength(0));

    act(() => {
      api.fromJSON(snapshot);
    });
    await waitFor(() => {
      expect(dockCtx!.panels).toEqual(
        expect.arrayContaining(['viewport', 'property', 'entityList', 'environment'])
      );
    });
  });

  it('损坏的持久化数据回退默认布局', async () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, '{broken json!!!');

    renderShell();
    await waitFor(() => expect(dockCtx?.api).toBeTruthy());
    await waitFor(() => {
      expect(dockCtx!.panels).toEqual(
        expect.arrayContaining(['viewport', 'property', 'entityList', 'environment'])
      );
    });
  });

  it('含已移除面板（toolbox）的旧布局回退默认布局', async () => {
    // 先以新布局生成合法快照，再注入一个不存在的面板 id 模拟旧版本布局
    renderShell();
    await waitFor(() => expect(dockCtx?.api).toBeTruthy());
    await waitFor(() => expect(dockCtx!.panels.length).toBeGreaterThan(0));
    const snapshot = dockCtx!.api!.toJSON() as { panels?: Record<string, unknown> };
    snapshot.panels = { ...snapshot.panels, toolbox: { id: 'toolbox' } };
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(snapshot));

    // 重新挂载 → 应整体回退默认布局（不含 toolbox）
    dockCtx = null;
    renderShell();
    await waitFor(() => expect(dockCtx?.api).toBeTruthy());
    await waitFor(() => {
      expect(dockCtx!.panels).toEqual(
        expect.arrayContaining(['viewport', 'property', 'entityList', 'environment'])
      );
      expect(dockCtx!.panels).not.toContain('toolbox');
    });
  });
});
