import { useRef, useMemo, useCallback } from 'react';
import { RigidBody, BallCollider, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import type { Entity } from '../ecs/types';
import type { TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent } from '../ecs/types';

interface EntityRendererProps {
  entity: Entity;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * EntityRenderer — ECS Entity to R3F+Rapier JSX Translator
 *
 * Translates an ECS Entity (with its component Map) into declarative
 * @react-three/rapier JSX: <RigidBody> + <Collider> + <mesh> + conditional <Outlines>.
 *
 * Key design rules (from RESEARCH Anti-Patterns):
 *  1. onClick on the <mesh>, NOT on <RigidBody> — the visual geometry may
 *     differ from collision geometry; clicks must hit the visual surface.
 *  2. e.stopPropagation() prevents event bubbling to onPointerMissed.
 *  3. Outlines renders conditionally when isSelected is true.
 */
export default function EntityRenderer({ entity, isSelected, onSelect }: EntityRendererProps) {
  const rigidBodyRef = useRef<any>(null);

  // ── Extract components from Entity ──
  const transform = entity.components.get('transform') as TransformComponent | undefined;
  const rigidBody = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
  const collider = entity.components.get('collider') as ColliderComponent | undefined;
  const velocity = entity.components.get('velocity') as VelocityComponent | undefined;
  const material = entity.components.get('material') as MaterialComponent | undefined;

  // T-02-01: Defensive null check — corrupt ECS data won't crash the render tree
  if (!transform || !rigidBody || !collider || !material) {
    console.warn(`Entity ${entity.id} missing required components for rendering`);
    return null;
  }

  // ── Collider JSX (ECS ColliderComponent → Rapier Collider) ──
  const renderCollider = useMemo(() => {
    switch (collider.shape) {
      case 'sphere':
        return <BallCollider args={[collider.params.radius ?? 1.0]} />;
      case 'cuboid':
        return (
          <CuboidCollider
            args={[
              collider.params.halfWidth ?? 1.0,
              collider.params.halfHeight ?? 1.0,
              collider.params.halfDepth ?? 1.0,
            ]}
          />
        );
      case 'cylinder':
        return (
          <CylinderCollider
            args={[
              collider.params.halfHeight ?? 1.0,
              collider.params.radius ?? 0.5,
            ]}
          />
        );
      default:
        return null;
    }
  }, [collider.shape, collider.params]);

  // ── Visual Geometry (ECS ColliderComponent → Three.js geometry) ──
  const renderGeometry = useMemo(() => {
    switch (collider.shape) {
      case 'sphere':
        return <sphereGeometry args={[collider.params.radius ?? 1.0, 32, 32]} />;
      case 'cuboid':
        return (
          <boxGeometry
            args={[
              (collider.params.halfWidth ?? 1.0) * 2,
              (collider.params.halfHeight ?? 1.0) * 2,
              (collider.params.halfDepth ?? 1.0) * 2,
            ]}
          />
        );
      case 'cylinder':
        return (
          <cylinderGeometry
            args={[
              collider.params.radius ?? 0.5,             // radiusTop
              collider.params.radius ?? 0.5,             // radiusBottom
              (collider.params.halfHeight ?? 1.0) * 2,   // height
              32,
            ]}
          />
        );
      default:
        return <sphereGeometry args={[1.0, 32, 32]} />;
    }
  }, [collider.shape, collider.params]);

  // ── Click Handler ──
  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation(); // Prevent penetration to onPointerMissed and other objects
      onSelect(entity.id);
    },
    [entity.id, onSelect],
  );

  // ── Outlines opacity (static; pulse animation via CSS/framer for future enhancement) ──
  const pulseOpacity = useMemo(() => 0.8, []);

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={rigidBody.kind}
      position={transform.position}
      rotation={transform.rotation as [number, number, number]}
      restitution={rigidBody.restitution}
      friction={rigidBody.friction}
      linearVelocity={velocity?.linearVelocity ?? [0, 0, 0]}
      angularVelocity={velocity?.angularVelocity ?? [0, 0, 0]}
      colliders={false} // Manual Collider management — no auto-generation
    >
      {/* Collider — determines physics behavior */}
      {renderCollider}

      {/* Visual mesh — pure rendering; Rapier auto-syncs transforms */}
      <mesh
        castShadow
        receiveShadow
        onClick={handleClick}
      >
        {renderGeometry}
        <meshStandardMaterial
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
        />
      </mesh>

      {/* Selection highlight outline — D-07, UI-SPEC Panel 4 */}
      {isSelected && (
        <Outlines
          thickness={0.05}
          color="#3b82f6"       // accent blue-500 (UI-SPEC)
          screenspace={false}   // World-space line width (consistent thickness)
          opacity={pulseOpacity}
          angle={Math.PI}       // Full-angle edge detection
        />
      )}
    </RigidBody>
  );
}
