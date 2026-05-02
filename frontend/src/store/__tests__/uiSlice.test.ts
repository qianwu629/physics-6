import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createUiSlice, type UiSlice } from '../uiSlice';

/** Standalone test store — only UiSlice */
function createTestStore() {
  return create<UiSlice>()((...args) => ({
    ...createUiSlice(...args),
  }));
}

describe('UiSlice — propertyPanelCollapsed', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('propertyPanelCollapsed defaults to false', () => {
    expect(store.getState().propertyPanelCollapsed).toBe(false);
  });

  it('togglePropertyPanel toggles the state from false to true', () => {
    expect(store.getState().propertyPanelCollapsed).toBe(false);
    store.getState().togglePropertyPanel();
    expect(store.getState().propertyPanelCollapsed).toBe(true);
  });

  it('togglePropertyPanel toggles back from true to false', () => {
    store.getState().togglePropertyPanel();
    expect(store.getState().propertyPanelCollapsed).toBe(true);
    store.getState().togglePropertyPanel();
    expect(store.getState().propertyPanelCollapsed).toBe(false);
  });

  it('multiple toggles cycle correctly', () => {
    store.getState().togglePropertyPanel();
    store.getState().togglePropertyPanel();
    store.getState().togglePropertyPanel();
    expect(store.getState().propertyPanelCollapsed).toBe(true);
  });
});
