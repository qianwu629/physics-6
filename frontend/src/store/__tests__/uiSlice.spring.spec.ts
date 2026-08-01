import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import type { UiSlice } from '../uiSlice';
import { createUiSlice } from '../uiSlice';

function createTestStore() {
  return create<UiSlice>()((...args) => ({
    ...createUiSlice(...args),
  }));
}

// W8：弹簧/固定/铰链/球窝/轻绳/轻杆的创建统一走连接模式状态机（fixedJointStage）
describe('uiSlice - joint creation state machine (unified)', () => {
  describe('initial state', () => {
    it('fixedJointStage starts as idle', () => {
      const store = createTestStore();
      expect(store.getState().fixedJointStage).toBe('idle');
    });

    it('fixedJointEntityAId/BId start as null, dialog closed', () => {
      const store = createTestStore();
      expect(store.getState().fixedJointEntityAId).toBeNull();
      expect(store.getState().fixedJointEntityBId).toBeNull();
      expect(store.getState().fixedJointDialogOpen).toBe(false);
    });

    it('environmentPanelOpen starts as false', () => {
      const store = createTestStore();
      expect(store.getState().environmentPanelOpen).toBe(false);
    });
  });

  describe('idle → pendingA → pendingB → dialog → idle (full path)', () => {
    it('completes full state machine path', () => {
      const store = createTestStore();
      const state = store.getState();

      state.enterFixedJointMode();
      expect(store.getState().fixedJointStage).toBe('pendingA');
      expect(store.getState().fixedJointEntityAId).toBeNull();

      state.selectFixedJointEndpointA('entity-1');
      expect(store.getState().fixedJointStage).toBe('pendingB');
      expect(store.getState().fixedJointEntityAId).toBe('entity-1');

      state.selectFixedJointEndpointB('entity-2');
      expect(store.getState().fixedJointStage).toBe('dialog');
      expect(store.getState().fixedJointEntityBId).toBe('entity-2');
      expect(store.getState().fixedJointDialogOpen).toBe(true);

      state.closeFixedJointDialog();
      expect(store.getState().fixedJointStage).toBe('idle');
      expect(store.getState().fixedJointDialogOpen).toBe(false);
      expect(store.getState().fixedJointEntityAId).toBeNull();
      expect(store.getState().fixedJointEntityBId).toBeNull();
    });
  });

  describe('exitFixedJointMode', () => {
    it('resets to idle from pendingA', () => {
      const store = createTestStore();
      const state = store.getState();
      state.enterFixedJointMode();
      state.exitFixedJointMode();
      expect(store.getState().fixedJointStage).toBe('idle');
      expect(store.getState().fixedJointEntityAId).toBeNull();
    });

    it('resets to idle from pendingB', () => {
      const store = createTestStore();
      const state = store.getState();
      state.enterFixedJointMode();
      state.selectFixedJointEndpointA('entity-1');
      state.exitFixedJointMode();
      expect(store.getState().fixedJointStage).toBe('idle');
      expect(store.getState().fixedJointEntityAId).toBeNull();
      expect(store.getState().fixedJointEntityBId).toBeNull();
    });
  });

  describe('selectFixedJointEndpointA(null) cancels', () => {
    it('returns to idle when null passed as endpoint A', () => {
      const store = createTestStore();
      const state = store.getState();
      state.enterFixedJointMode();
      state.selectFixedJointEndpointA('entity-1');
      expect(store.getState().fixedJointStage).toBe('pendingB');
      state.selectFixedJointEndpointA(null);
      expect(store.getState().fixedJointStage).toBe('idle');
      expect(store.getState().fixedJointEntityAId).toBeNull();
    });
  });
});
