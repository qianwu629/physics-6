import { Canvas } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider, BallCollider, CylinderCollider } from '@react-three/rapier';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { INITIAL_SCENE_OBJECTS, SCENE_STATS } from '../simulation/hardcodedScene';
import { useSimulationStore } from '../store';
import type { SceneObject } from '../simulation/types';

// ──── 被 @react-three/rapier 驱动的物理网格组件 ────

/**
 * 单个物理物体的 3D 渲染
 *
 * 使用 @react-three/rapier 的声明式组件:
 * - <RigidBody> 注册到 Rapier 世界并接收物理变换
 * - <Collider> 定义碰撞几何
 * - <mesh> 是纯视觉——由 @react-three/rapier 自动同步变换
 */
function PhysicsObject({ obj }: { obj: SceneObject }) {
  const colliderProps = useMemo(() => {
    switch (obj.shape) {
      case 'sphere':
        return { type: 'ball' as const, args: [obj.shapeArgs[0]] as [number] };
      case 'cuboid':
        return { type: 'cuboid' as const, args: obj.shapeArgs as [number, number, number] };
      case 'cylinder':
        return { type: 'cylinder' as const, args: [obj.shapeArgs[0], obj.shapeArgs[1]] as [number, number] };
    }
  }, [obj.shape, obj.shapeArgs]);

  const geometry = useMemo(() => {
    switch (obj.shape) {
      case 'sphere':
        return <sphereGeometry args={[obj.shapeArgs[0], 32, 32]} />;
      case 'cuboid':
        return <boxGeometry args={[
          obj.shapeArgs[0] * 2,
          obj.shapeArgs[1] * 2,
          obj.shapeArgs[2] * 2,
        ]} />;
      case 'cylinder':
        return <cylinderGeometry args={[
          obj.shapeArgs[1],  // radiusTop
          obj.shapeArgs[1],  // radiusBottom
          obj.shapeArgs[0] * 2,  // height
          32,
        ]} />;
    }
  }, [obj.shape, obj.shapeArgs]);

  return (
    <RigidBody
      type={obj.kind}
      position={obj.position}
      rotation={obj.rotation}
      restitution={obj.restitution}
      colliders={false}
    >
      {/* 碰撞体 —— 决定物理行为 */}
      {colliderProps.type === 'ball' && <BallCollider args={colliderProps.args as [number]} />}
      {colliderProps.type === 'cuboid' && <CuboidCollider args={colliderProps.args as [number, number, number]} />}
      {colliderProps.type === 'cylinder' && <CylinderCollider args={colliderProps.args as [number, number]} />}

      {/* 视觉网格 —— 纯渲染，不参与物理 */}
      <mesh castShadow receiveShadow>
        {geometry}
        <meshStandardMaterial
          color={obj.color}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
    </RigidBody>
  );
}

// ──── 地面 ────
// D-02: 地面是隐式基础设施——不属于"物体"，始终存在

function Ground() {
  return (
    <RigidBody type="fixed" position={[0, -0.5, 0]} restitution={0.5}>
      <CuboidCollider args={[50, 0.5, 50]} />
      <mesh receiveShadow>
        <boxGeometry args={[100, 1, 100]} />
        <meshStandardMaterial
          color="#1a1a1a"        // secondary 色（UI-SPEC）
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
    </RigidBody>
  );
}

// ──── FPS 追踪器 (useFrame-based, 不触发 React re-render) ────

function FpsTracker() {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const setFps = useSimulationStore((s) => s.setFps);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      if (elapsed >= 500) {           // 每 500ms 更新一次 FPS（而非每帧——减少 store 写入）
        const fps = Math.round(frameCountRef.current / (elapsed / 1000));
        setFps(fps);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [setFps]);

  return null; // 无 DOM 输出——纯逻辑组件
}

// ──── 场景初始化 (设置物体数量) ────

