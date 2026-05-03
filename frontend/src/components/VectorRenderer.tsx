import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useSimulationStore } from '../store';
import { useVisualizationStore } from '../store/visualizationStore';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import { Arrow3D } from './Arrow3D';
import { scaleForceToLength, scaleVelocityToLength } from '../utils/vectorScale';
import type { ConstraintComponent, VectorComponent } from '../ecs/types';

const COLORS = {
  gravity:  '#888888',
  spring:   '#22c55e',
  contact:  '#ef4444',
  drag:     '#eab308',
  net:      '#ffffff',
  velocity: '#3b82f6',
} as const;

type ForceType = keyof typeof COLORS;

interface ForceEntry {
  type: ForceType;
  direction: [number, number, number];
  magnitude: number;
}

// 接触力估算：记录碰撞期间的动量变化
interface CollisionRecord {
  entityId: string;
  startTime: number;
  initialVelocity: Vector3;
}

export function VectorRenderer() {
  const entities = useSimulationStore((s) => s.entities);
  const environment = useSimulationStore((s) => s.environment);
  const selectedId = useSimulationStore((s) => s.selectedEntityId);
  const { showVelocityVectors, showForceVectors, vectorDisplayMode } =
    useVisualizationStore();
  const { getRef } = useRigidBodyRefRegistry();

  const collisionRecords = useRef<Map<string, CollisionRecord>>(new Map());
  const contactForces = useRef<Map<string, Vector3>>(new Map());

  const vectorCache = useRef<
    Map<
      string,
      {
        velocity: { dir: [number, number, number]; len: number } | null;
        forces: ForceEntry[];
      }
    >
  >(new Map());
  const lastUpdateRef = useRef(0);

  // 接触力估算：每 0.5 秒更新一次（减少开销）
  const UPDATE_INTERVAL = 0.5;

  useFrame((_, delta) => {
    lastUpdateRef.current += delta;
    if (lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = 0;

    vectorCache.current.clear();

    // 复制 environment 值（避免每 entity 重复读 store）
    const gravityVec = new Vector3(
      environment.gravity[0],
      environment.gravity[1],
      environment.gravity[2]
    );
    const gravityStrength = gravityVec.length();
    const gravityDir = gravityStrength > 0 ? gravityVec.clone().normalize() : new Vector3(0, -1, 0);
    const dragCoeff = environment.drag;

    // ── 预计算弹力（从约束实体查找 entityA/entityB 物理体） ──
    const springForceMap = new Map<string, ForceEntry[]>();
    if (showForceVectors) {
      for (const [, entity] of entities) {
        const constraintComp = entity.components.get('constraint') as
          | ConstraintComponent
          | undefined;
        if (!constraintComp?.params) continue;

        const bodyARef = getRef(constraintComp.entityAId);
        const bodyBRef = getRef(constraintComp.entityBId);
        if (!bodyARef?.current || !bodyBRef?.current) continue;

        const posA = bodyARef.current.translation();
        const posB = bodyBRef.current.translation();
        const springDirVec = new Vector3(
          posB.x - posA.x,
          posB.y - posA.y,
          posB.z - posA.z
        );
        const currentLength = springDirVec.length();
        if (currentLength < 0.0001) continue;

        springDirVec.normalize();
        const displacement = currentLength - constraintComp.params.restLength;
        const springMag =
          constraintComp.params.stiffness * Math.abs(displacement);

        const forceA: ForceEntry = {
          type: 'spring',
          direction: [springDirVec.x, springDirVec.y, springDirVec.z],
          magnitude: springMag,
        };

        // entityB 受反向力
        const forceB: ForceEntry = {
          type: 'spring',
          direction: [-springDirVec.x, -springDirVec.y, -springDirVec.z],
          magnitude: springMag,
        };

        if (!springForceMap.has(constraintComp.entityAId)) {
          springForceMap.set(constraintComp.entityAId, []);
        }
        springForceMap.get(constraintComp.entityAId)!.push(forceA);

        if (!springForceMap.has(constraintComp.entityBId)) {
          springForceMap.set(constraintComp.entityBId, []);
        }
        springForceMap.get(constraintComp.entityBId)!.push(forceB);
      }
    }

    // ── 主循环：遍历所有实体计算受力 ──
    for (const [entityId, entity] of entities) {
      const vecComp = entity.components.get('vector') as
        | VectorComponent
        | undefined;

      const rbRef = getRef(entityId);
      if (!rbRef || !rbRef.current) continue;

      if (
        vectorDisplayMode === 'selected' &&
        entityId !== selectedId
      )
        continue;

      const pos = rbRef.current.translation();
      const vel = rbRef.current.linvel();
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
      const mass = rbRef.current.mass();

      const forces: ForceEntry[] = [];

      // 1. 重力 F = m * g
      if (showForceVectors && gravityStrength > 0 && mass > 0) {
        forces.push({
          type: 'gravity',
          direction: [gravityDir.x, gravityDir.y, gravityDir.z],
          magnitude: mass * gravityStrength,
        });
      }

      // 2. 空气阻力 F = -drag * v
      if (showForceVectors && dragCoeff > 0 && speed > 0.01) {
        forces.push({
          type: 'drag',
          direction: [-vel.x / speed, -vel.y / speed, -vel.z / speed],
          magnitude: dragCoeff * speed,
        });
      }

      // 3. 弹力（从预计算的 springForceMap 读取）
      if (showForceVectors) {
        const springForces = springForceMap.get(entityId);
        if (springForces) {
          forces.push(...springForces);
        }
      }

      // 4. 接触力（从缓存读取估算值）
      if (showForceVectors) {
        const cf = contactForces.current.get(entityId);
        if (cf && cf.length() > 0.01) {
          forces.push({
            type: 'contact',
            direction: [cf.x, cf.y, cf.z],
            magnitude: cf.length(),
          });
        }
      }

      // 5. 合力 = 各分力矢量和
      let netForce: ForceEntry | null = null;
      if (showForceVectors && forces.length > 0) {
        const net = new Vector3(0, 0, 0);
        for (const f of forces) {
          net.x += f.direction[0] * f.magnitude;
          net.y += f.direction[1] * f.magnitude;
          net.z += f.direction[2] * f.magnitude;
        }
        const netMag = net.length();
        if (netMag > 0.01) {
          net.normalize();
          netForce = {
            type: 'net',
            direction: [net.x, net.y, net.z],
            magnitude: netMag,
          };
        }
      }

      // 速度矢量
      let velocity: { dir: [number, number, number]; len: number } | null = null;
      if (showVelocityVectors && vecComp?.showVelocity !== false && speed > 0.01) {
        velocity = {
          dir: [vel.x / speed, vel.y / speed, vel.z / speed],
          len: scaleVelocityToLength(speed),
        };
      }

      if (velocity || forces.length > 0 || netForce) {
        const entry = { velocity, forces };
        if (netForce) entry.forces.push(netForce);
        vectorCache.current.set(entityId, entry);
      }
    }
  });

  return (
    <group>
      {Array.from(vectorCache.current.entries()).map(
        ([entityId, data]) => {
          const rbRef = getRef(entityId);
          if (!rbRef?.current) return null;
          const pos = rbRef.current.translation();
          const origin: [number, number, number] = [pos.x, pos.y, pos.z];

          return (
            <group key={entityId}>
              {data.velocity && (
                <Arrow3D
                  origin={origin}
                  direction={data.velocity.dir}
                  length={data.velocity.len}
                  color={COLORS.velocity}
                />
              )}
              {data.forces.map((force, i) => (
                <Arrow3D
                  key={`${entityId}-${force.type}-${i}`}
                  origin={origin}
                  direction={force.direction}
                  length={scaleForceToLength(force.magnitude)}
                  color={COLORS[force.type]}
                  shaftRadius={force.type === 'net' ? 0.025 : 0.015}
                  headRadius={force.type === 'net' ? 0.07 : 0.045}
                />
              ))}
            </group>
          );
        }
      )}
    </group>
  );
}
