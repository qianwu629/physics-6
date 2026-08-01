/**
 * TrackBuilder — 轨道建造器（P4）
 *
 * 三栏布局（与 ObjectBuilder 同构）：
 * - 左栏：轨道类型（平面/斜面/圆弧面）+ 已创建轨道列表
 * - 中栏：3D 预览（点击面编辑摩擦）
 * - 右栏：类型参数 + 可否滑动（fixed/dynamic）+ 面摩擦与固定 + 位置 + 颜色
 *
 * 轨道默认 fixed 不可动（物理题轨道惯例）；圆弧面为楔块分解凸碰撞体（arcGeometry）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ExtrudeGeometry, Shape } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { computeHullPoints } from '../ecs/faceGeometry';
import { RectangleHorizontal, Triangle, Spline, Donut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { useSimulationStore } from '../store';
import { createPlaneTrackEntity, createArcTrackEntity, createWedgeTrackEntity, createDoubleArcTrackEntity, createSpliceEntity, attachFaces } from '../ecs/Entity';
import { getShapeFaces, type FaceDefinition } from '../ecs/faceGeometry';
import { pickFace } from '../ecs/pickFace';
import { slopeWedgeProfile } from '../ecs/profileGeometry';
import { arcSectorOutline, type ArcParams } from '../ecs/arcGeometry';
import { doubleArcBandOutlines } from '../ecs/doubleArcGeometry';
import {
  getSpliceFaces,
  getEntryFace,
  toWorldFace,
  computeSplicePose,
  computeSeamBox,
  pickSpliceFace,
  type SpliceFace,
  type SplicePose,
} from '../ecs/spliceCalc';
import type { ColliderShape, ColliderParams, ColliderComponent, TransformComponent, FaceFriction, Entity } from '../ecs/types';
import { NumField, Vec3Field } from './builderFields';
import { MAX_ENTITIES } from '../store/entitySlice';

// ── 类型 ──

type TrackType = 'plane' | 'slope' | 'arc' | 'doubleArc';

interface TrackState {
  type: TrackType;
  halfWidth: number;    // plane/slope
  halfDepth: number;    // plane/slope
  slopeAngle: number;   // slope（度）
  thinT: number;        // slope 薄端厚度（拼接时自动匹配母版面厚）
  innerR: number;       // arc/doubleArc
  arcAngle: number;     // arc/doubleArc（度）
  arcWidth: number;     // arc/doubleArc
  arcThickness: number; // arc/doubleArc
  channelGap: number;   // doubleArc 通道宽度（内径 = 可通过球的最大直径）
  friction: number;
  movable: boolean;     // 可滑动（dynamic）
  position: [number, number, number];
  color: string;
}

const DEFAULT_STATE: TrackState = {
  type: 'plane',
  halfWidth: 3,
  halfDepth: 1.5,
  slopeAngle: 30,
  thinT: 0.3,
  innerR: 3,
  arcAngle: 90,
  arcWidth: 2,
  arcThickness: 0.5,
  channelGap: 0.6,
  friction: 0.3,
  movable: false,
  position: [0, 2, 0],
  color: '#8b7fd4',
};

const TRACK_TYPES: { type: TrackType; label: string; Icon: typeof RectangleHorizontal; hint: string }[] = [
  { type: 'plane', label: '平面', Icon: RectangleHorizontal, hint: '水平薄板轨道' },
  { type: 'slope', label: '斜面', Icon: Triangle, hint: '角度可调的斜面轨道' },
  { type: 'arc', label: '圆弧面', Icon: Spline, hint: '环形扇区曲面轨道' },
  { type: 'doubleArc', label: '双弧圆轨道', Icon: Donut, hint: '内外两道环壁形成环形通道，通道宽度 = 可通过球的最大直径' },
];

const COLOR_PRESETS = ['#8b7fd4', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#fafafa'];

function deriveCollider(state: TrackState): { shape: ColliderShape; params: ColliderParams } {
  switch (state.type) {
    case 'plane':
      return { shape: 'cuboid', params: { halfWidth: state.halfWidth, halfHeight: 0.15, halfDepth: state.halfDepth } };
    case 'slope':
      // 楔形斜面：梯形凸体（薄端在 +x，薄边厚度 thinT，拼接时与母版面等厚）
      return {
        shape: 'convexProfile',
        params: {
          profile: slopeWedgeProfile(state.halfWidth, state.slopeAngle, state.thinT),
          thickness: state.halfDepth * 2,
          mode: 'extrude',
        },
      };
    case 'arc':
      return {
        shape: 'arc',
        params: { innerR: state.innerR, thickness: state.arcThickness, arcAngle: state.arcAngle, width: state.arcWidth },
      };
    case 'doubleArc':
      return {
        shape: 'doubleArc',
        params: {
          innerR: state.innerR,
          channelGap: state.channelGap,
          thickness: state.arcThickness,
          arcAngle: state.arcAngle,
          width: state.arcWidth,
        },
      };
  }
}

/** 楔形斜面的面标签（convexProfile 默认标签 → 斜面语义） */
const SLOPE_FACE_LABELS: Record<string, string> = {
  top: '前面',
  bottom: '后面',
  'side-0': '底面',
  'side-1': '薄端',
  'side-2': '斜面',
  'side-3': '厚端',
};

