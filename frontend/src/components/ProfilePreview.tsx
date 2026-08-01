/**
 * ProfilePreview — 建模对话框内嵌 3D 实时预览（二期）
 *
 * 从当前轮廓 + 成型方式派生顶点集 → ConvexGeometry（与场景渲染/碰撞同一份数据）。
 * 缓慢自转展示立体形态。轮廓非法时显示占位提示。
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import {
  extrudeProfile,
  revolveProfile,
  isConvexProfile,
  isValidRevolveProfile,
  type ProfilePoint,
} from '../ecs/profileGeometry';

interface ProfilePreviewProps {
  profile: ProfilePoint[];
  mode: 'extrude' | 'revolve';
  thickness: number;
}

function PreviewMesh({ points }: { points: Float32Array }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const vecs: THREE.Vector3[] = [];
    for (let i = 0; i < points.length; i += 3) {
      vecs.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
    }
    return new ConvexGeometry(vecs);
  }, [points]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial color="#2a9d8f" roughness={0.55} metalness={0.15} />
    </mesh>
  );
}

export default function ProfilePreview({ profile, mode, thickness }: ProfilePreviewProps) {
  const valid =
    profile.length >= 3 && (mode === 'revolve' ? isValidRevolveProfile(profile) : isConvexProfile(profile));

  const points = useMemo(() => {
    if (!valid) return null;
    return mode === 'revolve' ? revolveProfile(profile) : extrudeProfile(profile, thickness);
  }, [valid, profile, mode, thickness]);

  if (!points) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{
          height: 120,
          borderRadius: 8,
          border: '1px dashed var(--glass-border)',
          color: 'var(--text-dim)',
        }}
      >
        画出 3+ 顶点的凸轮廓后显示 3D 预览
      </div>
    );
  }

  return (
    <div
      style={{
        height: 160,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--glass-border)',
        background: 'rgba(5, 5, 17, 0.6)',
      }}
    >
      <Canvas camera={{ position: [4.5, 3.5, 4.5], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 4]} intensity={1.2} />
        <PreviewMesh points={points} />
      </Canvas>
    </div>
  );
}
