import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SnapshotManager } from '../SnapshotManager';
import { useSnapshotStore } from '@/store/snapshotSlice';

describe('SnapshotManager', () => {
  beforeEach(() => {
    // Reset snapshot store to initial state
    useSnapshotStore.setState({ slots: Array(5).fill(null) });
    localStorage.clear();
  });

  function renderComponent(open = true) {
    const onOpenChange = () => {};
    return render(
      <SnapshotManager open={open} onOpenChange={onOpenChange} />
    );
  }

  it('renders the Sheet title "快照管理"', () => {
    renderComponent();
    expect(screen.getByText('快照管理')).toBeDefined();
  });

  it('renders the save input with placeholder "输入快照名称"', () => {
    renderComponent();
    const input = screen.getByPlaceholderText('输入快照名称');
    expect(input).toBeDefined();
  });

  it('renders 5 slot placeholders when all slots are empty', () => {
    renderComponent();
    for (let i = 1; i <= 5; i++) {
      const slotText = screen.getByText(`槽位 ${i} — 空`);
      expect(slotText).toBeDefined();
    }
  });

  it('renders filled slot with snapshot name after save', () => {
    // Pre-fill a slot via the store
    const mockEntity = new Map();
    const mockComps = new Map();
    const entity = { id: 'test-1', name: 'Ball', components: mockComps };
    const entities = new Map([['test-1', entity]]);

    useSnapshotStore.getState().saveSnapshot(0, '测试快照', {
      entities: entities as Map<string, { id: string; name: string; components: Map<string, unknown> }>,
      environment: { gravity: [0, -9.81, 0], frictionScale: 1, restitutionScale: 1, drag: 0.1 },
    });

    renderComponent();
    expect(screen.getByText('测试快照')).toBeDefined();
  });

  it('shows entity count on filled slot', () => {
    const entity = { id: 'test-2', name: 'Box', components: new Map() };
    const entities = new Map([['test-2', entity]]);

    useSnapshotStore.getState().saveSnapshot(1, '单实体快照', {
      entities: entities as Map<string, { id: string; name: string; components: Map<string, unknown> }>,
      environment: { gravity: [0, -9.81, 0], frictionScale: 1, restitutionScale: 1, drag: 0.1 },
    });

    renderComponent();
    expect(screen.getByText('1 实体')).toBeDefined();
  });

  it('shows save button text', () => {
    renderComponent();
    expect(screen.getByText('保存')).toBeDefined();
  });
});
