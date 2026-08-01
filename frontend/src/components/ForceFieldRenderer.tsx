import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import type {
  ForceFieldComponent,
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
} from '../ecs/types';

// ── 颜色常量 ──
const COLORS = {
  uniform: new THREE.Color('#3b82f6'),   // 蓝
  magnetic: new THREE.Color('#a855f7'),  // 紫
  gravity: new THREE.Color('#88aabb'),   // 淡蓝灰
  electricPositive: new THREE.Color('#ff4444'), // 红
  electricNegative: new THREE.Color('#4444ff'), // 蓝
  electricNeutral: new THREE.Color('#888888'),  // 灰
} as const;

// ── 箭头几何体缓存 ──
const ARROW_SHAFT_GEO = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8);
const ARROW_HEAD_GEO = new THREE.ConeGeometry(0.045, 0.2, 12);
const DEFAULT_UP = new THREE.Vector3(0, 1, 0);

// T-03-09: 实例数量上限
const MAX_INSTANCES = 200;

/**
 * 生成均匀场网格点（按 2m 间距）
 * T-03-09: 限制最大实例数 200，超出时自动降低密度
 */
function generateGridPoints(
  center: [number, number, number],
  range: number,
  maxInstances: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const spacing = 2.0;
  const countPerAxis = Math.floor(range / spacing) + 1;
  const total = countPerAxis * countPerAxis * countPerAxis;

  // 如果超出上限，增加间距降低密度
  let actualSpacing = spacing;
  if (total > maxInstances) {
    const maxPerAxis = Math.floor(Math.cbrt(maxInstances));
    actualSpacing = range / Math.max(maxPerAxis - 1, 1);
  }

  const halfRange = range / 2;
  const steps = Math.floor(range / actualSpacing) + 1;

  outer: for (let ix = 0; ix < steps; ix++) {
    for (let iy = 0; iy < steps; iy++) {
      for (let iz = 0; iz < steps; iz++) {
        if (points.length >= maxInstances) break outer;
        const x = center[0] - halfRange + ix * actualSpacing;
        const y = center[1] - halfRange + iy * actualSpacing;
        const z = center[2] - halfRange + iz * actualSpacing;
        points.push(new THREE.Vector3(x, y, z));
      }
    }
  }

  return points;
}

/**
 * 计算箭头旋转四元数（从 DEFAULT_UP 旋转到目标方向）
 */
function getArrowQuaternion(direction: [number, number, number]): THREE.Quaternion {
  const dir = new THREE.Vector3(...direction).normalize();
  if (dir.lengthSq() < 0.0001) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(DEFAULT_UP, dir);
}

// ── 均匀方向场 / 磁场：InstancedMesh 箭头矩阵 ──

function UniformFieldArrows({ field }: { field: UniformFieldComponent | MagneticFieldComponent }) {
  const color = field.kind === 'uniform' ? COLORS.uniform : COLORS.magnetic;
  const direction = field.direction;

  const { shaftMesh, headMesh } = useMemo(() => {
    const points = generateGridPoints(field.position, field.range, MAX_INSTANCES);
    const quat = getArrowQuaternion(direction);

    const shaftMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
    const headMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });

    const shaftGeo = ARROW_SHAFT_GEO.clone();
    const headGeo = ARROW_HEAD_GEO.clone();

    const shaft = new THREE.InstancedMesh(shaftGeo, shaftMat, points.length);
    const head = new THREE.InstancedMesh(headGeo, headMat, points.length);

    const dummy = new THREE.Object3D();
    const shaftOffset = new THREE.Vector3(0, 0.3, 0); // shaft 中心偏移（长度 0.6 的一半）
    const headOffset = new THREE.Vector3(0, 0.7, 0); // head 中心偏移（shaft 0.6 + head 0.2/2）

    for (let i = 0; i < points.length; i++) {
      // shaft
      dummy.position.copy(points[i]).add(shaftOffset);
      dummy.quaternion.copy(quat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shaft.setMatrixAt(i, dummy.matrix);

      // head
      dummy.position.copy(points[i]).add(headOffset);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    }

    shaft.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;

    return { shaftMesh: shaft, headMesh: head };
  }, [field.position, field.range, direction, color]);

  // 清理几何体和材质 — 使用 useEffect 确保卸载时释放资源 (CR-02)
  useEffect(() => {
    return () => {
      shaftMesh.geometry.dispose();
      headMesh.geometry.dispose();
      (shaftMesh.material as THREE.Material).dispose();
      (headMesh.material as THREE.Material).dispose();
    };
  }, [shaftMesh, headMesh]);

  return (
    <group>
      <primitive object={shaftMesh} />
      <primitive object={headMesh} />
    </group>
  );
}

// ── 引力源 / 电场：半透明球体（ShaderMaterial 径向透明度衰减）──

const SPHERE_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPHERE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uRadius;
  uniform vec3 uCenter;
  varying vec3 vWorldPosition;

  void main() {
    float dist = length(vWorldPosition - uCenter);
    float alpha = 0.35 * (1.0 - smoothstep(0.0, 1.0, dist / uRadius));
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function RadialSphere({
  position,
  range,
  color,
}: {
  position: [number, number, number];
  range: number;
  color: THREE.Color;
}) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERTEX_SHADER,
      fragmentShader: SPHERE_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: color },
        uRadius: { value: range },
        uCenter: { value: new THREE.Vector3(...position) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [color, range, position]);

  // 中心发光球（标识源位置）
  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    [color],
  );

  return (
    <group position={position}>
      <mesh material={material}>
        <sphereGeometry args={[range, 32, 32]} />
      </mesh>
      <mesh material={glowMaterial}>
        <sphereGeometry args={[0.15, 16, 16]} />
      </mesh>
    </group>
  );
}

function GravityFieldSphere({ field }: { field: GravityFieldComponent }) {
  return (
    <RadialSphere
      position={field.position}
      range={field.range}
      color={COLORS.gravity}
    />
  );
}

function ElectricFieldSphere({ field }: { field: ElectricFieldComponent }) {
  const color =
    field.charge > 0
      ? COLORS.electricPositive
      : field.charge < 0
        ? COLORS.electricNegative
        : COLORS.electricNeutral;

  return <RadialSphere position={field.position} range={field.range} color={color} />;
}

// ── 主组件 ──

export function ForceFieldRenderer() {
  const entities = useSimulationStore((s) => s.entities);

  // 收集所有力场实体
  const forceFieldEntries = useMemo(() => {
    const entries: { id: string; field: ForceFieldComponent }[] = [];
    for (const [id, entity] of entities) {
      const field = entity.components.get('forceField') as ForceFieldComponent | undefined;
      if (field) entries.push({ id, field });
    }
    return entries;
  }, [entities]);

  return (
    <group>
      {forceFieldEntries.map(({ id, field }) => {
        switch (field.kind) {
          case 'uniform':
            return <UniformFieldArrows key={id} field={field as UniformFieldComponent} />;
          case 'magnetic':
            return <UniformFieldArrows key={id} field={field as MagneticFieldComponent} />;
          case 'gravity':
            return <GravityFieldSphere key={id} field={field as GravityFieldComponent} />;
          case 'electric':
            return <ElectricFieldSphere key={id} field={field as ElectricFieldComponent} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