/** 母版拼接面的「面厚」（新楔形薄端厚度应匹配的值） */
function masterFaceThickness(collider: ColliderComponent): number {
  switch (collider.shape) {
    case 'cuboid':
      return (collider.params.halfHeight ?? 0.3) * 2;
    case 'arc':
      return collider.params.thickness ?? 0.5;
    case 'convexProfile': {
      // 楔形母版：薄端边长
      const p = collider.params.profile ?? [];
      if (p.length === 4) {
        return Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]);
      }
      return collider.params.thickness ?? 1;
    }
    default:
      return 0.3;
  }
}

// ── 预览 mesh ──

function TrackPreviewMesh({
  state,
  shape,
  params,
  onPickFace,
  spin = true,
  ghost = false,
}: {
  state: TrackState;
  shape: ColliderShape;
  params: ColliderParams;
  onPickFace?: (faceId: string) => void;
  spin?: boolean;
  ghost?: boolean;
}) {
  const meshRef = useRef<THREE.Object3D>(null);

  const arcGeometry = useMemo(() => {
    if (shape === 'convexProfile') {
      const raw = computeHullPoints('convexProfile', params);
      if (raw.length < 12) return null;
      const vecs: THREE.Vector3[] = [];
      for (let i = 0; i < raw.length; i += 3) {
        vecs.push(new THREE.Vector3(raw[i], raw[i + 1], raw[i + 2]));
      }
      return new ConvexGeometry(vecs);
    }
    if (shape !== 'arc') return null;
    const arcParams: ArcParams = {
      innerR: params.innerR ?? 3,
      thickness: params.thickness ?? 0.5,
      arcAngleDeg: params.arcAngle ?? 90,
      width: params.width ?? 2,
    };
    const outline = arcSectorOutline(arcParams);
    const shape2d = new Shape();
    shape2d.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) shape2d.lineTo(outline[i][0], outline[i][1]);
    const geo = new ExtrudeGeometry(shape2d, { depth: arcParams.width, bevelEnabled: false });
    geo.translate(0, 0, -arcParams.width / 2);
    return geo;
  }, [shape, params]);

  // 双弧圆轨道：内/外两条环带几何
  const doubleArcGeos = useMemo(() => {
    if (shape !== 'doubleArc') return null;
    const w = params.width ?? 2;
    const { inner, outer } = doubleArcBandOutlines({
      innerR: params.innerR ?? 3,
      channelGap: params.channelGap ?? 0.6,
      thickness: params.thickness ?? 0.5,
      arcAngleDeg: params.arcAngle ?? 360,
      width: w,
      segments: params.segments,
    });
    const mk = (outline: [number, number][]) => {
      const shape2d = new Shape();
      shape2d.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) shape2d.lineTo(outline[i][0], outline[i][1]);
      const geo = new ExtrudeGeometry(shape2d, { depth: w, bevelEnabled: false });
      geo.translate(0, 0, -w / 2);
      return geo;
    };
    return { inner: mk(inner), outer: mk(outer) };
  }, [shape, params]);

  useEffect(() => {
    return () => {
      arcGeometry?.dispose();
      doubleArcGeos?.inner.dispose();
      doubleArcGeos?.outer.dispose();
    };
  }, [arcGeometry, doubleArcGeos]);

  useFrame((_, delta) => {
    if (spin && meshRef.current) meshRef.current.rotation.y += delta * 0.4;
  });

  const handlePointerDown = useCallback(
    (e: any) => {
      if (!onPickFace) return;
      e.stopPropagation();
      if (!e.face) return;
      const n = e.face.normal;
      // 预览 mesh 未旋转（相机控制视角），e.point 即局部坐标
      const faceId = pickFace(
        shape,
        params,
        [e.point.x, e.point.y, e.point.z],
        [n.x, n.y, n.z],
      );
      if (faceId) onPickFace(faceId);
    },
    [shape, params, onPickFace],
  );

  const material = ghost ? (
    <meshStandardMaterial color="#29d3e8" roughness={0.4} metalness={0.1} transparent opacity={0.5} side={THREE.DoubleSide} />
  ) : (
    <meshStandardMaterial color={state.color} roughness={0.55} metalness={0.15} side={THREE.DoubleSide} />
  );

  if (shape === 'doubleArc') {
    if (!doubleArcGeos) return null;
    return (
      <group ref={meshRef}>
        <mesh geometry={doubleArcGeos.inner} onPointerDown={handlePointerDown}>
          {material}
        </mesh>
        <mesh geometry={doubleArcGeos.outer} onPointerDown={handlePointerDown}>
          {material}
        </mesh>
      </group>
    );
  }

  if (shape === 'arc' || shape === 'convexProfile') {
    if (!arcGeometry) return null;
    return (
      <mesh ref={meshRef} geometry={arcGeometry} onPointerDown={handlePointerDown}>
        {material}
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} onPointerDown={handlePointerDown}>
      <boxGeometry
        args={[
          (params.halfWidth ?? 1) * 2,
          (params.halfHeight ?? 0.3) * 2,
          (params.halfDepth ?? 1) * 2,
        ]}
      />
      {material}
    </mesh>
  );
}

