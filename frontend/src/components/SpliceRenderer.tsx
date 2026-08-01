import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import type { Entity, SpliceComponent, RigidBodyComponent } from '../ecs/types';

interface SpliceRendererProps {
  entity: Entity;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * SpliceRenderer — 轨道拼接（P5）
 *
 * 职责：
 * 1. 接缝检测盒（无碰撞，纯 JS AABB 判定）：dynamic 体通过时按损耗配置减速
 *    - value：|v| = max(0, |v| − loss)
 *    - percent：|v| × (1 − loss)
 *    同一物体单次通过只作用一次（离开检测盒后重置）
 * 2. 接缝标记可视化（半透明薄板，seam 局部系 = quaternion）
 */
export default function SpliceRenderer({ entity, isSelected, onSelect }: SpliceRendererProps) {
  const constraint = entity.components.get('constraint') as SpliceComponent;
  const entities = useSimulationStore((s) => s.entities);
  const { getRef } = useRigidBodyRefRegistry();

  const { center, halfExtents, quaternion, lossType, loss, showLink = true } = constraint.params;

  const quatInv = useMemo(
    () => new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3]).invert(),
    [quaternion],
  );
  const quat = useMemo(
    () => new THREE.Quaternion(quaternion[0], quaternion[1], quaternion[2], quaternion[3]),
    [quaternion],
  );
  // 已通过检测盒的物体集合（进入时作用一次损耗，离开后移除）
  const passedRef = useRef<Set<string>>(new Set());
  const tmpVec = useRef(new THREE.Vector3());

  useFrame(() => {
    const passed = passedRef.current;
    for (const [entityId, e] of entities) {
      // 跳过两个轨道本体与所有约束实体
      if (entityId === constraint.entityAId || entityId === constraint.entityBId) continue;
      if (e.components.has('constraint')) continue;
      const rbComp = e.components.get('rigidBody') as RigidBodyComponent | undefined;
      if (!rbComp || rbComp.kind !== 'dynamic') continue;

      const ref = getRef(entityId);
      const body = ref?.current;
      if (!body || typeof body.translation !== 'function') continue;

      const pos = body.translation();
      const v = tmpVec.current.set(pos.x - center[0], pos.y - center[1], pos.z - center[2]).applyQuaternion(quatInv);
      const inside =
        Math.abs(v.x) <= halfExtents[0] &&
        Math.abs(v.y) <= halfExtents[1] &&
        Math.abs(v.z) <= halfExtents[2];

      if (inside && !passed.has(entityId)) {
        passed.add(entityId);
        if (typeof body.linvel === 'function' && typeof body.setLinvel === 'function') {
          const vel = body.linvel();
          const speed = Math.hypot(vel.x, vel.y, vel.z);
          if (speed > 0.01) {
            const newSpeed =
              lossType === 'percent'
                ? speed * Math.max(0, 1 - loss)
                : Math.max(0, speed - loss);
            const k = newSpeed / speed;
            body.setLinvel({ x: vel.x * k, y: vel.y * k, z: vel.z * k }, true);
          }
        }
      } else if (!inside && passed.has(entityId)) {
        passed.delete(entityId);
      }
    }
  });

  if (!showLink) return null;

  return (
    <mesh
      position={center}
      quaternion={quat}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(entity.id);
      }}
    >
      <boxGeometry args={[0.06, 0.5, halfExtents[2] * 2]} />
      <meshBasicMaterial
        color={isSelected ? '#29d3e8' : '#f472b6'}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </mesh>
  );
}
