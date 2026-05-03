import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Quaternion, CylinderGeometry, ConeGeometry, MeshBasicMaterial, Mesh } from 'three';
import { useSimulationStore } from '../store';
import { useVisualizationStore } from '../store/visualizationStore';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import { scaleForceToLength, scaleVelocityToLength } from '../utils/vectorScale';
import { getRecentContactForce } from './contactForceStore';
import type { ConstraintComponent, VectorComponent } from '../ecs/types';

const COLORS = {
  gravity:  '#888888',
  spring:   '#22c55e',
  contact:  '#ef4444',
  drag:     '#eab308',
  net:      '#ffffff',
  velocity: '#3b82f6',
} as const;

const DEFAULT_UP = new Vector3(0, 1, 0);

type ForceType = keyof typeof COLORS;

interface ForceEntry {
  type: ForceType;
  direction: [number, number, number];
  magnitude: number;
}

function createArrowGroup(color: string, shaftRadius: number, headRadius: number): Group {
  const group = new Group();

  const shaftGeo = new CylinderGeometry(shaftRadius, shaftRadius, 1, 8);
  const shaftMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const shaft = new Mesh(shaftGeo, shaftMat);
  group.add(shaft);

  const headGeo = new ConeGeometry(headRadius, 1, 12);
  const headMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const head = new Mesh(headGeo, headMat);
  group.add(head);

  return group;
}

function updateArrowGroup(
  group: Group,
  origin: [number, number, number],
  direction: [number, number, number],
  shaftRadius: number,
  headRadius: number,
  length: number
) {
  if (length < 0.001) {
    group.visible = false;
    return;
  }
  group.visible = true;
  group.position.set(origin[0], origin[1], origin[2]);

  const dir = new Vector3(...direction).normalize();
  const quat = new Quaternion().setFromUnitVectors(DEFAULT_UP, dir);
  group.quaternion.copy(quat);

  const shaftLength = length * 0.75;
  const headLength = length * 0.25;

  const shaft = group.children[0] as Mesh;
  const head = group.children[1] as Mesh;

  if (shaft && head) {
    shaft.scale.y = shaftLength;
    shaft.position.set(0, shaftLength / 2, 0);
    head.position.set(0, shaftLength + headLength / 2, 0);
    head.scale.y = headLength;
  }
}