// ── 母版预览（拼接模式）：半透明显示场景中已有轨道，点击其拼接面 ──

function MasterPreviewMesh({
  entity,
  onPickPoint,
}: {
  entity: Entity;
  onPickPoint: (localPoint: [number, number, number]) => void;
}) {
  const collider = entity.components.get('collider') as ColliderComponent | undefined;
  const transform = entity.components.get('transform') as TransformComponent | undefined;

  const arcGeometry = useMemo(() => {
    if (!collider) return null;
    if (collider.shape === 'convexProfile') {
      const raw = computeHullPoints('convexProfile', collider.params);
      if (raw.length < 12) return null;
      const vecs: THREE.Vector3[] = [];
      for (let i = 0; i < raw.length; i += 3) {
        vecs.push(new THREE.Vector3(raw[i], raw[i + 1], raw[i + 2]));
      }
      return new ConvexGeometry(vecs);
    }
    if (collider.shape !== 'arc') return null;
    const arcParams: ArcParams = {
      innerR: collider.params.innerR ?? 3,
      thickness: collider.params.thickness ?? 0.5,
      arcAngleDeg: collider.params.arcAngle ?? 90,
      width: collider.params.width ?? 2,
    };
    const outline = arcSectorOutline(arcParams);
    const shape2d = new Shape();
    shape2d.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) shape2d.lineTo(outline[i][0], outline[i][1]);
    const geo = new ExtrudeGeometry(shape2d, { depth: arcParams.width, bevelEnabled: false });
    geo.translate(0, 0, -arcParams.width / 2);
    return geo;
  }, [collider]);

  const doubleArcGeos = useMemo(() => {
    if (!collider || collider.shape !== 'doubleArc') return null;
    const w = collider.params.width ?? 2;
    const { inner, outer } = doubleArcBandOutlines({
      innerR: collider.params.innerR ?? 3,
      channelGap: collider.params.channelGap ?? 0.6,
      thickness: collider.params.thickness ?? 0.5,
      arcAngleDeg: collider.params.arcAngle ?? 360,
      width: w,
      segments: collider.params.segments,
    });
    const mk = (outline: [number, number][]) => {
      const shape2d = new Shape();
      shape2d.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) shape2d.lineTo(outline[i][0], outline[i][1]);
      const geo = new ExtrudeGeometry(shape2d, { depth: w, bevelEnabled: false });
      geo.translate(0, 0, -w / 2);
      return geo;
    };
    return { inner: mk(inner), outer: mk(outer) };
  }, [collider]);

  useEffect(() => {
    return () => {
      arcGeometry?.dispose();
      doubleArcGeos?.inner.dispose();
      doubleArcGeos?.outer.dispose();
    };
  }, [arcGeometry, doubleArcGeos]);

  const handlePointerDown = useCallback(
    (e: any) => {
      e.stopPropagation();
      const local = e.object.worldToLocal(e.point.clone());
      onPickPoint([local.x, local.y, local.z]);
    },
    [onPickPoint],
  );

  if (!collider || !transform) return null;

  const material = (
    <meshStandardMaterial color="#8b7fd4" roughness={0.55} metalness={0.15} transparent opacity={0.6} side={THREE.DoubleSide} />
  );

  return (
    <group position={transform.position} rotation={transform.rotation}>
      {collider.shape === 'doubleArc' ? (
        doubleArcGeos ? (
          <group>
            <mesh geometry={doubleArcGeos.inner} onPointerDown={handlePointerDown}>
              {material}
            </mesh>
            <mesh geometry={doubleArcGeos.outer} onPointerDown={handlePointerDown}>
              {material}
            </mesh>
          </group>
        ) : null
      ) : collider.shape === 'arc' || collider.shape === 'convexProfile' ? (
        arcGeometry ? (
          <mesh geometry={arcGeometry} onPointerDown={handlePointerDown}>
            {material}
          </mesh>
        ) : null
      ) : (
        <mesh onPointerDown={handlePointerDown}>
          <boxGeometry
            args={[
              (collider.params.halfWidth ?? 1) * 2,
              (collider.params.halfHeight ?? 0.3) * 2,
              (collider.params.halfDepth ?? 1) * 2,
            ]}
          />
          {material}
        </mesh>
      )}
    </group>
  );
}

