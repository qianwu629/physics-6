import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRapier } from '@react-three/rapier';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import type {
  Entity,
  ConstraintComponent,
  FixedJointComponent,
  RevoluteJointComponent,
  SphericalJointComponent,
  RopeJointComponent,
} from '../ecs/types';

interface JointRendererProps {
  entity: Entity;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const IDENTITY_QUAT = { x: 0, y: 0, z: 0, w: 1 };
const UP = new THREE.Vector3(0, 1, 0);

/**
 * 关节就绪重试（修复轻杆脱落）
 *
 * r3f-rapier 的 useImpulseJoint 只在挂载的 useEffect 里检查一次 ref：
 * 空则不创建且永不重试。轻杆流程中「杆体 + 两端关节」在同一批 store 更新创建，
 * 关节挂载时杆的 ref 尚未注册（EntityRenderer 的 register effect 下一帧才跑），
 * 导致关节永远不创建、杆成自由体脱落。
 *
 * 这里改为 useFrame 逐帧检查：两端 ref 就绪才创建一次；卸载时销毁。
 */
function useImpulseJointWhenReady(
  bodyARef: any,
  bodyBRef: any,
  makeJointData: (rapier: any) => any,
) {
  const { world, rapier } = useRapier();
  const jointRef = useRef<any>(null);

  useFrame(() => {
    if (jointRef.current) return;
    if (!bodyARef?.current || !bodyBRef?.current) return;
    jointRef.current = world.createImpulseJoint(makeJointData(rapier), bodyARef.current, bodyBRef.current, true);
  });

  useEffect(() => {
    return () => {
      const joint = jointRef.current;
      jointRef.current = null;
      if (joint && world.getImpulseJoint(joint.handle)) {
        world.removeImpulseJoint(joint, true);
      }
    };
  }, [world]);
}

/**
 * 连接线（三种关节共用）：两体质心之间的细圆柱，逐帧就地更新。
 */
function LinkLine({
  bodyARef,
  bodyBRef,
  isSelected,
  onClick,
}: {
  bodyARef: any;
  bodyBRef: any;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const linkRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const link = linkRef.current;
    if (!link || !bodyARef?.current || !bodyBRef?.current) return;
    const a = bodyARef.current.translation();
    const b = bodyBRef.current.translation();
    const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const len = dir.length();
    if (len < 1e-6) return;
    link.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    link.scale.set(1, len, 1);
    link.quaternion.setFromUnitVectors(UP, dir.normalize());
  });

  return (
    <mesh ref={linkRef} onClick={onClick}>
      <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
      <meshStandardMaterial
        color={isSelected ? '#29d3e8' : '#8b7fd4'}
        roughness={0.4}
        metalness={0.2}
        emissive={isSelected ? '#29d3e8' : '#8b7fd4'}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

function FixedJointBody({ constraint, bodyARef, bodyBRef }: { constraint: FixedJointComponent; bodyARef: any; bodyBRef: any }) {
  const { anchorA, anchorB, frameB } = constraint.params;
  useImpulseJointWhenReady(bodyARef, bodyBRef, (rapier) =>
    rapier.JointData.fixed(
      { x: anchorA[0], y: anchorA[1], z: anchorA[2] },
      IDENTITY_QUAT,
      { x: anchorB[0], y: anchorB[1], z: anchorB[2] },
      { x: frameB[0], y: frameB[1], z: frameB[2], w: frameB[3] },
    ),
  );
  return null;
}

function RevoluteJointBody({ constraint, bodyARef, bodyBRef }: { constraint: RevoluteJointComponent; bodyARef: any; bodyBRef: any }) {
  const { anchorA, anchorB, axisA } = constraint.params;
  useImpulseJointWhenReady(bodyARef, bodyBRef, (rapier) =>
    rapier.JointData.revolute(
      { x: anchorA[0], y: anchorA[1], z: anchorA[2] },
      { x: anchorB[0], y: anchorB[1], z: anchorB[2] },
      { x: axisA[0], y: axisA[1], z: axisA[2] },
    ),
  );
  return null;
}

function SphericalJointBody({ constraint, bodyARef, bodyBRef }: { constraint: SphericalJointComponent; bodyARef: any; bodyBRef: any }) {
  const { anchorA, anchorB } = constraint.params;
  useImpulseJointWhenReady(bodyARef, bodyBRef, (rapier) =>
    rapier.JointData.spherical(
      { x: anchorA[0], y: anchorA[1], z: anchorA[2] },
      { x: anchorB[0], y: anchorB[1], z: anchorB[2] },
    ),
  );
  return null;
}

function RopeJointBody({ constraint, bodyARef, bodyBRef }: { constraint: RopeJointComponent; bodyARef: any; bodyBRef: any }) {
  const { anchorA, anchorB, length } = constraint.params;
  useImpulseJointWhenReady(bodyARef, bodyBRef, (rapier) =>
    rapier.JointData.rope(
      length,
      { x: anchorA[0], y: anchorA[1], z: anchorA[2] },
      { x: anchorB[0], y: anchorB[1], z: anchorB[2] },
    ),
  );
  return null;
}

/**
 * FixedJointRenderer（关节分发器）— W4 固定连接 / 二期铰链、球窝
 *
 * 按约束 kind 分发到对应 joint hook 子组件；连接线可视化（showLink）共用。
 */
export default function FixedJointRenderer({ entity, isSelected, onSelect }: JointRendererProps) {
  const constraintComp = entity.components.get('constraint') as ConstraintComponent;
  const { getRef } = useRigidBodyRefRegistry();

  const bodyARef = getRef(constraintComp.entityAId);
  const bodyBRef = getRef(constraintComp.entityBId);

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onSelect(entity.id);
    },
    [entity.id, onSelect],
  );

  const showLink = 'showLink' in constraintComp.params ? (constraintComp.params.showLink ?? true) : true;

  return (
    <>
      {constraintComp.kind === 'fixed' && (
        <FixedJointBody constraint={constraintComp} bodyARef={bodyARef} bodyBRef={bodyBRef} />
      )}
      {constraintComp.kind === 'revolute' && (
        <RevoluteJointBody constraint={constraintComp} bodyARef={bodyARef} bodyBRef={bodyBRef} />
      )}
      {constraintComp.kind === 'spherical' && (
        <SphericalJointBody constraint={constraintComp} bodyARef={bodyARef} bodyBRef={bodyBRef} />
      )}
      {constraintComp.kind === 'rope' && (
        <RopeJointBody constraint={constraintComp} bodyARef={bodyARef} bodyBRef={bodyBRef} />
      )}
      {showLink && (
        <LinkLine bodyARef={bodyARef} bodyBRef={bodyBRef} isSelected={isSelected} onClick={handleClick} />
      )}
    </>
  );
}
