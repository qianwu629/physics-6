import { useRef, useMemo, useCallback, useEffect } from 'react';
import { RigidBody, BallCollider, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Outlines } from '@react-three/drei';
import { Vector3 } from 'three';
import { useSimulationStore } from '../store';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import { setContactForce } from './contactForceStore';
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
  const { register, unregister } = useRigidBodyRefRegistry();

  // 注册/注销 RigidBody ref 以供 SpringRenderer 使用
  useEffect(() => {
    register(entity.id, rigidBodyRef);
    return () => unregister(entity.id);
  }, [entity.id, register, unregister]);

  // ── Phase 3: 全局环境倍率 (D-08) ──
  const frictionScale = useSimulationStore((s) => s.environment.frictionScale);
  const restitutionScale = useSimulationStore((s) => s.environment.restitutionScale);
  const drag = useSimulationStore((s) => s.environment.drag);

  // ── Extract components from Entity ──
  const transform = entity.components.get('transform') as TransformComponent | undefined;
  const rigidBody = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
  const collider = entity.components.get('collider') as ColliderComponent | undefined;
  const velocity = entity.components.get('velocity') as VelocityComponent | undefined;
  const material = entity.components.get('material') as MaterialComponent | undefined;

  // ── Phase 5: Rapier 运行时属性同步 (REN-03 / Pitfall 5 闭环) ──
  // 根因：@react-three/rapier 把 mass/restitution/friction/damping 视为初始化 props；
  //      挂载后必须通过 imperative API 同步。restitution / friction 是 collider-level。
  // 注意：position/velocity 的运行时同步未在此 useEffect 处理（暂停态编辑可走 reset 链路；
  //      运行时编辑会被物理积分覆盖，不是有意义的语义）。
  // 注意：本 hook 必须放在 early-return null 检查之前，遵守 React Rules of Hooks。
  useEffect(() => {
    const rb = rigidBodyRef.current;
    if (!rb) return;
    if (!rigidBody) return; // 缺组件时跳过同步（早退由下方 null 检查处理）

    // RigidBody-level
    // setAdditionalMass(mass, wakeUp=true): 不重新计算 inertia tensor；最小侵入；
    // wakeUp=true 触发休眠物体唤醒以响应新质量。
    rb.setAdditionalMass(rigidBody.mass, true);
    rb.setLinearDamping(drag);
    // 部分版本暴露 setAngularDamping；若类型不存在用 any 兜底
    if (typeof (rb as any).setAngularDamping === 'function') {
      (rb as any).setAngularDamping(drag * 0.5);
    }

    // Collider-level（restitution / friction 在 Rapier 中是 collider 属性，不在 RigidBody 上）
    if (typeof rb.numColliders === 'function' && rb.numColliders() > 0) {
      const col = rb.collider(0);
      col.setRestitution(Math.min(rigidBody.restitution * restitutionScale, 1.0));
      col.setFriction(Math.min(rigidBody.friction * frictionScale, 2.0));
    }
  }, [
    entity.id,
    rigidBody?.mass,
    rigidBody?.restitution,
    rigidBody?.friction,
    restitutionScale,
    frictionScale,
    drag,
  ]);

  // Phase 3: 力场实体跳过 EntityRenderer（由 ForceFieldRenderer 专门渲染）
  if (entity.components.has('forceField')) {
    return null;
  }

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
      mass={rigidBody.mass}
      position={transform.position}
      rotation={transform.rotation as [number, number, number]}
      restitution={Math.min(rigidBody.restitution * restitutionScale, 1.0)}
      friction={Math.min(rigidBody.friction * frictionScale, 2.0)}
      linearDamping={drag}
      angularDamping={drag * 0.5}
      linearVelocity={velocity?.linearVelocity ?? [0, 0, 0]}
      angularVelocity={velocity?.angularVelocity ?? [0, 0, 0]}
      colliders={false} // Manual Collider management — no auto-generation
      onContactForce={(payload) => {
        setContactForce(entity.id, new Vector3(
          payload.totalForce.x,
          payload.totalForce.y,
          payload.totalForce.z
        ));
      }}
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
