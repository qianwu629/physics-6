import { useRef, useMemo, useCallback, useEffect } from 'react';
import { RigidBody, BallCollider, CuboidCollider, CylinderCollider, ConvexHullCollider } from '@react-three/rapier';
import { CoefficientCombineRule } from '@dimforge/rapier3d-compat';
import { Outlines } from '@react-three/drei';
import { Vector3, Shape } from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { ExtrudeGeometry } from 'three';
import { useSimulationStore } from '../store';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import { setContactForce } from './contactForceStore';
import { computeFaceColliders, computeHullPoints } from '../ecs/faceGeometry';
import { arcSectorOutline } from '../ecs/arcGeometry';
import { doubleArcBandOutlines } from '../ecs/doubleArcGeometry';
import type { Entity } from '../ecs/types';
import type { TransformComponent, RigidBodyComponent, ColliderComponent, VelocityComponent, MaterialComponent } from '../ecs/types';

interface EntityRendererProps {
  entity: Entity;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * EntityRenderer — ECS Entity to R3F+Rapier JSX Translator
 *
 * Translates an ECS Entity (with its component Map) into declarative
 * @react-three/rapier JSX: <RigidBody> + <Collider> + <mesh> + conditional <Outlines>.
 *
 * Key design rules (from RESEARCH Anti-Patterns):
 *  1. onClick on the <mesh>, NOT on <RigidBody> — the visual geometry may
 *     differ from collision geometry; clicks must hit the visual surface.
 *  2. e.stopPropagation() prevents event bubbling to onPointerMissed.
 *  3. Outlines renders conditionally when isSelected is true.
 */
export default function EntityRenderer({ entity, isSelected, onSelect }: EntityRendererProps) {
  const rigidBodyRef = useRef<any>(null);
  const { register, unregister } = useRigidBodyRefRegistry();

  // 注册/注销 RigidBody ref 以供 SpringRenderer 使用
  useEffect(() => {
    register(entity.id, rigidBodyRef);
    return () => unregister(entity.id);
  }, [entity.id, register, unregister]);

  // ── Phase 3: 全局环境倍率 (D-08) — restitutionScale 保留；frictionScale 已于 W3 移除 ──
  const restitutionScale = useSimulationStore((s) => s.environment.restitutionScale);
  const drag = useSimulationStore((s) => s.environment.drag);

  // ── Extract components from Entity ──
  const transform = entity.components.get('transform') as TransformComponent | undefined;
  const rigidBody = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
  const collider = entity.components.get('collider') as ColliderComponent | undefined;
  const velocity = entity.components.get('velocity') as VelocityComponent | undefined;
  const material = entity.components.get('material') as MaterialComponent | undefined;

  // ── Phase 5: Rapier 运行时属性同步 (REN-03 / Pitfall 5 闭环) ──
  // 根因：@react-three/rapier 把 mass/restitution/friction/damping 视为初始化 props；
  //      挂载后必须通过 imperative API 同步。restitution / friction 是 collider-level。
  // 注意：position/velocity 的运行时同步未在此 useEffect 处理（暂停态编辑可走 reset 链路；
  //      运行时编辑会被物理积分覆盖，不是有意义的语义）。
  // 注意：本 hook 必须放在 early-return null 检查之前，遵守 React Rules of Hooks。
  useEffect(() => {
    const rb = rigidBodyRef.current;
    if (!rb) return;
    if (!rigidBody) return; // 缺组件时跳过同步（早退由下方 null 检查处理）

    // RigidBody-level
    // setAdditionalMass(mass, wakeUp=true): 不重新计算 inertia tensor；最小侵入；
    // wakeUp=true 触发休眠物体唤醒以响应新质量。
    rb.setAdditionalMass(rigidBody.mass, true);
    rb.setLinearDamping(drag);
    // 部分版本暴露 setAngularDamping；若类型不存在用 any 兜底
    if (typeof (rb as any).setAngularDamping === 'function') {
      (rb as any).setAngularDamping(drag * 0.5);
    }

    // Collider-level（restitution / friction 在 Rapier 中是 collider 属性，不在 RigidBody 上）
    // W3 面摩擦：多 collider（每面一个）时按 faceId 映射各面摩擦；
    // 无 faces 配置（旧场景）回退 rigidBody.friction 单面模式。
    // 摩擦合并规则统一 Multiply：接触摩擦 = 两面系数相乘。
    if (typeof rb.numColliders === 'function') {
      const restitution = Math.min(rigidBody.restitution * restitutionScale, 1.0);
      const specs = collider ? computeFaceColliders(collider.shape, collider.params) : [];
      const faceById = new Map((collider?.faces ?? []).map((f) => [f.id, f]));
      const n = rb.numColliders();
      for (let i = 0; i < n; i++) {
        const col = rb.collider(i);
        col.setRestitution(restitution);
        const face = collider?.faces ? faceById.get(specs[i]?.faceId ?? '') : undefined;
        const mu = face ? (face.pinned ? 1e6 : face.friction) : rigidBody.friction;
        col.setFriction(Math.min(mu, 1e6));
        if (typeof (col as any).setFrictionCombineRule === 'function') {
          (col as any).setFrictionCombineRule(CoefficientCombineRule.Multiply);
        }
      }
    }
  }, [
    entity.id,
    rigidBody?.mass,
    rigidBody?.restitution,
    rigidBody?.friction,
    collider?.faces,
    collider?.shape,
    collider?.params,
    restitutionScale,
    drag,
  ]);

  // Phase 3: 力场实体跳过 EntityRenderer（由 ForceFieldRenderer 专门渲染）
  if (entity.components.has('forceField')) {
    return null;
  }

  // T-02-01: Defensive null check — corrupt ECS data won't crash the render tree
  if (!transform || !rigidBody || !collider || !material) {
    console.warn(`Entity ${entity.id} missing required components for rendering`);
    return null;
  }

  // ── Collider JSX (ECS ColliderComponent → Rapier Collider) ──
  const renderCollider = useMemo(() => {
    // W3 面摩擦路径（faces 存在）或圆弧类轨道（arc/doubleArc 必须分解为楔块，无单 collider 表示）
    if ((collider.faces && collider.faces.length > 0) || collider.shape === 'arc' || collider.shape === 'doubleArc') {
      const specs = computeFaceColliders(collider.shape, collider.params);
      const faceById = new Map((collider.faces ?? []).map((f) => [f.id, f]));
      return specs.map((spec, specIndex) => {
        const face = faceById.get(spec.faceId);
        const mu = face ? (face.pinned ? 1e6 : face.friction) : (rigidBody?.friction ?? 0.3);
        const common = {
          friction: Math.min(mu, 1e6),
          frictionCombineRule: CoefficientCombineRule.Multiply,
          restitution: Math.min((rigidBody?.restitution ?? 0.5) * restitutionScale, 1.0),
          density: 0,
          position: spec.position,
        } as const;
        const key = `${spec.faceId}-${specIndex}`;
        switch (spec.shape) {
          case 'ball':
            return <BallCollider key={key} {...common} args={spec.args} />;
          case 'cuboid':
            return <CuboidCollider key={key} {...common} args={spec.args} />;
          case 'cylinder':
            return <CylinderCollider key={key} {...common} args={spec.args} />;
          case 'convexHull':
            return <ConvexHullCollider key={key} {...common} args={spec.args} />;
          default:
            return null;
        }
      });
    }

    // 单 collider 旧路径（无 faces 配置的场景）
    switch (collider.shape) {
      case 'sphere':
        return <BallCollider args={[collider.params.radius ?? 1.0]} />;
      case 'cuboid':
        return (
          <CuboidCollider
            args={[
              collider.params.halfWidth ?? 1.0,
              collider.params.halfHeight ?? 1.0,
              collider.params.halfDepth ?? 1.0,
            ]}
          />
        );
      case 'cylinder':
        return (
          <CylinderCollider
            args={[
              collider.params.halfHeight ?? 1.0,
              collider.params.radius ?? 0.5,
            ]}
          />
        );
      case 'convexProfile': {
        // 按成型方式派生顶点集（extrude / revolve）
        const points = computeHullPoints('convexProfile', collider.params);
        return <ConvexHullCollider args={[points]} />;
      }
      default:
        return null;
    }
  }, [collider.shape, collider.params, collider.faces, rigidBody?.friction, rigidBody?.restitution, restitutionScale]);

  // ── Visual Geometry (ECS ColliderComponent → Three.js geometry) ──
  const renderGeometry = useMemo(() => {
    switch (collider.shape) {
      case 'sphere':
        return <sphereGeometry args={[collider.params.radius ?? 1.0, 32, 32]} />;
      case 'cuboid':
        return (
          <boxGeometry
            args={[
              (collider.params.halfWidth ?? 1.0) * 2,
              (collider.params.halfHeight ?? 1.0) * 2,
              (collider.params.halfDepth ?? 1.0) * 2,
            ]}
          />
        );
      case 'cylinder':
        return (
          <cylinderGeometry
            args={[
              collider.params.radius ?? 0.5,             // radiusTop
              collider.params.radius ?? 0.5,             // radiusBottom
              (collider.params.halfHeight ?? 1.0) * 2,   // height
              32,
            ]}
          />
        );
      case 'convexProfile': {
        // 与 ConvexHullCollider 同一份顶点集（挤出/车削按 mode 派生）— 视觉/碰撞严格一致
        const raw = computeHullPoints('convexProfile', collider.params);
        const points: Vector3[] = [];
        for (let i = 0; i < raw.length; i += 3) {
          points.push(new Vector3(raw[i], raw[i + 1], raw[i + 2]));
        }
        // eslint-disable-next-line react/no-unstable-nested-components -- primitive 几何对象随 params 重建
        return <primitive object={new ConvexGeometry(points)} attach="geometry" />;
      }
      case 'arc': {
        // 圆弧轨道视觉：完整扇区 ExtrudeGeometry（凹面光滑显示；碰撞为楔块近似）
        const outline = arcSectorOutline({
          innerR: collider.params.innerR ?? 3,
          thickness: collider.params.thickness ?? 0.5,
          arcAngleDeg: collider.params.arcAngle ?? 90,
          width: collider.params.width ?? 2,
        });
        const shape = new Shape();
        shape.moveTo(outline[0][0], outline[0][1]);
        for (let i = 1; i < outline.length; i++) {
          shape.lineTo(outline[i][0], outline[i][1]);
        }
        const geo = new ExtrudeGeometry(shape, {
          depth: collider.params.width ?? 2,
          bevelEnabled: false,
        });
        geo.translate(0, 0, -(collider.params.width ?? 2) / 2);
        // eslint-disable-next-line react/no-unstable-nested-components -- primitive 几何对象随 params 重建
        return <primitive object={geo} attach="geometry" />;
      }
      default:
        return <sphereGeometry args={[1.0, 32, 32]} />;
    }
  }, [collider.shape, collider.params]);

  // ── 双弧圆轨道视觉几何：内/外两条环带 ExtrudeGeometry（与碰撞楔块同参数派生）──
  const doubleArcGeometries = useMemo(() => {
    if (collider.shape !== 'doubleArc') return null;
    const p = collider.params;
    const w = p.width ?? 2;
    const { inner, outer } = doubleArcBandOutlines({
      innerR: p.innerR ?? 3,
      channelGap: p.channelGap ?? 0.6,
      thickness: p.thickness ?? 0.5,
      arcAngleDeg: p.arcAngle ?? 360,
      width: w,
      segments: p.segments,
    });
    const mk = (outline: [number, number][]) => {
      const shape = new Shape();
      shape.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]);
      const geo = new ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
      geo.translate(0, 0, -w / 2);
      return geo;
    };
    return { inner: mk(inner), outer: mk(outer) };
  }, [collider.shape, collider.params]);

  // ── Click Handler ──
  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation(); // Prevent penetration to onPointerMissed and other objects
      onSelect(entity.id);
    },
    [entity.id, onSelect],
  );

  // ── Outlines opacity (static; pulse animation via CSS/framer for future enhancement) ──
  const pulseOpacity = useMemo(() => 0.8, []);

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={rigidBody.kind}
      mass={rigidBody.mass}
      position={transform.position}
      rotation={transform.rotation as [number, number, number]}
      restitution={Math.min(rigidBody.restitution * restitutionScale, 1.0)}
      friction={rigidBody.friction}
      linearDamping={drag}
      angularDamping={drag * 0.5}
      linearVelocity={velocity?.linearVelocity ?? [0, 0, 0]}
      angularVelocity={velocity?.angularVelocity ?? [0, 0, 0]}
      colliders={false} // Manual Collider management — no auto-generation
      onContactForce={(payload) => {
        setContactForce(entity.id, new Vector3(
          payload.totalForce.x,
          payload.totalForce.y,
          payload.totalForce.z
        ));
      }}
    >
      {/* Collider — determines physics behavior */}
      {renderCollider}

      {/* Visual mesh — pure rendering; Rapier auto-syncs transforms */}
      {/* userData.entityId：虚影放置 raycast 过滤用（F3） */}
      {collider.shape === 'doubleArc' && doubleArcGeometries ? (
        // 双弧圆轨道：内/外两条环带各一个 mesh（同一材质），点击任一即选中
        <group onClick={handleClick}>
          <mesh castShadow receiveShadow geometry={doubleArcGeometries.inner} userData={{ entityId: entity.id }}>
            <meshStandardMaterial
              color={material.color}
              roughness={material.roughness}
              metalness={material.metalness}
              emissive={material.color}
              emissiveIntensity={isSelected ? 0.8 : 0.35}
            />
          </mesh>
          <mesh castShadow receiveShadow geometry={doubleArcGeometries.outer} userData={{ entityId: entity.id }}>
            <meshStandardMaterial
              color={material.color}
              roughness={material.roughness}
              metalness={material.metalness}
              emissive={material.color}
              emissiveIntensity={isSelected ? 0.8 : 0.35}
            />
          </mesh>
        </group>
      ) : (
        <mesh
          castShadow
          receiveShadow
          onClick={handleClick}
          userData={{ entityId: entity.id }}
        >
          {renderGeometry}
          <meshStandardMaterial
            color={material.color}
            roughness={material.roughness}
            metalness={material.metalness}
            emissive={material.color}        // Sci-fi Lab: 全息质感（HDR 亮度供 bloom 拾取）
            emissiveIntensity={isSelected ? 0.8 : 0.35}
          />
        </mesh>
      )}

      {/* Selection highlight outline — D-07, UI-SPEC Panel 4 */}
      {isSelected && (
        <Outlines
          thickness={0.05}
          color="#29d3e8"       // Sci-fi Lab 全息青
          screenspace={false}   // World-space line width (consistent thickness)
          opacity={pulseOpacity}
          angle={Math.PI}       // Full-angle edge detection
        />
      )}
    </RigidBody>
  );
}
