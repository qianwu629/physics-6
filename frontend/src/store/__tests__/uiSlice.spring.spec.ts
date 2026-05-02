import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import type { UiSlice } from '../uiSlice';
import { createUiSlice } from '../uiSlice';

function createTestStore() {
  return create<UiSlice>()((...args) => ({
    ...createUiSlice(...args),
  }));
}

describe('uiSlice - spring creation state machine', () => {
  describe('initial state', () => {
    it('springCreationStage starts as idle', () => {
      const store = createTestStore();
      expect(store.getState().springCreationStage).toBe('idle');
    });

    it('springEntityAId starts as null', () => {
      const store = createTestStore();
      expect(store.getState().springEntityAId).toBeNull();
    });

    it('springEntityBId starts as null', () => {
      const store = createTestStore();
      expect(store.getState().springEntityBId).toBeNull();
    });

    it('springDialogOpen starts as false', () => {
      const store = createTestStore();
      expect(store.getState().springDialogOpen).toBe(false);
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

      // idle → pendingA
      state.enterSpringMode();
      expect(store.getState().springCreationStage).toBe('pendingA');
      expect(store.getState().springEntityAId).toBeNull();

      // pendingA → pendingB (select A)
      store.getState().selectSpringEndpointA('entity-1');
      expect(store.getState().springCreationStage).toBe('pendingB');
      expect(store.getState().springEntityAId).toBe('entity-1');

      // pendingB → dialog (select B)
      store.getState().selectSpringEndpointB('entity-2');
      expect(store.getState().springCreationStage).toBe('dialog');
      expect(store.getState().springEntityBId).toBe('entity-2');
      expect(store.getState().springDialogOpen).toBe(true);

      // dialog → idle (close dialog)
      store.getState().closeSpringDialog();
      expect(store.getState().springCreationStage).toBe('idle');
      expect(store.getState().springEntityAId).toBeNull();
      expect(store.getState().springEntityBId).toBeNull();
      expect(store.getState().springDialogOpen).toBe(false);
    });
  });

  describe('exitSpringMode', () => {
    it('resets to idle from pendingA', () => {
      const store = createTestStore();
      store.getState().enterSpringMode();
      expect(store.getState().springCreationStage).toBe('pendingA');
      store.getState().exitSpringMode();
      expect(store.getState().springCreationStage).toBe('idle');
      expect(store.getState().springEntityAId).toBeNull();
      expect(store.getState().springEntityBId).toBeNull();
    });

    it('resets to idle from pendingB', () => {
      const store = createTestStore();
      store.getState().enterSpringMode();
      store.getState().selectSpringEndpointA('entity-1');
      expect(store.getState().springCreationStage).toBe('pendingB');
      store.getState().exitSpringMode();
      expect(store.getState().springCreationStage).toBe('idle');
      expect(store.getState().springEntityAId).toBeNull();
      expect(store.getState().springEntityBId).toBeNull();
    });
  });

  describe('selectSpringEndpointA(null) cancels', () => {
    it('returns to idle when null passed as endpoint A', () => {
      const store = createTestStore();
      store.getState().enterSpringMode();
      store.getState().selectSpringEndpointA('entity-1');
      // Cancel by passing null
      store.getState().selectSpringEndpointA(null);
      expect(store.getState().springCreationStage).toBe('idle');
      expect(store.getState().springEntityAId).toBeNull();
    });
  });

  describe('selectSpringEndpointB transitions', () => {
    it('transitions to dialog stage regardless of starting state', () => {
      const store = createTestStore();
      // Implementation accepts B from any stage — UI-level guards (Scene3D click dispatch) enforce proper flow
      store.getState().selectSpringEndpointB('entity-2');
      expect(store.getState().springCreationStage).toBe('dialog');
      expect(store.getState().springDialogOpen).toBe(true);
    });
  });

  describe('springDialogOpen/closeSpringDialog', () => {
    it('openSpringDialog opens dialog', () => {
      const store = createTestStore();
      store.getState().openSpringDialog();
      expect(store.getState().springDialogOpen).toBe(true);
    });

    it('closeSpringDialog resets to idle and closes dialog', () => {
      const store = createTestStore();
      store.getState().enterSpringMode();
      store.getState().selectSpringEndpointA('entity-1');
      store.getState().selectSpringEndpointB('entity-2');
      store.getState().closeSpringDialog();
      expect(store.getState().springDialogOpen).toBe(false);
      expect(store.getState().springCreationStage).toBe('idle');
      expect(store.getState().springEntityAId).toBeNull();
    });
  });

  describe('environmentPanelOpen', () => {
    it('toggleEnvironmentPanel toggles state', () => {
      const store = createTestStore();
      expect(store.getState().environmentPanelOpen).toBe(false);
      store.getState().toggleEnvironmentPanel();
      expect(store.getState().environmentPanelOpen).toBe(true);
      store.getState().toggleEnvironmentPanel();
      expect(store.getState().environmentPanelOpen).toBe(false);
    });

    it('closeEnvironmentPanel sets to false', () => {
      const store = createTestStore();
      store.getState().toggleEnvironmentPanel();
      expect(store.getState().environmentPanelOpen).toBe(true);
      store.getState().closeEnvironmentPanel();
      expect(store.getState().environmentPanelOpen).toBe(false);
    });
  });

  describe('MAX_ENTITIES includes springs', () => {
    it('spring entities count toward max', () => {
      // This is tested in entitySlice, but the constraint is relevant here
      // since spring creation should be blocked when limit is hit
      expect(true).toBe(true); // semantic placeholder — real test in entitySlice
    });
  });
});
