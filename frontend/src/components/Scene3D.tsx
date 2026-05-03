import { Canvas } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import EntityRenderer from './EntityRenderer';
import SpringRenderer from './SpringRenderer';
import { TrajectoryRenderer } from './TrajectoryRenderer';
import { VectorRenderer } from './VectorRenderer';
import { RigidBodyRefContext } from './RigidBodyRefContext';

// ──── 地面 (Phase 1 遗留 — 保持不变) ────
// D-02: 地面是隐式基础设施——不属于"物体"，始终存在

function Ground({ friction, restitution }: { friction: number; restitution: number }) {
  return (
    <RigidBody type="fixed" position={[0, -0.5, 0]}>
      <CuboidCollider args={[50, 0.5, 50]} friction={friction} restitution={restitution} />
      <mesh receiveShadow>
        <boxGeometry args={[100, 1, 100]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
    </RigidBody>
  );
}

// ──── FPS 追踪器 (requestAnimationFrame-based, 不触发 React re-render) ────

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

// ──── 场景物体初始化 — 从 ECS 实体数设置 objectCount ────

function SceneInitializer() {
  const entities = useSimulationStore((s) => s.entities);
  const setObjectCount = useSimulationStore((s) => s.setObjectCount);

  useEffect(() => {
    setObjectCount(entities.size);
  }, [entities.size, setObjectCount]);

  return null;
}

// ──── 主场景组件 ────

/**
 * Scene3D — Phase 2 ECS 驱动 3D 仿真画布
 *
 * 变化 (vs Phase 1):
 * - 移除 INITIAL_SCENE_OBJECTS — 空场景初始状态 (D-06)
 * - ECS 驱动实体渲染 — entities Map → EntityRenderer
 * - 3D 点击选中 → 蓝色 Outlines 高亮 (D-07)
 * - 点击空白取消选中 → onPointerMissed
 *
 * 保留 (Phase 1):
 * - Ground, Grid, Gizmo, 光照, OrbitControls, Physics 配置
 * - 固定 120Hz 时间步长, 暂停/运行控制, 调试模式
 * - FPS 追踪
 */
export default function Scene3D() {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const showDebug = useSimulationStore((s) => s.showDebug);
  const resetCounter = useSimulationStore((s) => s.resetCounter);
  const gravity = useSimulationStore((s) => s.environment.gravity);
  const frictionScale = useSimulationStore((s) => s.environment.frictionScale);
  const restitutionScale = useSimulationStore((s) => s.environment.restitutionScale);
  const springCreationStage = useSimulationStore((s) => s.springCreationStage);

  // ECS 实体 + 选中状态
  const entities = useSimulationStore((s) => s.entities);
  const selectedId = useSimulationStore((s) => s.selectedEntityId);
  const selectEntity = useSimulationStore((s) => s.selectEntity);
  // 在 render 中转换 Map 为 Array——仅在 entities 变化时重建
  const entityEntries = Array.from(entities.entries());

  // ── Spring Creation Click Dispatch (Phase 3) ──
  const handleEntitySelect = useCallback(
    (entityId: string) => {
      const uiStore = useSimulationStore.getState();
      const stage = uiStore.springCreationStage;
      const entityAId = uiStore.springEntityAId;

      if (stage === 'pendingA') {
        uiStore.selectSpringEndpointA(entityId);
      } else if (stage === 'pendingB') {
        if (entityId === entityAId) {
          // Click same entity — cancel selection
          uiStore.selectSpringEndpointA(null);
        } else {
          uiStore.selectSpringEndpointB(entityId);
        }
      } else {
        selectEntity(entityId); // idle → 正常选中
      }
    },
    [selectEntity],
  );

  // ── RigidBody Ref Registry — enables SpringRenderer to find entity refs ──
  const rigidBodyRefMap = useRef<Map<string, React.RefObject<any>>>(new Map());
  const registerRef = useCallback((entityId: string, ref: React.RefObject<any>) => {
    rigidBodyRefMap.current.set(entityId, ref);
  }, []);
  const unregisterRef = useCallback((entityId: string) => {
    rigidBodyRefMap.current.delete(entityId);
  }, []);
  const getRef = useCallback((entityId: string) => {
    return rigidBodyRefMap.current.get(entityId);
  }, []);

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
        key={resetCounter}                  // CR-02: 重置时 key 变化 → React 卸载旧 Physics → 挂载新 Physics
        timeStep={1 / 120}                  // ARCHITECTURE.md: 固定 120Hz
        paused={!isRunning}                 // D-04: 初始暂停（isRunning=false）
        debug={showDebug}                   // D-07: 调试线框
        gravity={gravity}                   // Phase 3: 从 store 读取，支持热更新
        interpolate={true}                  // 渲染插值——平滑视觉
      >
        <RigidBodyRefContext.Provider value={{ register: registerRef, unregister: unregisterRef, getRef }}>
          {/* 地面 — D-02: 隐式基础设施 */}
          <Ground friction={0.5 * frictionScale} restitution={0.5 * restitutionScale} />

          {/* ECS 驱动实体渲染 — 替代 INITIAL_SCENE_OBJECTS.map() */}
          {/* Phase 3: 约束实体 (spring) 跳过 EntityRenderer，由 SpringRenderer 渲染 */}
          {entityEntries
            .filter(([, entity]) => !entity.components.has('constraint'))
            .map(([id, entity]) => (
              <EntityRenderer
                key={id}
                entity={entity}
                isSelected={id === selectedId}
                onSelect={handleEntitySelect}
              />
            ))}

          {/* Phase 3: Spring 约束实体 — SpringRenderer */}
          {entityEntries
            .filter(([, entity]) => entity.components.has('constraint'))
            .map(([id, entity]) => (
              <SpringRenderer
                key={id}
                entity={entity}
                isSelected={id === selectedId}
                onSelect={handleEntitySelect}
              />
            ))}

          {/* Phase 4: 轨迹渲染 — TrajectoryRenderer */}
          <TrajectoryRenderer />

          {/* Phase 4: 矢量渲染 — VectorRenderer */}
          <VectorRenderer />

          {/* 点击空白取消选中 — D-07 (also exits spring mode if active) */}
          <mesh
            visible={false}
            onPointerMissed={() => selectEntity(null)}
            position={[0, 0, -500]}
          >
            <planeGeometry args={[2000, 2000]} />
          </mesh>
        </RigidBodyRefContext.Provider>
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
