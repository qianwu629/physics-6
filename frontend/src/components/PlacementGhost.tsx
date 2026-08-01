/**
 * PlacementGhost — 虚影放置（F3）
 *
 * placement 激活时（ObjectBuilder「虚影放置」按钮触发）：
 * - 半透明青色虚影跟随鼠标移动，吸附到已创建物体表面
 *   （raycast 命中带 userData.entityId 的实体 mesh；无命中兜底地面 y=0）
 * - 物体「坐」在表面上：中心 = 命中点 + 法线 × 支撑距离（placementCalc）
 * - 滚轮微调高度（0.1m 步进，≥0）
 * - 左键落位（buildEntityFromState + addEntity）；Esc 取消并重开 ObjectBuilder（状态还原）
 *
 * 挂载于 Scene3D Canvas 内（Physics 外）。放置期间 OrbitControls 由 Scene3D 禁用。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { useSimulationStore } from '../store';
import { deriveColliderShape, buildEntityFromState } from './objectFactory';
import {
  boundsCorners,
  ghostPosition,
  WHEEL_HEIGHT_STEP,
  WHEEL_HEIGHT_MAX,
  type Vec3Tuple,
} from '../ecs/placementCalc';
import { computeHullPoints } from '../ecs/faceGeometry';

/** 命中对象是否属于某个实体（向上遍历找 userData.entityId） */
function hasEntityAncestor(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData?.entityId) return true;
    cur = cur.parent;
  }
  return false;
}

export default function PlacementGhost() {
  const placement = useSimulationStore((s) => s.placement);
  const addEntity = useSimulationStore((s) => s.addEntity);
  const cancelPlacement = useSimulationStore((s) => s.cancelPlacement);
  const openObjectBuilder = useSimulationStore((s) => s.openObjectBuilder);
  const { gl, camera, scene } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const hitRef = useRef<{ point: Vec3Tuple; normal: Vec3Tuple }>({ point: [0, 0, 0], normal: [0, 1, 0] });
  const wheelRef = useRef(0);

  const { shape, params } = useMemo(
    () => (placement ? deriveColliderShape(placement.state) : { shape: 'sphere' as const, params: {} }),
    [placement],
  );
  const corners = useMemo(() => boundsCorners(shape, params), [shape, params]);

  // 自定义凸形虚影几何（挤出/车削，与建造器预览同一份顶点数据）
  const customGeometry = useMemo(() => {
    if (!placement || shape !== 'convexProfile') return null;
    const raw = computeHullPoints('convexProfile', params);
    if (raw.length < 12) return null;
    const vecs: THREE.Vector3[] = [];
    for (let i = 0; i < raw.length; i += 3) {
      vecs.push(new THREE.Vector3(raw[i], raw[i + 1], raw[i + 2]));
    }
    return new ConvexGeometry(vecs);
  }, [placement, shape, params]);

  useEffect(() => () => customGeometry?.dispose(), [customGeometry]);

  // 进入放置模式时重置滚轮高度
  useEffect(() => {
    if (placement) wheelRef.current = 0;
  }, [placement]);

  const updateGhostPosition = useCallback(() => {
    if (!groupRef.current) return;
    const { point, normal } = hitRef.current;
    const pos = ghostPosition(point, normal, corners, wheelRef.current);
    groupRef.current.position.set(pos[0], pos[1], pos[2]);
  }, [corners]);

  useEffect(() => {
    if (!placement) return;
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const tmpPoint = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3();

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const hit = hits.find((h) => hasEntityAncestor(h.object));
      if (hit && hit.face) {
        normalMatrix.getNormalMatrix(hit.object.matrixWorld);
        const n = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        hitRef.current = { point: [hit.point.x, hit.point.y, hit.point.z], normal: [n.x, n.y, n.z] };
      } else if (raycaster.ray.intersectPlane(groundPlane, tmpPoint)) {
        hitRef.current = { point: [tmpPoint.x, tmpPoint.y, tmpPoint.z], normal: [0, 1, 0] };
      }
      updateGhostPosition();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current = Math.max(
        0,
        Math.min(WHEEL_HEIGHT_MAX, wheelRef.current + (e.deltaY < 0 ? WHEEL_HEIGHT_STEP : -WHEEL_HEIGHT_STEP)),
      );
      updateGhostPosition();
    };

    // capture 阶段拦截：先于 R3F 事件系统，避免落位点击触发实体选中
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const { point, normal } = hitRef.current;
      const pos = ghostPosition(point, normal, corners, wheelRef.current);
      const entity = buildEntityFromState(placement.state, placement.faceOverrides, pos);
      if (addEntity(entity)) {
        cancelPlacement();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 保留 placement 快照——ObjectBuilder 打开时从中还原 state 并自行清除
        openObjectBuilder();
      }
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [placement, gl, camera, scene, corners, addEntity, cancelPlacement, openObjectBuilder, updateGhostPosition]);

  if (!placement) return null;

  const ghostMaterial = (
    <meshStandardMaterial
      color="#29d3e8"
      roughness={0.4}
      metalness={0.1}
      transparent
      opacity={0.5}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );

  return (
    <group ref={groupRef}>
      {shape === 'convexProfile' ? (
        customGeometry ? <mesh geometry={customGeometry}>{ghostMaterial}</mesh> : null
      ) : (
        <mesh>
          {shape === 'sphere' && <sphereGeometry args={[params.radius ?? 1, 32, 32]} />}
          {shape === 'cuboid' && (
            <boxGeometry
              args={[(params.halfWidth ?? 1) * 2, (params.halfHeight ?? 1) * 2, (params.halfDepth ?? 1) * 2]}
            />
          )}
          {shape === 'cylinder' && (
            <cylinderGeometry args={[params.radius ?? 0.5, params.radius ?? 0.5, (params.halfHeight ?? 1) * 2, 32]} />
          )}
          {ghostMaterial}
        </mesh>
      )}
    </group>
  );
}
