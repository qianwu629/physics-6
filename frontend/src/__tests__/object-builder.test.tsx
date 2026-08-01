import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSimulationStore } from '../store';
import ObjectBuilder from '../components/ObjectBuilder';

/**
 * ObjectBuilder seam 测试（W8）— 断言外部行为：
 * 建造器渲染预设入口、确认创建实体且默认挂 faces 配置。
 * SketchBoard/3D 预览涉及 canvas/WebGL，不在 jsdom 断言其内部。
 */
describe('ObjectBuilder', () => {
  beforeEach(() => {
    useSimulationStore.setState({
      objectBuilderOpen: true,
      entities: new Map(),
      selectedEntityId: null,
    });
  });

  it('打开时渲染三栏结构（预设模型 / 预览 / 参数）', async () => {
    render(<ObjectBuilder />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('预设模型')).toBeInTheDocument();
    expect(screen.getByText('物理参数')).toBeInTheDocument();
    // 默认进入自定义凸形模式：无轮廓时确认禁用
    const confirm = screen.getByRole('button', { name: '确认添加' });
    expect(confirm).toBeDisabled();
  });

  it('选择球体预设 → 确认添加 → 实体入库且默认挂 faces（单面 surface）', async () => {
    render(<ObjectBuilder />);
    fireEvent.click(screen.getByRole('button', { name: '球体' }));

    const confirm = screen.getByRole('button', { name: '确认添加' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(useSimulationStore.getState().entities.size).toBe(1);
    });
    const entity = Array.from(useSimulationStore.getState().entities.values())[0];
    const collider = entity.components.get('collider') as { shape: string; faces?: { id: string; friction: number; pinned: boolean }[] };
    expect(collider.shape).toBe('sphere');
    // W8：新实体默认挂 faces（统一摩擦值）
    expect(collider.faces).toHaveLength(1);
    expect(collider.faces![0]).toMatchObject({ id: 'surface', friction: 0.3, pinned: false });
  });

  it('选择方块预设 → 创建实体带 6 面 faces；对话框创建后关闭', async () => {
    render(<ObjectBuilder />);
    fireEvent.click(screen.getByRole('button', { name: '方块' }));

    const confirm = screen.getByRole('button', { name: '确认添加' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(useSimulationStore.getState().entities.size).toBe(1);
    });
    const entity = Array.from(useSimulationStore.getState().entities.values())[0];
    const collider = entity.components.get('collider') as { faces?: { id: string }[] };
    expect(collider.faces!.map((f) => f.id)).toEqual(['top', 'bottom', 'front', 'back', 'right', 'left']);
    // 创建成功后对话框关闭
    expect(useSimulationStore.getState().objectBuilderOpen).toBe(false);
  });
});