// ── 主组件 ──

export default function TrackBuilder() {
  const open = useSimulationStore((s) => s.trackBuilderOpen);
  const closeBuilder = useSimulationStore((s) => s.closeTrackBuilder);
  const addEntity = useSimulationStore((s) => s.addEntity);
  const entities = useSimulationStore((s) => s.entities);

  const [state, setState] = useState<TrackState>(DEFAULT_STATE);
  const [faceOverrides, setFaceOverrides] = useState<Record<string, { friction: number; pinned: boolean }>>({});
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── 拼接模式状态 ──
  const [masterTrackId, setMasterTrackId] = useState<string | null>(null);
  const [spliceWorldFace, setSpliceWorldFace] = useState<SpliceFace | null>(null);
  const [pose, setPose] = useState<SplicePose | null>(null);
  const [lossType, setLossType] = useState<'value' | 'percent'>('percent');
  const [loss, setLoss] = useState(0.2);

  const patch = useCallback(<K extends keyof TrackState>(key: K, value: TrackState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  useEffect(() => {
    if (open) {
      setState(DEFAULT_STATE);
      setFaceOverrides({});
      setSelectedFaceId(null);
      setError(null);
      setMasterTrackId(null);
      setSpliceWorldFace(null);
      setPose(null);
    }
  }, [open]);

  const { shape, params } = useMemo(() => deriveCollider(state), [state]);
  const faceList: FaceDefinition[] = useMemo(() => {
    const defs = getShapeFaces(shape, params);
    if (state.type === 'slope') {
      return defs.map((d) => ({ ...d, label: SLOPE_FACE_LABELS[d.id] ?? d.label }));
    }
    return defs;
  }, [shape, params, state.type]);

  // 已创建轨道（拼接母版候选）
  const existingTracks = useMemo(() => {
    return Array.from(entities.values()).filter((e) => e.name.includes('轨道'));
  }, [entities]);

  const masterEntity = masterTrackId ? entities.get(masterTrackId) : undefined;
  const masterCollider = masterEntity?.components.get('collider') as ColliderComponent | undefined;
  const masterTransform = masterEntity?.components.get('transform') as TransformComponent | undefined;
  const masterSpliceFaces = useMemo(
    () => (masterCollider ? getSpliceFaces(masterCollider.shape, masterCollider.params) : []),
    [masterCollider],
  );

  // 点击母版上的点 → 最近拼接面 → 世界系面 + 对齐位姿
  const handleMasterPickPoint = useCallback(
    (localPoint: [number, number, number]) => {
      if (!masterCollider || !masterTransform) return;
      const face = pickSpliceFace(masterSpliceFaces, localPoint);
      if (!face) return;
      // 楔形斜面拼接：薄端厚度自动匹配母版面厚（等厚贴合）
      const thinTEff = state.type === 'slope' ? masterFaceThickness(masterCollider) : state.thinT;
      if (state.type === 'slope' && Math.abs(thinTEff - state.thinT) > 1e-6) {
        setState((s) => ({ ...s, thinT: Math.round(thinTEff * 100) / 100 }));
      }
      const worldFace = toWorldFace(face, masterTransform.position, masterTransform.rotation);
      // 用生效厚度重新推导入口面（薄端中心依赖 thinT）
      const effParams =
        state.type === 'slope'
          ? { ...params, profile: slopeWedgeProfile(state.halfWidth, state.slopeAngle, thinTEff) }
          : params;
      const entry = getEntryFace(shape, effParams);
      if (!entry) {
        setError('当前轨道类型不支持拼接');
        return;
      }
      setSpliceWorldFace(worldFace);
      setPose(computeSplicePose(worldFace, entry));
      setError(null);
    },
    [masterCollider, masterTransform, masterSpliceFaces, shape, params, state.type, state.thinT],
  );

  const handlePickFace = useCallback((faceId: string) => {
    setSelectedFaceId(faceId);
  }, []);

  const handleFaceChange = useCallback((faceId: string, patchFace: Partial<{ friction: number; pinned: boolean }>) => {
    setFaceOverrides((s) => ({
      ...s,
      [faceId]: { friction: s[faceId]?.friction ?? 0.3, pinned: s[faceId]?.pinned ?? false, ...patchFace },
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    let entity: Entity;
    switch (state.type) {
      case 'plane':
        entity = createPlaneTrackEntity(state.halfWidth, state.halfDepth, state.friction, state.color, state.position);
        break;
      case 'slope':
        entity = createWedgeTrackEntity(
          slopeWedgeProfile(state.halfWidth, state.slopeAngle, state.thinT),
          state.halfDepth,
          state.friction,
          state.color,
          state.position,
        );
        break;
      case 'arc':
        entity = createArcTrackEntity(
          state.innerR,
          state.arcThickness,
          state.arcAngle,
          state.arcWidth,
          state.friction,
          state.color,
          state.position,
        );
        break;
      case 'doubleArc':
        entity = createDoubleArcTrackEntity(
          state.innerR,
          state.channelGap,
          state.arcThickness,
          state.arcAngle,
          state.arcWidth,
          state.friction,
          state.color,
          state.position,
        );
        break;
    }

    // 面摩擦配置（统一值 + 覆盖）
    if (faceList.length > 0) {
      const faces: FaceFriction[] = faceList.map((def) => ({
        id: def.id,
        label: def.label,
        friction: faceOverrides[def.id]?.friction ?? state.friction,
        pinned: faceOverrides[def.id]?.pinned ?? false,
      }));
      entity = attachFaces(entity, faces);
    }

    // 可滑动 → dynamic（给质量 5kg，避免零质量动态体）
    if (state.movable) {
      const rb = entity.components.get('rigidBody');
      if (rb) {
        const newComponents = new Map(entity.components);
        newComponents.set('rigidBody', { ...rb, kind: 'dynamic', mass: 5 } as typeof rb);
        entity = { ...entity, components: newComponents };
      }
    }

    const success = addEntity(entity);
    if (!success) {
      setError('场景已达到最大实体数量 (50 个)');
      return;
    }
    closeBuilder();
  }, [state, faceList, faceOverrides, addEntity, closeBuilder]);

  // ── 确认拼接：按对齐位姿创建新轨道 + splice 约束 ──
  const handleConfirmSplice = useCallback(() => {
    if (!masterTrackId || !spliceWorldFace || !pose) return;
    if (entities.size + 2 > MAX_ENTITIES) {
      setError(`场景实体数量上限 (${MAX_ENTITIES}) 不足，无法拼接`);
      return;
    }

    // 1. 创建新轨道（类型参数与当前编辑一致）
    let entity: Entity;
    switch (state.type) {
      case 'plane':
        entity = createPlaneTrackEntity(state.halfWidth, state.halfDepth, state.friction, state.color, pose.position);
        break;
      case 'slope':
        entity = createWedgeTrackEntity(
          slopeWedgeProfile(state.halfWidth, state.slopeAngle, state.thinT),
          state.halfDepth,
          state.friction,
          state.color,
          pose.position,
        );
        break;
      case 'arc':
        entity = createArcTrackEntity(
          state.innerR,
          state.arcThickness,
          state.arcAngle,
          state.arcWidth,
          state.friction,
          state.color,
          pose.position,
        );
        break;
      case 'doubleArc':
        entity = createDoubleArcTrackEntity(
          state.innerR,
          state.channelGap,
          state.arcThickness,
          state.arcAngle,
          state.arcWidth,
          state.friction,
          state.color,
          pose.position,
        );
        break;
    }

    // 覆盖 transform 为对齐位姿
    const tr = entity.components.get('transform') as TransformComponent | undefined;
    if (tr) {
      const newComponents = new Map(entity.components);
      newComponents.set('transform', { ...tr, position: pose.position, rotation: pose.rotation } as TransformComponent);
      entity = { ...entity, components: newComponents };
    }

    // 面摩擦配置
    if (faceList.length > 0) {
      const faces: FaceFriction[] = faceList.map((def) => ({
        id: def.id,
        label: def.label,
        friction: faceOverrides[def.id]?.friction ?? state.friction,
        pinned: faceOverrides[def.id]?.pinned ?? false,
      }));
      entity = attachFaces(entity, faces);
    }

    // 可滑动 → dynamic
    if (state.movable) {
      const rb = entity.components.get('rigidBody');
      if (rb) {
        const newComponents = new Map(entity.components);
        newComponents.set('rigidBody', { ...rb, kind: 'dynamic', mass: 5 } as typeof rb);
        entity = { ...entity, components: newComponents };
      }
    }

    // 2. 接缝损耗约束
    const entry = getEntryFace(shape, params)!;
    const seam = computeSeamBox(spliceWorldFace, entry);
    const splice = createSpliceEntity(masterTrackId, entity.id, {
      faceId: spliceWorldFace.faceId,
      center: seam.center,
      normal: seam.normal,
      halfExtents: seam.halfExtents,
      quaternion: seam.quaternion,
      lossType,
      loss,
      showLink: true,
    });

    if (!addEntity(entity) || !addEntity(splice)) {
      setError('场景已达到最大实体数量');
      return;
    }
    setError(null);
    // 保留对话框与母版选择，便于连续拼接下一段
    setSpliceWorldFace(null);
    setPose(null);
  }, [masterTrackId, spliceWorldFace, pose, entities.size, state, faceList, faceOverrides, shape, params, lossType, loss, addEntity]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeBuilder()}>
      <DialogContent
        className="sm:max-w-[960px] max-h-[88vh] overflow-hidden"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)] text-lg">创建轨道</DialogTitle>
          <DialogDescription className="text-[var(--muted-foreground)] text-xs">
            轨道默认固定不动；在 3D 预览中点击某个面可编辑该面摩擦/固定
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3" style={{ height: '62vh' }}>
          {/* ── 左栏：类型 + 已创建轨道 ── */}
          <div className="w-44 shrink-0 space-y-2 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">轨道类型</div>
            {TRACK_TYPES.map(({ type, label, Icon, hint }) => (
              <button
                key={type}
                type="button"
                onClick={() => patch('type', type)}
                className="w-full flex items-center gap-2 p-2 rounded-lg border text-xs transition-all"
                style={{
                  borderColor: state.type === type ? 'var(--holo)' : 'var(--glass-border)',
                  backgroundColor: state.type === type ? 'var(--holo-a15)' : 'transparent',
                  color: state.type === type ? 'var(--holo)' : 'var(--muted-foreground)',
                }}
                title={hint}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}

            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-2">
              已创建轨道（点选拼接）
            </div>
            {existingTracks.length === 0 && (
              <p className="text-[10px] text-[var(--text-dim)]">场景中的轨道会列在这里；点选一个作为拼接母版</p>
            )}
            <div className="space-y-1">
              {existingTracks.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setMasterTrackId(masterTrackId === e.id ? null : e.id);
                    setSpliceWorldFace(null);
                    setPose(null);
                    setError(null);
                  }}
                  className="w-full text-left px-1.5 py-1 rounded border text-xs truncate transition-all"
                  style={{
                    borderColor: masterTrackId === e.id ? 'var(--holo)' : 'var(--glass-border)',
                    backgroundColor: masterTrackId === e.id ? 'var(--holo-a15)' : 'transparent',
                    color: masterTrackId === e.id ? 'var(--holo)' : 'var(--foreground)',
                  }}
                  title={masterTrackId === e.id ? '取消拼接母版' : '选为拼接母版'}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>

          {/* ── 中栏：3D 预览（拼接模式显示母版+对齐预览，否则为当前轨道预览） ── */}
          <div
            className="flex-1 relative rounded-lg overflow-hidden min-w-0"
            style={{ border: '1px solid var(--glass-border)', background: 'rgba(5, 5, 17, 0.6)' }}
          >
            <Canvas camera={{ position: [6, 5, 6], fov: 42 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[4, 6, 4]} intensity={1.2} />
              {masterEntity ? (
                <>
                  <MasterPreviewMesh entity={masterEntity} onPickPoint={handleMasterPickPoint} />
                  {pose && (
                    <group position={pose.position} rotation={pose.rotation}>
                      <TrackPreviewMesh state={state} shape={shape} params={params} spin={false} ghost />
                    </group>
                  )}
                </>
              ) : (
                <TrackPreviewMesh state={state} shape={shape} params={params} onPickFace={handlePickFace} />
              )}
              <OrbitControls makeDefault enablePan={false} />
            </Canvas>
            {masterEntity && (
              <div
                className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs"
                style={{ background: 'var(--glass-bg)', color: 'var(--holo)', border: '1px solid var(--holo-a30)' }}
              >
                拼接母版：{masterEntity.name}
                {spliceWorldFace ? ` · 已选面：${spliceWorldFace.label}` : ' · 点击它的拼接面'}
              </div>
            )}
            {!masterEntity && selectedFaceId && (
              <div
                className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs"
                style={{ background: 'var(--glass-bg)', color: 'var(--holo)', border: '1px solid var(--holo-a30)' }}
              >
                当前面：{faceList.find((f) => f.id === selectedFaceId)?.label ?? selectedFaceId}
              </div>
            )}
          </div>

          {/* ── 右栏：参数 + 面摩擦 ── */}
          <div className="w-56 shrink-0 space-y-2.5 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">轨道参数</div>
            {(state.type === 'plane' || state.type === 'slope') && (
              <>
                <NumField label="半宽" value={state.halfWidth} onChange={(v) => patch('halfWidth', v)} min={0.5} max={10} unit="m" />
                <NumField label="半深" value={state.halfDepth} onChange={(v) => patch('halfDepth', v)} min={0.5} max={10} unit="m" />
              </>
            )}
            {state.type === 'slope' && (
              <>
                <NumField label="倾角" value={state.slopeAngle} onChange={(v) => patch('slopeAngle', v)} min={5} max={60} step={1} unit="°" />
                <NumField label="薄端厚度" value={state.thinT} onChange={(v) => patch('thinT', v)} min={0.05} max={1} step={0.05} unit="m" />
              </>
            )}
            {state.type === 'arc' && (
              <>
                <NumField label="内弧半径" value={state.innerR} onChange={(v) => patch('innerR', v)} min={1} max={10} unit="m" />
                <NumField label="弧角" value={state.arcAngle} onChange={(v) => patch('arcAngle', v)} min={15} max={180} step={5} unit="°" />
                <NumField label="宽度" value={state.arcWidth} onChange={(v) => patch('arcWidth', v)} min={0.5} max={6} unit="m" />
                <NumField label="厚度" value={state.arcThickness} onChange={(v) => patch('arcThickness', v)} min={0.2} max={2} unit="m" />
              </>
            )}
            {state.type === 'doubleArc' && (
              <>
                <NumField label="内弧半径" value={state.innerR} onChange={(v) => patch('innerR', v)} min={1} max={10} unit="m" />
                <NumField label="通道宽度" value={state.channelGap} onChange={(v) => patch('channelGap', v)} min={0.2} max={2} step={0.05} unit="m" />
                <p className="text-[10px] -mt-1" style={{ color: 'var(--text-dim)' }}>
                  通道宽度 = 内径，直径等于它的球可顺畅通过
                </p>
                <NumField label="弧角" value={state.arcAngle} onChange={(v) => patch('arcAngle', v)} min={30} max={360} step={5} unit="°" />
                <NumField label="宽度" value={state.arcWidth} onChange={(v) => patch('arcWidth', v)} min={0.5} max={6} unit="m" />
                <NumField label="壁厚" value={state.arcThickness} onChange={(v) => patch('arcThickness', v)} min={0.2} max={2} unit="m" />
              </>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }} title="轨道自身是否可移动（默认固定不动）">
                可滑动（轨道可移动）
              </span>
              <Switch checked={state.movable} onCheckedChange={(v) => patch('movable', v)} />
            </div>

            <NumField label="统一摩擦" value={state.friction} onChange={(v) => patch('friction', v)} min={0} max={2} step={0.05} />

            {faceList.length > 0 && (
              <>
                <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">
                  面摩擦与固定
                </div>
                <div className="space-y-1">
                  {faceList.map((def) => {
                    const v = faceOverrides[def.id] ?? { friction: state.friction, pinned: false };
                    const selected = selectedFaceId === def.id;
                    return (
                      <div
                        key={def.id}
                        className="flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer transition-colors"
                        style={{
                          background: selected ? 'var(--holo-a15)' : 'transparent',
                          border: `1px solid ${selected ? 'var(--holo-a30)' : 'transparent'}`,
                        }}
                        onClick={() => setSelectedFaceId(def.id)}
                      >
                        <span className="text-[11px] w-12 shrink-0" style={{ color: selected ? 'var(--holo)' : 'var(--muted-foreground)' }}>
                          {def.label}
                        </span>
                        <Slider
                          value={[v.friction]}
                          min={0}
                          max={2}
                          step={0.05}
                          className="flex-1"
                          onValueChange={([x]) => handleFaceChange(def.id, { friction: x })}
                        />
                        <span className="text-[10px] font-mono w-7 text-right" style={{ color: 'var(--text-dim)' }}>
                          {v.friction.toFixed(2)}
                        </span>
                        <label
                          className="flex items-center gap-0.5 text-[10px] shrink-0 cursor-pointer"
                          style={{ color: v.pinned ? 'var(--holo)' : 'var(--muted-foreground)' }}
                          title="固定面：接触点不发生相对滑动"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={v.pinned}
                            onChange={(e) => handleFaceChange(def.id, { pinned: e.target.checked })}
                          />
                          固定
                        </label>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {!masterTrackId && (
              <Vec3Field label="位置 (m)" value={state.position} onChange={(v) => patch('position', v)} />
            )}

            {/* ── 拼接区（选中母版后） ── */}
            {masterTrackId && (
              <>
                <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">
                  拼接设置
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                  {spliceWorldFace
                    ? `拼到「${masterEntity?.name}」的 ${spliceWorldFace.label}，新轨道已自动对齐（半透明预览）`
                    : '在中间 3D 预览中点击母版的拼接面（端面/侧边）'}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['percent', 'value'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLossType(t)}
                      className="px-2 py-1 rounded-lg text-xs transition-all border"
                      style={{
                        borderColor: lossType === t ? 'var(--holo)' : 'var(--glass-border)',
                        backgroundColor: lossType === t ? 'var(--holo-a15)' : 'transparent',
                        color: lossType === t ? 'var(--holo)' : 'var(--muted-foreground)',
                      }}
                    >
                      {t === 'percent' ? '百分比损耗' : '数值损耗'}
                    </button>
                  ))}
                </div>
                <NumField
                  label={lossType === 'percent' ? '损耗比例' : '损耗速度'}
                  value={loss}
                  onChange={setLoss}
                  min={0}
                  max={lossType === 'percent' ? 1 : 10}
                  step={lossType === 'percent' ? 0.05 : 0.1}
                  unit={lossType === 'percent' ? '' : 'm/s'}
                />
                <Button
                  type="button"
                  disabled={!pose}
                  onClick={handleConfirmSplice}
                  className="w-full"
                  style={{
                    backgroundColor: pose ? 'var(--holo)' : 'var(--text-dim)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {pose ? '确认拼接' : '先点击母版拼接面'}
                </Button>
              </>
            )}

            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">颜色</div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => patch('color', c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: state.color === c ? 'var(--foreground)' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 底部 ── */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
          <div className="text-xs" style={{ color: 'var(--destructive)' }}>{error}</div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={closeBuilder} className="text-[var(--muted-foreground)]">
              取消
            </Button>
            {!masterTrackId && (
              <Button
                type="button"
                onClick={handleConfirm}
                style={{ backgroundColor: 'var(--holo)', color: 'var(--primary-foreground)' }}
              >
                确认添加
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