function SceneInitializer() {
  const setObjectCount = useSimulationStore((s) => s.setObjectCount);

  useEffect(() => {
    // 报告物体数量 — D-04 暂停时显示初始场景统计
    setObjectCount(SCENE_STATS.dynamicCount);
  }, [setObjectCount]);

  return null;
}

// ──── 主场景组件 ────

/**
 * Scene3D — Phase 1 3D 仿真画布
 *
 * 包含:
 * - R3F Canvas（WebGL 渲染器）
 * - Rapier Physics 世界（固定 120Hz 时间步长）
 * - 硬编码初始场景物体（D-01）
 * - 地面（D-02）
 * - 轨道摄像机 45° 对角线（D-05）
 * - 参考网格 + RGB 坐标轴 (D-06)
 * - 环境光 + 平行光 + 阴影 (D-06)
 * - Canvas 自适应窗口 (D-10)
 */
export default function Scene3D() {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const showDebug = useSimulationStore((s) => s.showDebug);
  const resetCounter = useSimulationStore((s) => s.resetCounter);

  const initialCameraPosition: [number, number, number] = [12, 10, 12];   // D-05: 45° 对角线
  const initialCameraTarget: [number, number, number] = [0, 2, 0];       // 场景中心偏上

  return (
    <Canvas
      shadows
      camera={{
        position: initialCameraPosition,
        fov: 45,
        near: 0.1,
        far: 200,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',                    // D-10: 全窗口自适应
        background: '#0a0a0a',             // dominant 色（UI-SPEC）
      }}
    >
      {/* ── 调试与初始化 ── */}
      <FpsTracker />
      <SceneInitializer />

      {/* ── 物理世界 (Rapier WASM) ── */}
      <Physics
        key={resetCounter}                  // CR-02: 重置时 key 变化 → React 卸载旧 Physics → 挂载新 Physics → 所有 RigidBody 回到初始位置
        timeStep={1 / 120}                  // ARCHITECTURE.md: 固定 120Hz
        paused={!isRunning}                 // D-04: 初始暂停（isRunning=false）
        debug={showDebug}                   // D-07: 调试线框
        gravity={[0, -9.81, 0]}            // 标准重力
        interpolate={true}                  // 渲染插值——平滑视觉
      >
        {/* 地面 — D-02: 隐式基础设施 */}
        <Ground />

        {/* 场景物体 — D-01, D-03 */}
        {INITIAL_SCENE_OBJECTS.map((obj) => (
          <PhysicsObject key={obj.id} obj={obj} />
        ))}
      </Physics>

      {/* ── 摄像机控制 (D-05) ── */}
      <OrbitControls
        target={initialCameraTarget}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={80}
        maxPolarAngle={Math.PI * 0.85}    // 防止钻到地下
        screenSpacePanning={true}
      />

      {/* ── 辅助视觉 (D-06) ── */}
      {/* 参考网格 — 物理课堂风格 */}
      <Grid
        position={[0, 0.01, 0]}            // 略高于地面避免 z-fighting
        args={[30, 30]}                    // 30x30 单位
        cellSize={1}                       // 1 单位 = 1 米
        cellThickness={0.5}
        cellColor="#333333"
        sectionSize={5}                    // 每 5 单位加粗线
        sectionThickness={1.0}
        sectionColor="#555555"
        fadeDistance={60}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {/* RGB 三色坐标轴 — 使用 drei 的 GizmoHelper */}
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport
          axisColors={['#ff3653', '#8df038', '#3299ff']}  // R=X轴, G=Y轴, B=Z轴
          labelColor="#aaaaaa"
        />
      </GizmoHelper>

      {/* ── 光照与阴影 (D-06) ── */}
      {/* 环境光 — 提供基础照明，防止阴影区域全黑 */}
      <ambientLight intensity={0.4} />

      {/* 主平行光 — 产生方向性阴影 */}
      <directionalLight
        position={[15, 25, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />

      {/* 补光 — 从另一方向减弱暗面 */}
      <directionalLight
        position={[-10, 8, -5]}
        intensity={0.2}
      />
    </Canvas>
  );
}