export function VectorRenderer() {
  const entities = useSimulationStore((s) => s.entities);
  const environment = useSimulationStore((s) => s.environment);
  const selectedId = useSimulationStore((s) => s.selectedEntityId);
  const { showVelocityVectors, showForceVectors, vectorDisplayMode } =
    useVisualizationStore();
  const { getRef } = useRigidBodyRefRegistry();

  const lastForceCalcRef = useRef(0);
  const rootGroupRef = useRef<Group>(null);

  const arrowGroupsRef = useRef<Map<string, Group[]>>(new Map());
  const arrowDataRef = useRef<
    Map<
      string,
      {
        velocity: { dir: [number, number, number]; len: number } | null;
        forces: ForceEntry[];
      }
    >
  >(new Map());

  useFrame((_, delta) => {
    if (!rootGroupRef.current) return;

    lastForceCalcRef.current += delta;
    const shouldRecalc = lastForceCalcRef.current >= 0.5;

    if (shouldRecalc) {
      lastForceCalcRef.current = 0;
      arrowDataRef.current.clear();

      const gravityVec = new Vector3(
        environment.gravity[0],
        environment.gravity[1],
        environment.gravity[2]
      );
      const gravityStrength = gravityVec.length();
      const gravityDir = gravityStrength > 0 ? gravityVec.clone().normalize() : new Vector3(0, -1, 0);
      const dragCoeff = environment.drag;

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

      for (const [entityId, entity] of entities) {
        const vecComp = entity.components.get('vector') as
          | VectorComponent
          | undefined;

        const rbRef = getRef(entityId);
        if (!rbRef || !rbRef.current) continue;

        if (vectorDisplayMode === 'selected' && entityId !== selectedId) continue;

        const vel = rbRef.current.linvel();
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
        const mass = rbRef.current.mass();

        const forces: ForceEntry[] = [];

        if (showForceVectors && gravityStrength > 0 && mass > 0) {
          forces.push({
            type: 'gravity',
            direction: [gravityDir.x, gravityDir.y, gravityDir.z],
            magnitude: mass * gravityStrength,
          });
        }

        if (showForceVectors && dragCoeff > 0 && speed > 0.01) {
          forces.push({
            type: 'drag',
            direction: [-vel.x / speed, -vel.y / speed, -vel.z / speed],
            magnitude: dragCoeff * speed,
          });
        }

        if (showForceVectors) {
          const springForces = springForceMap.get(entityId);
          if (springForces) {
            forces.push(...springForces);
          }
        }

        if (showForceVectors) {
          const cf = getRecentContactForce(entityId);
          if (cf && cf.length() > 0.01) {
            forces.push({
              type: 'contact',
              direction: [cf.x, cf.y, cf.z],
              magnitude: cf.length(),
            });
          }
        }

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
          arrowDataRef.current.set(entityId, entry);
        } else {
          arrowDataRef.current.delete(entityId);
        }
      }
    }

    // ── 每帧更新所有箭头位置、方向、大小 ──
    const activeIds = new Set<string>();

    for (const [entityId, entity] of entities) {
      const vecComp = entity.components.get('vector') as
        | VectorComponent
        | undefined;

      if (vectorDisplayMode === 'selected' && entityId !== selectedId) continue;

      const rbRef = getRef(entityId);
      if (!rbRef?.current) continue;

      const data = arrowDataRef.current.get(entityId);
      if (!data) continue;

      activeIds.add(entityId);

      const pos = rbRef.current.translation();
      const origin: [number, number, number] = [pos.x, pos.y, pos.z];

      // 实时更新速度方向/大小（不依赖 0.5s 计算缓存）
      let velocity = data.velocity;
      if (showVelocityVectors && vecComp?.showVelocity !== false) {
        const vel = rbRef.current.linvel();
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
        if (speed > 0.01) {
          velocity = {
            dir: [vel.x / speed, vel.y / speed, vel.z / speed],
            len: scaleVelocityToLength(speed),
          };
        } else {
          velocity = null;
        }
      }

      // 实时检查接触力
      let forces = data.forces;
      if (showForceVectors && vecComp?.showForces !== false) {
        const cf = getRecentContactForce(entityId);
        const hasContactInList = forces.some((f) => f.type === 'contact');
        if (cf && cf.length() > 0.01) {
          const contactEntry: ForceEntry = {
            type: 'contact',
            direction: [cf.x, cf.y, cf.z],
            magnitude: cf.length(),
          };
          if (hasContactInList) {
            forces = forces.map((f) => (f.type === 'contact' ? contactEntry : f));
          } else {
            forces = [...forces, contactEntry];
          }
        } else if (hasContactInList) {
          forces = forces.filter((f) => f.type !== 'contact');
        }
      }

      const groups = arrowGroupsRef.current.get(entityId);
      if (!groups || groups.length === 0) {
        const newGroups: Group[] = [];

        if (velocity && vecComp?.showVelocity !== false && showVelocityVectors) {
          const g = createArrowGroup(COLORS.velocity, 0.015, 0.045);
          rootGroupRef.current!.add(g);
          newGroups.push(g);
        }

        if (showForceVectors && vecComp?.showForces !== false) {
          for (const force of forces) {
            const shaftR = force.type === 'net' ? 0.025 : 0.015;
            const headR = force.type === 'net' ? 0.07 : 0.045;
            const g = createArrowGroup(COLORS[force.type], shaftR, headR);
            rootGroupRef.current!.add(g);
            newGroups.push(g);
          }
        }

        arrowGroupsRef.current.set(entityId, newGroups);

        let gi = 0;
        if (velocity && vecComp?.showVelocity !== false && showVelocityVectors) {
          if (gi < newGroups.length) {
            updateArrowGroup(newGroups[gi], origin, velocity.dir, 0.015, 0.045, velocity.len);
          }
          gi++;
        }
        if (showForceVectors && vecComp?.showForces !== false) {
          for (const force of forces) {
            if (gi < newGroups.length) {
              const shaftR = force.type === 'net' ? 0.025 : 0.015;
              const headR = force.type === 'net' ? 0.07 : 0.045;
              updateArrowGroup(newGroups[gi], origin, force.direction, shaftR, headR, scaleForceToLength(force.magnitude));
            }
            gi++;
          }
        }
        continue;
      }

      let groupIdx = 0;
      if (velocity && vecComp?.showVelocity !== false && showVelocityVectors) {
        if (groupIdx < groups.length) {
          updateArrowGroup(groups[groupIdx], origin, velocity.dir, 0.015, 0.045, velocity.len);
        }
        groupIdx++;
      }

      if (showForceVectors && vecComp?.showForces !== false) {
        for (const force of forces) {
          if (groupIdx < groups.length) {
            const shaftR = force.type === 'net' ? 0.025 : 0.015;
            const headR = force.type === 'net' ? 0.07 : 0.045;
            updateArrowGroup(
              groups[groupIdx],
              origin,
              force.direction,
              shaftR,
              headR,
              scaleForceToLength(force.magnitude)
            );
          }
          groupIdx++;
        }
      }
    }

    arrowGroupsRef.current.forEach((groups, id) => {
      if (!activeIds.has(id)) {
        groups.forEach((g) => {
          g.removeFromParent();
        });
        arrowGroupsRef.current.delete(id);
      }
    });
  });

  return <group ref={rootGroupRef} />;
}
