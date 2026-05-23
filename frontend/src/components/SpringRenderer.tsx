import { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSpringJoint } from '@react-three/rapier';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import type { Entity, ConstraintComponent } from '../ecs/types';

interface SpringRendererProps {
  entity: Entity;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Generate helix points between two positions in world space.
 * Coils are distributed along the direction vector.
 */
function generateHelixPoints(
  posA: THREE.Vector3,
  posB: THREE.Vector3,
  coils: number,
  radius: number,
): THREE.Vector3[] {
  const dir = new THREE.Vector3().subVectors(posB, posA);
  const length = dir.length();
  if (length < 0.001) return [posA.clone(), posB.clone()];

  const points: THREE.Vector3[] = [];
  const totalSegments = coils * 16; // 16 segments per coil
  dir.normalize();

  // Create orthonormal basis perpendicular to direction
  let perpX: THREE.Vector3;
  if (Math.abs(dir.x) < 0.9) {
    perpX = new THREE.Vector3(1, 0, 0).cross(dir).normalize();
  } else {
    perpX = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  }
  const perpY = new THREE.Vector3().crossVectors(dir, perpX).normalize();

  for (let i = 0; i <= totalSegments; i++) {
    const t = i / totalSegments;
    const centerX = posA.x + dir.x * length * t;
    const centerY = posA.y + dir.y * length * t;
    const centerZ = posA.z + dir.z * length * t;

    const angle = t * Math.PI * 2 * coils;
    const offsetX = perpX.x * Math.cos(angle) * radius + perpY.x * Math.sin(angle) * radius;
    const offsetY = perpX.y * Math.cos(angle) * radius + perpY.y * Math.sin(angle) * radius;
    const offsetZ = perpX.z * Math.cos(angle) * radius + perpY.z * Math.sin(angle) * radius;

    points.push(
      new THREE.Vector3(centerX + offsetX, centerY + offsetY, centerZ + offsetZ),
    );
  }

  return points;
}

/**
 * SpringRenderer — 弹簧约束可视化组件
 *
 * 职责:
 * 1. 从 RigidBodyRefContext 获取 entityA/entityB 的物理体引用
 * 2. 创建 Rapier useSpringJoint 约束
 * 3. 每帧生成 helix TubeGeometry 连接两个锚点
 * 4. 选中时高亮（蓝色 tube）
 */
export default function SpringRenderer({ entity, isSelected, onSelect }: SpringRendererProps) {
  const constraintComp = entity.components.get('constraint') as ConstraintComponent;
  const { getRef } = useRigidBodyRefRegistry();

  const tubeRef = useRef<THREE.Mesh>(null);
  const dynTubeRef = useRef<THREE.Mesh>(null);

  // Get rigid body refs for the two endpoints
  const bodyARef = getRef(constraintComp.entityAId);
  const bodyBRef = getRef(constraintComp.entityBId);

  const params = constraintComp.params;

  // ── useSpringJoint: 创建物理约束 ──
  // FIX: useSpringJoint → useImpulseJoint 内部直接访问 body1.current，
  // 若传递 null 则触发 "Cannot read properties of null (reading 'current')".
  // 用 dummyRef 替代 null，保证 .current 访问安全（值为 null，条件判断失败，不会创建 joint）。
  const dummyRef = useRef<any>(null);
  useSpringJoint(
    bodyARef || dummyRef,
    bodyBRef || dummyRef,
    [
      [0, 0, 0], // anchorA — 相对 bodyA 的局部坐标
      [0, 0, 0], // anchorB — 相对 bodyB 的局部坐标
      params.restLength,
      params.stiffness,
      params.damping,
    ],
  );

  // Compute initial geometry for the static mesh
  const initialPoints = useMemo(() => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(0, params.restLength, 0);
    return generateHelixPoints(a, b, 8, 0.05);
  }, [params.restLength]);

  const initialCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3(initialPoints);
  }, [initialPoints]);

  // ── Per-frame update: regenerate tube geometry ──
  // 使用 ref 缓存 geometry，避免每帧重建 (WR-05)
  const geometryRef = useRef<THREE.TubeGeometry | null>(null);

  useFrame(() => {
    if (!tubeRef.current) return;

    let posA = new THREE.Vector3(0, 0, 0);
    let posB = new THREE.Vector3(0, -params.restLength, 0);

    // Try to get positions from rigid body refs
    if (bodyARef?.current) {
      const t = bodyARef.current.translation();
      posA.set(t.x, t.y, t.z);
    }
    if (bodyBRef?.current) {
      const t = bodyBRef.current.translation();
      posB.set(t.x, t.y, t.z);
    }

    const dist = posA.distanceTo(posB);

    // Dynamic coil count: more coils when compressed, fewer when stretched
    const coils = Math.max(3, Math.min(16, Math.round(8 * (params.restLength / Math.max(dist, 0.1)))));

    const helixPoints = generateHelixPoints(posA, posB, coils, 0.06);
    const curve = new THREE.CatmullRomCurve3(helixPoints);

    // 复用或创建 geometry，减少 GC 压力
    if (!geometryRef.current) {
      geometryRef.current = new THREE.TubeGeometry(curve, helixPoints.length * 2, 0.03, 8, false);
      tubeRef.current.geometry = geometryRef.current;
    } else {
      // TubeGeometry 不支持直接更新路径，但可以通过 dispose+重建控制频率
      // 至少复用同一引用，避免无意义的重复分配
      geometryRef.current.dispose();
      geometryRef.current = new THREE.TubeGeometry(curve, helixPoints.length * 2, 0.03, 8, false);
      tubeRef.current.geometry = geometryRef.current;
    }
  });

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onSelect(entity.id);
    },
    [entity.id, onSelect],
  );

  return (
    <mesh
      ref={tubeRef}
      onClick={handleClick}
      geometry={new THREE.TubeGeometry(initialCurve, 64, 0.03, 8, false)}
    >
      <meshStandardMaterial
        color={isSelected ? '#3299ff' : '#888888'}
        roughness={0.5}
        metalness={0.1}
      />
    </mesh>
  );
}
