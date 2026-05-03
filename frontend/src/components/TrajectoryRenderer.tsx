import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import { useVisualizationStore } from '../store/visualizationStore';
import { TrajectoryBuffer } from '../ecs/TrajectoryBuffer';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import type { TrailComponent } from '../ecs/types';

const SAMPLE_INTERVAL = 1 / 30; // 30Hz
const VELOCITY_THRESHOLD = 0.01;

interface TrailEntry {
  buffer: TrajectoryBuffer;
  line: THREE.Line;
}

export function TrajectoryRenderer() {
  const entities = useSimulationStore((s) => s.entities);
  const showTrails = useVisualizationStore((s) => s.showTrails);
  const { getRef } = useRigidBodyRefRegistry();

  const trailMap = useRef<Map<string, TrailEntry>>(new Map());
  const lastSampleTime = useRef<Map<string, number>>(new Map());
  const groupRef = useRef<THREE.Group>(null);

  // 创建/更新 trail lines
  useFrame((_, delta) => {
    if (!showTrails) return;

    const now = performance.now() / 1000;

    for (const [entityId, entity] of entities) {
      const trailComp = entity.components.get('trail') as
        | TrailComponent
        | undefined;
      if (trailComp && trailComp.visible === false) continue;

      const rb = getRef(entityId);
      if (!rb || !rb.current) continue;

      const vel = rb.current.linvel();
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
      if (speed < VELOCITY_THRESHOLD) continue;

      // 采样频率检查：使用 ref 跟踪每个实体的上次采样时间
      const prevTime = lastSampleTime.current.get(entityId);
      if (prevTime !== undefined && now - prevTime < SAMPLE_INTERVAL) continue;
      lastSampleTime.current.set(entityId, now);

      let entry = trailMap.current.get(entityId);
      if (!entry) {
        // 创建 BufferGeometry + Line
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(300 * 3);
        const colors = new Float32Array(300 * 3);
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
        geometry.setAttribute(
          'color',
          new THREE.BufferAttribute(colors, 3)
        );
        geometry.setDrawRange(0, 0);

        const material = new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.8,
          depthTest: true,
        });

        const line = new THREE.Line(geometry, material);
        line.frustumCulled = false;
        groupRef.current?.add(line);

        entry = { buffer: new TrajectoryBuffer(), line };
        trailMap.current.set(entityId, entry);
      }

      const buf = entry.buffer;
      const pos = rb.current.translation();
      buf.push(
        new THREE.Vector3(pos.x, pos.y, pos.z),
        now
      );

      // 更新 BufferGeometry
      const { positions: pts, count } = buf.getPoints(now);
      const geo = entry.line.geometry;
      const posAttr = geo.attributes
        .position as THREE.BufferAttribute;
      const colAttr = geo.attributes
        .color as THREE.BufferAttribute;

      const baseColor =
        entity.components.get('material') &&
        typeof (entity.components.get('material') as any).color === 'string'
          ? new THREE.Color(
              (entity.components.get('material') as any).color
            )
          : new THREE.Color('#ffffff');

      for (let i = 0; i < count; i++) {
        posAttr.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
        const t = count > 1 ? i / (count - 1) : 1; // 0=旧, 1=新
        colAttr.setXYZ(
          i,
          baseColor.r * t,
          baseColor.g * t,
          baseColor.b * t
        );
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      geo.setDrawRange(0, count);
    }

    // 清理已删除实体的 trail
    for (const [entityId, entry] of trailMap.current) {
      if (!entities.has(entityId)) {
        groupRef.current?.remove(entry.line);
        entry.line.geometry.dispose();
        (entry.line.material as THREE.Material).dispose();
        trailMap.current.delete(entityId);
        lastSampleTime.current.delete(entityId);
      }
    }
  });

  // 重置模拟时清空所有轨迹
  const isRunning = useSimulationStore((s) => s.isRunning);
  const prevRunning = useRef(isRunning);
  useEffect(() => {
    if (!prevRunning.current && isRunning) {
      // 从暂停→运行 = 重置
      for (const [, entry] of trailMap.current) {
        entry.buffer.clear();
      }
    }
    prevRunning.current = isRunning;
  });

  // 全局开关关闭时隐藏所有 lines
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.visible = showTrails;
    }
  }, [showTrails]);

  return <group ref={groupRef} />;
}
