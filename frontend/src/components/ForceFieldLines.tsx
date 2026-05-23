import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import { useVisualizationStore } from '../store/visualizationStore';
import type {
  ForceFieldComponent,
  UniformFieldComponent,
  GravityFieldComponent,
  ElectricFieldComponent,
  MagneticFieldComponent,
} from '../ecs/types';

// ── 颜色常量（与 ForceFieldRenderer 一致）──
const COLORS = {
  uniform: new THREE.Color('#3b82f6'),   // 蓝
  magnetic: new THREE.Color('#a855f7'),  // 紫
  gravity: new THREE.Color('#88aabb'),   // 淡蓝灰
  electricPositive: new THREE.Color('#ff4444'), // 红
  electricNegative: new THREE.Color('#4444ff'), // 蓝
  electricNeutral: new THREE.Color('#888888'),  // 灰
} as const;

// T-03-11: 力线数量上限
const MAX_LINES_UNIFORM = 64;
const MAX_LINES_GRAVITY = 64;
const MAX_LINES_MAGNETIC = 64;
const MAX_LINES_ELECTRIC = 32;
const SEGMENTS_PER_LINE = 20;

/**
 * 生成均匀场的平行等距力线
 * 在 range 范围内按 2m 间距排列，方向 = field.direction
 */
