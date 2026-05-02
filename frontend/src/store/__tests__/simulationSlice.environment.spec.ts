import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import type { SimulationSlice } from '../simulationSlice';
import { createSimulationSlice, DEFAULT_ENVIRONMENT } from '../simulationSlice';

function createTestStore() {
  return create<SimulationSlice>()((...args) => ({
    ...createSimulationSlice(...args),
  }));
}

describe('simulationSlice - environment', () => {
  describe('initial state', () => {
    it('has default gravity [0, -9.81, 0]', () => {
      const store = createTestStore();
      const env = store.getState().environment;
      expect(env.gravity).toEqual([0, -9.81, 0]);
    });

    it('has default frictionScale 1.0', () => {
      const store = createTestStore();
      expect(store.getState().environment.frictionScale).toBe(1.0);
    });

    it('has default restitutionScale 1.0', () => {
      const store = createTestStore();
      expect(store.getState().environment.restitutionScale).toBe(1.0);
    });

    it('has default drag 0.1', () => {
      const store = createTestStore();
      expect(store.getState().environment.drag).toBe(0.1);
    });
  });

  describe('setGravity', () => {
    it('updates gravity value', () => {
      const store = createTestStore();
      store.getState().setGravity([1, 2, 3]);
      expect(store.getState().environment.gravity).toEqual([1, 2, 3]);
    });

    it('creates new array reference (not same as input)', () => {
      const store = createTestStore();
      const input: [number, number, number] = [5, -5, 0];
      store.getState().setGravity(input);
      const result = store.getState().environment.gravity;
      expect(result).toEqual(input);
      expect(result).not.toBe(input); // new reference
    });

    it('zero gravity is supported', () => {
      const store = createTestStore();
      store.getState().setGravity([0, 0, 0]);
      expect(store.getState().environment.gravity).toEqual([0, 0, 0]);
    });
  });

  describe('setFrictionScale', () => {
    it('updates friction scale', () => {
      const store = createTestStore();
      store.getState().setFrictionScale(2.5);
      expect(store.getState().environment.frictionScale).toBe(2.5);
    });

    it('creates new environment reference', () => {
      const store = createTestStore();
      const envBefore = store.getState().environment;
      store.getState().setFrictionScale(3.0);
      const envAfter = store.getState().environment;
      expect(envAfter).not.toBe(envBefore);
      expect(envAfter.frictionScale).toBe(3.0);
      expect(envAfter.gravity).toEqual(envBefore.gravity); // other fields preserved
    });
  });

  describe('setRestitutionScale', () => {
    it('updates restitution scale', () => {
      const store = createTestStore();
      store.getState().setRestitutionScale(0.5);
      expect(store.getState().environment.restitutionScale).toBe(0.5);
    });

    it('creates new environment reference', () => {
      const store = createTestStore();
      const envBefore = store.getState().environment;
      store.getState().setRestitutionScale(2.0);
      expect(store.getState().environment).not.toBe(envBefore);
    });
  });

  describe('setDrag', () => {
    it('updates drag value', () => {
      const store = createTestStore();
      store.getState().setDrag(5.0);
      expect(store.getState().environment.drag).toBe(5.0);
    });

    it('creates new environment reference', () => {
      const store = createTestStore();
      const envBefore = store.getState().environment;
      store.getState().setDrag(3.0);
      expect(store.getState().environment).not.toBe(envBefore);
    });
  });

  describe('resetEnvironment', () => {
    it('restores all fields to defaults', () => {
      const store = createTestStore();
      store.getState().setGravity([1, 2, 3]);
      store.getState().setFrictionScale(5.0);
      store.getState().setRestitutionScale(3.0);
      store.getState().setDrag(2.0);
      store.getState().resetEnvironment();
      const env = store.getState().environment;
      expect(env.gravity).toEqual(DEFAULT_ENVIRONMENT.gravity);
      expect(env.frictionScale).toBe(DEFAULT_ENVIRONMENT.frictionScale);
      expect(env.restitutionScale).toBe(DEFAULT_ENVIRONMENT.restitutionScale);
      expect(env.drag).toBe(DEFAULT_ENVIRONMENT.drag);
    });
  });

  describe('reset() does not affect environment', () => {
    it('environment is preserved after reset', () => {
      const store = createTestStore();
      store.getState().setGravity([0, -1.62, 0]); // lunar gravity
      const envBefore = store.getState().environment;
      store.getState().reset();
      const envAfter = store.getState().environment;
      expect(envAfter.gravity).toEqual([0, -1.62, 0]);
      expect(envAfter.frictionScale).toBe(envBefore.frictionScale);
    });

    it('resetCounter increments on reset', () => {
      const store = createTestStore();
      const counterBefore = store.getState().resetCounter;
      store.getState().reset();
      expect(store.getState().resetCounter).toBe(counterBefore + 1);
    });
  });

  describe('multiple environment updates', () => {
    it('each update creates a new environment reference', () => {
      const store = createTestStore();
      const refs: object[] = [];
      refs.push(store.getState().environment);
      store.getState().setGravity([0, -3.71, 0]); // Mars
      refs.push(store.getState().environment);
      store.getState().setFrictionScale(0.5);
      refs.push(store.getState().environment);
      store.getState().setDrag(0.05);
      refs.push(store.getState().environment);

      // All references should be distinct
      for (let i = 0; i < refs.length; i++) {
        for (let j = i + 1; j < refs.length; j++) {
          expect(refs[i]).not.toBe(refs[j]);
        }
      }
    });

    it('gravity changes do not clobber friction/drag', () => {
      const store = createTestStore();
      store.getState().setFrictionScale(2.0);
      store.getState().setDrag(5.0);
      store.getState().setGravity([0, -3.71, 0]);
      const env = store.getState().environment;
      expect(env.frictionScale).toBe(2.0);
      expect(env.drag).toBe(5.0);
      expect(env.gravity).toEqual([0, -3.71, 0]);
    });
  });
});
