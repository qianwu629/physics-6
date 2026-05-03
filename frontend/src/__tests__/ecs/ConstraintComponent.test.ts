import { describe, it, expect, beforeEach } from 'vitest';
import type { ConstraintComponent, SpringConstraintParams, AnyComponent } from '../../ecs/types';
import {
  createSpringEntity,
  DEFAULT_SPRING_PARAMS,
  resetEntityCounter,
  createSphereEntity,
} from '../../ecs/Entity';

describe('ConstraintComponent', () => {
  describe('type guard', () => {
    it('ConstraintComponent has type "constraint"', () => {
      const comp: ConstraintComponent = {
        type: 'constraint',
        kind: 'spring',
        entityAId: 'a',
        entityBId: 'b',
        params: { stiffness: 100, restLength: 2.0, damping: 0.1 },
      };
      expect(comp.type).toBe('constraint');
    });

    it('AnyComponent union accepts ConstraintComponent', () => {
      const comp: AnyComponent = {
        type: 'constraint',
        kind: 'spring',
        entityAId: 'a',
        entityBId: 'b',
        params: { stiffness: 50, restLength: 3.0, damping: 0.5 },
      };
      expect(comp).toBeDefined();
    });

    it('ConstraintComponent kind is "spring"', () => {
      const comp: ConstraintComponent = {
        type: 'constraint',
        kind: 'spring',
        entityAId: 'a',
        entityBId: 'b',
        params: { stiffness: 100, restLength: 2.0, damping: 0.1 },
      };
      expect(comp.kind).toBe('spring');
    });

    it('SpringConstraintParams has required fields', () => {
      const params: SpringConstraintParams = {
        stiffness: 200,
        restLength: 1.5,
        damping: 0.2,
      };
      expect(params.stiffness).toBe(200);
      expect(params.restLength).toBe(1.5);
      expect(params.damping).toBe(0.2);
    });
  });

  describe('createSpringEntity', () => {
    beforeEach(() => {
      resetEntityCounter();
    });

    it('creates entity with constraint component', () => {
      const entity = createSpringEntity('entity-a', 'entity-b');
      expect(entity.components.has('constraint')).toBe(true);
    });

    it('uses default params when none provided', () => {
      const entity = createSpringEntity('a', 'b');
      const comp = entity.components.get('constraint') as ConstraintComponent;
      expect(comp.params.stiffness).toBe(DEFAULT_SPRING_PARAMS.stiffness);
      expect(comp.params.restLength).toBe(DEFAULT_SPRING_PARAMS.restLength);
      expect(comp.params.damping).toBe(DEFAULT_SPRING_PARAMS.damping);
    });

    it('merges provided params over defaults', () => {
      const entity = createSpringEntity('a', 'b', { stiffness: 500, damping: 3.0 });
      const comp = entity.components.get('constraint') as ConstraintComponent;
      expect(comp.params.stiffness).toBe(500);
      expect(comp.params.restLength).toBe(DEFAULT_SPRING_PARAMS.restLength);
      expect(comp.params.damping).toBe(3.0);
    });

    it('generates id in "spring-N" format', () => {
      const entity1 = createSpringEntity('a', 'b');
      const entity2 = createSpringEntity('c', 'd');
      expect(entity1.id).toBe('spring-1');
      expect(entity2.id).toBe('spring-2');
    });

    it('generates name in "弹簧-N" format', () => {
      const entity = createSpringEntity('a', 'b');
      expect(entity.name).toBe('弹簧-1');
    });

    it('stores entityAId and entityBId in component', () => {
      const entity = createSpringEntity('entity-a-123', 'entity-b-456');
      const comp = entity.components.get('constraint') as ConstraintComponent;
      expect(comp.entityAId).toBe('entity-a-123');
      expect(comp.entityBId).toBe('entity-b-456');
    });

    it('shares global counter with shape factories', () => {
      // sphere creates entity with id sphere-1 (counter=1)
      createSphereEntity(1.0, 1.0, 0.5, 0.3);
      // spring creates entity with id spring-2 (counter=2)
      const spring = createSpringEntity('a', 'b');
      expect(spring.id).toBe('spring-2');
    });

    it('has constraint + default trail and vector components (no transform/rigidBody/collider)', () => {
      const entity = createSpringEntity('a', 'b');
      // + trail + vector (Phase 4 defaults)
      expect(entity.components.size).toBe(3);
      expect(entity.components.has('constraint')).toBe(true);
      expect(entity.components.has('trail')).toBe(true);
      expect(entity.components.has('vector')).toBe(true);
      expect(entity.components.has('transform')).toBe(false);
      expect(entity.components.has('rigidBody')).toBe(false);
      expect(entity.components.has('collider')).toBe(false);
    });

    it('DEFAULT_SPRING_PARAMS has expected default values', () => {
      expect(DEFAULT_SPRING_PARAMS.stiffness).toBe(100);
      expect(DEFAULT_SPRING_PARAMS.restLength).toBe(2.0);
      expect(DEFAULT_SPRING_PARAMS.damping).toBe(0.1);
    });
  });
});