function generateUniformLines(
  field: UniformFieldComponent,
): { positions: Float32Array; colors: Float32Array } {
  const spacing = 2.0;
  const halfRange = field.range / 2;
  const stepsPerAxis = Math.floor(field.range / spacing) + 1;
  const totalPossible = stepsPerAxis * stepsPerAxis; // 只在 XZ 平面排列，Y 方向延伸

  // 限制数量
  const maxLines = Math.min(totalPossible, MAX_LINES_UNIFORM);
  const actualSpacing = totalPossible > MAX_LINES_UNIFORM
    ? field.range / (Math.floor(Math.sqrt(MAX_LINES_UNIFORM)) - 1)
    : spacing;

  const positions: number[] = [];
  const colors: number[] = [];
  const color = COLORS.uniform;

  const dir = new THREE.Vector3(...field.direction).normalize();
  const halfLen = field.range * 0.5;

  // 构建一个与 dir 垂直的局部坐标系
  const up = new THREE.Vector3(0, 1, 0);
  let u = new THREE.Vector3().crossVectors(dir, up).normalize();
  if (u.lengthSq() < 0.001) {
    u = new THREE.Vector3(1, 0, 0);
  }
  const v = new THREE.Vector3().crossVectors(dir, u).normalize();

  const steps = Math.floor(field.range / actualSpacing) + 1;
  let lineCount = 0;

  for (let i = 0; i < steps && lineCount < maxLines; i++) {
    for (let j = 0; j < steps && lineCount < maxLines; j++) {
      const offsetU = -halfRange + i * actualSpacing;
      const offsetV = -halfRange + j * actualSpacing;

      const center = new THREE.Vector3(...field.position);
      center.add(u.clone().multiplyScalar(offsetU));
      center.add(v.clone().multiplyScalar(offsetV));

      const start = center.clone().add(dir.clone().multiplyScalar(-halfLen));
      const end = center.clone().add(dir.clone().multiplyScalar(halfLen));

      for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
        const t = s / SEGMENTS_PER_LINE;
        positions.push(
          start.x + (end.x - start.x) * t,
          start.y + (end.y - start.y) * t,
          start.z + (end.z - start.z) * t,
        );
        colors.push(color.r, color.g, color.b);
      }

      lineCount++;
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}

/**
 * 生成引力场的径向汇聚力线
 * 从 range 边界向中心汇聚，均匀角度分布
 */
function generateGravityLines(
  field: GravityFieldComponent,
): { positions: Float32Array; colors: Float32Array } {
  const lineCount = MAX_LINES_GRAVITY;
  const positions: number[] = [];
  const colors: number[] = [];
  const color = COLORS.gravity;

  const center = new THREE.Vector3(...field.position);
  const range = field.range;

  // 使用斐波那契球面分布获得均匀角度
  const phi = Math.PI * (3 - Math.sqrt(5)); // 黄金角

  for (let i = 0; i < lineCount; i++) {
    const y = 1 - (i / (lineCount - 1)) * 2; // y 从 1 到 -1
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;

    const dirX = Math.cos(theta) * radius;
    const dirY = y;
    const dirZ = Math.sin(theta) * radius;

    const start = new THREE.Vector3(
      center.x + dirX * range,
      center.y + dirY * range,
      center.z + dirZ * range,
    );
    const end = center.clone();

    for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
      const t = s / SEGMENTS_PER_LINE;
      positions.push(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
        start.z + (end.z - start.z) * t,
      );
      colors.push(color.r, color.g, color.b);
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}

/**
 * 生成电场力线
 * 从正电荷发出 / 向负电荷汇聚，数量 ∝ |charge|（min 8, max 32）
 */
function generateElectricLines(
  field: ElectricFieldComponent,
): { positions: Float32Array; colors: Float32Array } {
  const lineCount = Math.max(8, Math.min(MAX_LINES_ELECTRIC, Math.floor(Math.abs(field.charge) * 2)));
  const positions: number[] = [];
  const colors: number[] = [];

  const isPositive = field.charge > 0;
  const color = isPositive
    ? COLORS.electricPositive
    : field.charge < 0
      ? COLORS.electricNegative
      : COLORS.electricNeutral;

  const center = new THREE.Vector3(...field.position);
  const range = field.range;

  const phi = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < lineCount; i++) {
    const y = 1 - (i / (lineCount - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;

    const dirX = Math.cos(theta) * radius;
    const dirY = y;
    const dirZ = Math.sin(theta) * radius;

    let start: THREE.Vector3;
    let end: THREE.Vector3;

    if (isPositive) {
      // 从中心向外发出
      start = center.clone();
      end = new THREE.Vector3(
        center.x + dirX * range,
        center.y + dirY * range,
        center.z + dirZ * range,
      );
    } else {
      // 从边界向中心汇聚
      start = new THREE.Vector3(
        center.x + dirX * range,
        center.y + dirY * range,
        center.z + dirZ * range,
      );
      end = center.clone();
    }

    for (let s = 0; s <= SEGMENTS_PER_LINE; s++) {
      const t = s / SEGMENTS_PER_LINE;
      positions.push(
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
        start.z + (end.z - start.z) * t,
      );
      colors.push(color.r, color.g, color.b);
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}

/**
 * 生成磁场力线（均匀磁场用平行线，同 uniform）
 */
function generateMagneticLines(
  field: MagneticFieldComponent,
): { positions: Float32Array; colors: Float32Array } {
  // 均匀磁场用平行线，逻辑与 uniform 相同
  const uniformLike: UniformFieldComponent = {
    type: 'forceField',
    kind: 'uniform',
    position: field.position,
    range: field.range,
    direction: field.direction,
    strength: field.strength,
  };
  const result = generateUniformLines(uniformLike);

  // 替换颜色为磁场紫
  const color = COLORS.magnetic;
  const colors = new Float32Array(result.colors.length);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }

  return { positions: result.positions, colors };
}

// ── 按 kind 生成力线几何 ──

function generateFieldLines(
  field: ForceFieldComponent,
): { positions: Float32Array; colors: Float32Array } | null {
  switch (field.kind) {
    case 'uniform':
      return generateUniformLines(field as UniformFieldComponent);
    case 'gravity':
      return generateGravityLines(field as GravityFieldComponent);
    case 'electric':
      return generateElectricLines(field as ElectricFieldComponent);
    case 'magnetic':
      return generateMagneticLines(field as MagneticFieldComponent);
    default:
      return null;
  }
}

// ── 单力场力线组件 ──

function FieldLineSegments({ field }: { field: ForceFieldComponent }) {
  const geometry = useMemo(() => {
    const data = generateFieldLines(field);
    if (!data) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    return geo;
  }, [field]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} />
    </lineSegments>
  );
}

// ── 主组件 ──

export function ForceFieldLines() {
  const showForceLines = useVisualizationStore((s) => s.showForceLines);
  const entities = useSimulationStore((s) => s.entities);

  if (!showForceLines) return null;

  // 收集所有力场实体
  const forceFieldEntries: { id: string; field: ForceFieldComponent }[] = [];
  for (const [id, entity] of entities) {
    const field = entity.components.get('forceField') as ForceFieldComponent | undefined;
    if (field) forceFieldEntries.push({ id, field });
  }

  if (forceFieldEntries.length === 0) return null;

  return (
    <group>
      {forceFieldEntries.map(({ id, field }) => (
        <FieldLineSegments key={id} field={field} />
      ))}
    </group>
  );
}
