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
  CurrentSourceComponent,
  TransformComponent,
  ColliderComponent,
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

// ── 导线（currentSource）磁感线 — Phase 8 场-源可视化 ──

/** 同心圆环半径（m） */
const WIRE_RADII = [0.75, 1.5, 2.25, 3];
const WIRE_CIRCLE_SEGMENTS = 32;
/** 每个圆环上的切向箭头数 */
const WIRE_ARROWS_PER_CIRCLE = 4;
const WIRE_ARROW_LENGTH = 0.3;

/**
 * 生成载流导线的磁感线：绕导线轴的同心圆环（毕奥-萨伐尔无限长直导线模型）。
 * - 3 个垂直于电流方向的截面：中心 ± halfExtent
 * - 每截面 4 个半径的闭合圆环（虚线风格与预设力场力线一致）
 * - 每圆环 4 个切向箭头指示 B 方向（右手定则 d × r̂，负电流翻转）
 * current=0 或 direction 为零向量时返回空数组。
 */
export function generateWireLines(
  position: [number, number, number],
  current: number,
  direction: [number, number, number],
  halfExtent = 2,
): { positions: Float32Array; colors: Float32Array } {
  const positions: number[] = [];
  const colors: number[] = [];

  const d = new THREE.Vector3(...direction);
  if (current === 0 || d.lengthSq() < 1e-12) {
    return { positions: new Float32Array(0), colors: new Float32Array(0) };
  }
  d.normalize();

  const center = new THREE.Vector3(...position);
  const color = COLORS.magnetic;

  // 与 d 垂直的局部坐标系 (u, v)
  const up = Math.abs(d.y) > 0.999 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(d, up).normalize();
  const v = new THREE.Vector3().crossVectors(d, u).normalize();

  const sign = Math.sign(current);
  const planeOffsets = [-halfExtent, 0, halfExtent];

  for (const off of planeOffsets) {
    const planeCenter = center.clone().add(d.clone().multiplyScalar(off));
    for (const r of WIRE_RADII) {
      // 闭合圆环折线（首尾相接，连续点 → lineSegments 虚线风格）
      for (let s = 0; s <= WIRE_CIRCLE_SEGMENTS; s++) {
        const theta = (s / WIRE_CIRCLE_SEGMENTS) * Math.PI * 2;
        const p = planeCenter.clone()
          .add(u.clone().multiplyScalar(Math.cos(theta) * r))
          .add(v.clone().multiplyScalar(Math.sin(theta) * r));
        positions.push(p.x, p.y, p.z);
        colors.push(color.r, color.g, color.b);
      }
      // 切向箭头：t = d × r̂（右手定则，与 fieldSourceCalc 的 B 方向一致）
      for (let k = 0; k < WIRE_ARROWS_PER_CIRCLE; k++) {
        const theta = (k / WIRE_ARROWS_PER_CIRCLE) * Math.PI * 2;
        const radial = u.clone().multiplyScalar(Math.cos(theta))
          .add(v.clone().multiplyScalar(Math.sin(theta)));
        const p = planeCenter.clone().add(radial.clone().multiplyScalar(r));
        const tip = p.clone().add(
          new THREE.Vector3().crossVectors(d, radial).multiplyScalar(sign * WIRE_ARROW_LENGTH),
        );
        positions.push(p.x, p.y, p.z, tip.x, tip.y, tip.z);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
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

// ── 主导线磁感线组件 ──

interface WireLineSegmentsProps {
  position: [number, number, number];
  current: number;
  direction: [number, number, number];
  halfExtent: number;
}

function WireLineSegments({ position, current, direction, halfExtent }: WireLineSegmentsProps) {
  const geometry = useMemo(() => {
    const data = generateWireLines(position, current, direction, halfExtent);
    if (data.positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    return geo;
  }, [position, current, direction, halfExtent]);

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

  // 收集所有力场实体 + 载流导线实体
  const forceFieldEntries: { id: string; field: ForceFieldComponent }[] = [];
  const wireEntries: WireLineSegmentsProps & { id: string }[] = [];
  for (const [id, entity] of entities) {
    const field = entity.components.get('forceField') as ForceFieldComponent | undefined;
    if (field) forceFieldEntries.push({ id, field });

    const cs = entity.components.get('currentSource') as CurrentSourceComponent | undefined;
    if (cs) {
      const tr = entity.components.get('transform') as TransformComponent | undefined;
      const col = entity.components.get('collider') as ColliderComponent | undefined;
      if (tr) {
        wireEntries.push({
          id,
          position: tr.position,
          current: cs.magnitude,
          direction: cs.direction,
          halfExtent: col?.params.halfHeight ?? 2,
        });
      }
    }
  }

  if (forceFieldEntries.length === 0 && wireEntries.length === 0) return null;

  return (
    <group>
      {forceFieldEntries.map(({ id, field }) => (
        <FieldLineSegments key={id} field={field} />
      ))}
      {wireEntries.map(({ id, ...wire }) => (
        <WireLineSegments key={id} {...wire} />
      ))}
    </group>
  );
}
