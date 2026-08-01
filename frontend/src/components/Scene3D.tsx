import { Canvas, useThree } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Box3, Vector3, type PerspectiveCamera } from 'three';
import { useSimulationStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import EntityRenderer from './EntityRenderer';
import SpringRenderer from './SpringRenderer';
import FixedJointRenderer from './FixedJointRenderer';
import SpliceRenderer from './SpliceRenderer';
import PlacementGhost from './PlacementGhost';
import { TrajectoryRenderer } from './TrajectoryRenderer';
import { VectorRenderer } from './VectorRenderer';
import { ForceFieldSystem } from './ForceFieldSystem';
import { ForceFieldRenderer } from './ForceFieldRenderer';
import { ForceFieldLines } from './ForceFieldLines';
import { ChartSampler } from '../ecs/ChartSampler';
import { RigidBodyRefContext, registerLiveBody, unregisterLiveBody, type RigidBodyAPI } from './RigidBodyRefContext';
import type { ConstraintComponent } from '../ecs/types';

// ──── 地面 (Phase 1 遗留 — 保持不变) ────
// D-02: 地面是隐式基础设施——不属于"物体"，始终存在

function Ground({ friction, restitution }: { friction: number; restitution: number }) {
  return (
    <RigidBody type="fixed" position={[0, -0.5, 0]}>
      <CuboidCollider args={[50, 0.5, 50]} friction={friction} restitution={restitution} />
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

// ──── 摄像机自适应 — D-01-03: 场景加载后摄像机适配实体包围盒 ────

/**
 * CameraFitter — 纯逻辑组件，在 resetCounter 变化时自动计算场景包围盒
 * 并调整摄像机位置，使所有实体可见。
 *
 * 规则:
 * - resetCounter === 0 时不触发（首次挂载保留默认视角）
 * - 空场景 → 回到默认视角 (12, 10, 12)
 * - 有实体 → 计算包围盒 → 摄像机定位到对角线方向
 * - expandByScalar(1) 防止单点/共线场景包围盒退化
 * - Pitfall #3: OrbitControls 必须调用 update() 使变更生效
 */
function CameraFitter({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const resetCounter = useSimulationStore((s) => s.resetCounter);

  useEffect(() => {
    if (resetCounter === 0) return; // 首次挂载不触发自适应（保留默认视角）

    const timer = setTimeout(() => {
      const ctrl = controlsRef.current;
      if (!ctrl) return;

      // 从 store 读取实体位置计算包围盒
      const store = useSimulationStore.getState();
      const box = new Box3();
      let hasAny = false;

      for (const [, entity] of store.entities) {
        const t = entity.components.get('transform');
        if (t) {
          const p = (t as any).position as [number, number, number];
          if (p && Array.isArray(p) && p.length === 3) {
            box.expandByPoint(new Vector3(p[0], p[1], p[2]));
            hasAny = true;
          }
        }
      }

      if (!hasAny) {
        // 空场景 → 默认视角
        (camera as PerspectiveCamera).position.set(12, 10, 12);
        ctrl.target.set(0, 2, 0);
        ctrl.update();
        return;
      }

      // 确保包围盒有最小体积（用于单点或共线场景）
      box.expandByScalar(1);

      const center = new Vector3();
      box.getCenter(center);
      const size = new Vector3();
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fovRad = (camera as PerspectiveCamera).fov * (Math.PI / 180);
      const dist = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.5;

      // 对角线方向摄像机位置
      (camera as PerspectiveCamera).position.set(
        center.x + dist * 0.7,
        center.y + dist * 0.6,
        center.z + dist * 0.7,
      );
      ctrl.target.copy(center);
      ctrl.update(); // Pitfall #3: 必须调用 update() 才能让 OrbitControls 生效
    }, 200);

    return () => clearTimeout(timer);
  }, [resetCounter, camera, controlsRef]);

  return null; // 纯逻辑组件，无 DOM 输出
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
  const restitutionScale = useSimulationStore((s) => s.environment.restitutionScale);

  // CR-02 fix v2: 不再使用 key 触发 Physics 重挂载。
  // 根因：key 变化导致 Rapier 同步卸载/挂载时，内部 jointRef 清理时序问题引发崩溃。
  // 修复：Physics 保持常驻，依赖 React 的 RigidBody/SpringRenderer 生命周期自动管理 world 状态。
  // resetCounter 仅保留给 CameraFitter 触发摄像机自适应。

  // ECS 实体 + 选中状态
  const entities = useSimulationStore((s) => s.entities);
  const selectedId = useSimulationStore((s) => s.selectedEntityId);
  const selectEntity = useSimulationStore((s) => s.selectEntity);
  // F3: 虚影放置模式（禁用轨道控制器，避免左键/滚轮冲突）
  const placementActive = useSimulationStore((s) => s.placement !== null);
  // 在 render 中转换 Map 为 Array——仅在 entities 变化时重建
  const entityEntries = Array.from(entities.entries());

  // ── Joint Creation Click Dispatch (W4/W8) ──
  const handleEntitySelect = useCallback(
    (entityId: string) => {
      const uiStore = useSimulationStore.getState();
      const jointStage = uiStore.fixedJointStage;
      const jointEntityAId = uiStore.fixedJointEntityAId;

      if (jointStage === 'pendingA') {
        uiStore.selectFixedJointEndpointA(entityId);
      } else if (jointStage === 'pendingB') {
        if (entityId === jointEntityAId) {
          uiStore.selectFixedJointEndpointA(null);
        } else {
          uiStore.selectFixedJointEndpointB(entityId);
        }
      } else {
        selectEntity(entityId); // idle → 正常选中
      }
    },
    [selectEntity],
  );

  // ── RigidBody Ref Registry — enables SpringRenderer to find entity refs ──
  // 同步写入模块级注册表（liveBodies），供 Canvas 外组件（FixedJointDialog）读取活体位姿
  const rigidBodyRefMap = useRef<Map<string, React.RefObject<RigidBodyAPI | null>>>(new Map());
  const registerRef = useCallback((entityId: string, ref: React.RefObject<RigidBodyAPI | null>) => {
    rigidBodyRefMap.current.set(entityId, ref);
    registerLiveBody(entityId, ref);
  }, []);
  const unregisterRef = useCallback((entityId: string) => {
    rigidBodyRefMap.current.delete(entityId);
    unregisterLiveBody(entityId);
  }, []);
  const getRef = useCallback((entityId: string) => {
    return rigidBodyRefMap.current.get(entityId);
  }, []);

  const initialCameraPosition: [number, number, number] = [12, 10, 12];   // D-05: 45° 对角线
  const initialCameraTarget: [number, number, number] = [0, 2, 0];       // 场景中心偏上
  const controlsRef = useRef<any>(null);                                   // Phase 1: CameraFitter 控制摄像机

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
        width: '100%',
        height: '100%',                    // 填充 dock 视口面板（Ticket 1: 替代 fixed 全窗口）
        background: '#050511',             // Sci-fi Lab 深空（Ticket 4）
      }}
    >
      {/* ── Sci-fi Lab 深空背景与星空 (Ticket 4) ── */}
      <color attach="background" args={['#050511']} />
      <Stars radius={80} depth={40} count={3000} factor={3} fade speed={0.5} />

      {/* ── 调试与初始化 ── */}
      <FpsTracker />
      <SceneInitializer />
      <CameraFitter controlsRef={controlsRef} />

      {/* ── 物理世界 (Rapier WASM) ── */}
      <Physics
        // Physics 保持常驻，由 React 生命周期管理 RigidBody/joint 的创建与销毁
        timeStep={1 / 120}                  // ARCHITECTURE.md: 固定 120Hz
        paused={!isRunning}                 // D-04: 初始暂停（isRunning=false）
        debug={showDebug}                   // D-07: 调试线框
        gravity={gravity}                   // Phase 3: 从 store 读取，支持热更新
        interpolate={true}                  // 渲染插值——平滑视觉
      >
        <RigidBodyRefContext.Provider value={{ register: registerRef, unregister: unregisterRef, getRef }}>
          {/* 地面 — D-02: 隐式基础设施 */}
          <Ground friction={0.5} restitution={0.5 * restitutionScale} />

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

          {/* Phase 3: 约束实体 — SpringRenderer (spring) / FixedJointRenderer (关节) / SpliceRenderer (拼接) */}
          {entityEntries
            .filter(([, entity]) => entity.components.has('constraint'))
            .map(([id, entity]) => {
              const c = entity.components.get('constraint') as ConstraintComponent;
              if (c.kind === 'spring') {
                return (
                  <SpringRenderer
                    key={id}
                    entity={entity}
                    isSelected={id === selectedId}
                    onSelect={handleEntitySelect}
                  />
                );
              }
              if (c.kind === 'splice') {
                return (
                  <SpliceRenderer
                    key={id}
                    entity={entity}
                    isSelected={id === selectedId}
                    onSelect={handleEntitySelect}
                  />
                );
              }
              return (
                <FixedJointRenderer
                  key={id}
                  entity={entity}
                  isSelected={id === selectedId}
                  onSelect={handleEntitySelect}
                />
              );
            })}

          {/* Phase 4: 轨迹渲染 — TrajectoryRenderer */}
          <TrajectoryRenderer />

          {/* Phase 4: 矢量渲染 — VectorRenderer */}
          <VectorRenderer />

          {/* Phase 3: 力场注入 — ForceFieldSystem (useBeforePhysicsStep) */}
          <ForceFieldSystem />

          {/* Phase 2: 图表采样 — ChartSampler */}
          <ChartSampler />

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

      {/* Phase 3: 力场可视化 — ForceFieldRenderer（Physics 外部，无物理体） */}
      <ForceFieldRenderer />

      {/* Phase 3 (03-05): 力线可视化 — ForceFieldLines（Physics 外部） */}
      <ForceFieldLines />

      {/* F3: 虚影放置（placement 激活时显示吸附虚影；Physics 外部） */}
      <PlacementGhost />

      {/* ── 摄像机控制 (D-05) ── */}
      <OrbitControls
        ref={controlsRef}
        target={initialCameraTarget}
        enabled={!placementActive}
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
        args={[100, 100]}                  // 100x100 单位
        cellSize={1}                       // 1 单位 = 1 米
        cellThickness={1.0}
        cellColor="#1a3a4a"                // Sci-fi Lab 暗青
        sectionSize={5}                    // 每 5 单位加粗线
        sectionThickness={2.5}
        sectionColor="#29d3e8"             // Sci-fi Lab 全息青
        fadeDistance={120}
        fadeStrength={1.0}
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
      {/* 环境光 — Sci-fi Lab 压暗基调 (0.4 → 0.25)，让发光元素凸显 */}
      <ambientLight intensity={0.25} />

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

      {/* ── Sci-fi Lab bloom 后处理 (Ticket 4) ── */}
      {/* luminanceThreshold=1：仅 HDR 亮度 >1 的 emissive 元素发光，普通漫反射不受影响 */}
      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
