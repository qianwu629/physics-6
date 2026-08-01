/**
 * ForceFieldSystem — 力注入管道（Phase 3 D-03-02 + Phase 8 场-源关系）
 *
 * 每个物理步前，对 ECS 中所有 dynamic 刚体计算合力并注入物理世界：
 *
 * 力来源：
 * - 预设力场（uniform/gravity/electric）：computeNonMagneticForce
 * - 电荷源（任何 charge≠0 的实体，含 fixed）：computeCoulombForce —— Phase 8
 * 以上非磁力统一以 `applyImpulse(F·dt)` 施加。
 *
 * 磁场来源：
 * - 预设磁场：computeTotalMagneticField
 * - 电流源（currentSource 实体，等效无限长直导线）：computeWireMagneticField —— Phase 8
 * 总 B 场通过罗德里格斯旋转直接旋转速度（setLinvel），保证洛伦兹力不做功、能量严格守恒，
 * 且与冲量路径完全分离，避免双重施加。
 *
 * 关键设计：
 * - 为什么用 applyImpulse 而不是 addForce：Rapier 的 addForce 是**跨步持久**的，
 *   必须手动 resetForces 清除；每步 addForce 而不 reset 会让力随步数线性累加，
 *   能量平方级爆炸。applyImpulse 是一次性的，无残留，也无需与其他系统协调 reset 时机。
 * - 使用 `useBeforePhysicsStep`（v2.2.0 API；别名 useBeforeStep 以匹配语义/grep 检查）。
 * - 步长 dt 取自 `world.timestep`（Scene3D 的 Physics timeStep），不再硬编码。
 * - 力场实体本身没有 rigidBody 组件，不会被注入循环触达。
 * - 实体定位采用 `RigidBodyRefContext` 的 ref 注册表（entityId → RigidBody ref）。
 * - dynamic 校验：从 ECS 取 RigidBodyComponent.kind，只对 'dynamic' 注入力。
 * - 电荷源自相互作用由 computeCoulombForce 的 targetId 排除；fixed 带电体可作源但不受力。
 * - 防御：所有 Rapier 方法调用前做 typeof 检查（StrictMode 双挂载下 ref 可能短暂失效）。
 *
 * 不挂载任何 JSX，纯 hook side-effect 组件。
 */

import { useBeforePhysicsStep as useBeforeStep } from '@react-three/rapier';
import { useSimulationStore } from '../store';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import { computeNonMagneticForce, computeTotalMagneticField, rotateVelocityByMagneticField } from '../ecs/forceFieldCalc';
import { computeCoulombForce, computeWireMagneticField, type ChargeSource, type WireSource } from '../ecs/fieldSourceCalc';
import type { CurrentSourceComponent, ForceFieldComponent, RigidBodyComponent, TransformComponent } from '../ecs/types';

/** world.timestep 不可用时的回退步长（与 Scene3D.tsx 中 Physics timeStep 一致） */
const FALLBACK_DT = 1 / 120;

export function ForceFieldSystem() {
  const { getRef } = useRigidBodyRefRegistry();

  useBeforeStep((world) => {
    const state = useSimulationStore.getState();
    const entities = state.entities;
    if (entities.size === 0) return;

    const dt = typeof world?.timestep === 'number' && world.timestep > 0 ? world.timestep : FALLBACK_DT;

    // ── 1. 收集力场、场源和 dynamic 实体快照 ──
    const fields: ForceFieldComponent[] = [];
    const chargeSources: ChargeSource[] = [];
    const wires: WireSource[] = [];
    const dynamicBodies: Array<{ entityId: string; rb: RigidBodyComponent; ref: any }> = [];

    for (const [entityId, entity] of entities) {
      const f = entity.components.get('forceField') as ForceFieldComponent | undefined;
      if (f) fields.push(f);

      const cs = entity.components.get('currentSource') as CurrentSourceComponent | undefined;
      if (cs) {
        const tr = entity.components.get('transform') as TransformComponent | undefined;
        if (tr) {
          wires.push({ position: tr.position, current: cs.magnitude, direction: cs.direction });
        }
      }

      const rb = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
      if (!rb) continue;

      // 任何 charge≠0 的实体（含 fixed）都是库仑场源
      if (rb.charge !== 0) {
        const ref = getRef(entityId);
        const body = ref?.current;
        if (body && typeof body.translation === 'function') {
          const t = body.translation();
          chargeSources.push({ id: entityId, position: [t.x, t.y, t.z], charge: rb.charge });
        } else {
          const tr = entity.components.get('transform') as TransformComponent | undefined;
          if (tr) chargeSources.push({ id: entityId, position: tr.position, charge: rb.charge });
        }
      }

      if (rb.kind === 'dynamic') {
        const ref = getRef(entityId);
        const body = ref?.current;
        if (body && typeof body.translation === 'function' && typeof body.applyImpulse === 'function') {
          dynamicBodies.push({ entityId, rb, ref });
        }
      }
    }

    if (fields.length === 0 && chargeSources.length === 0 && wires.length === 0) return;

    // ── 2. 对快照中的 dynamic 刚体施加力 ──
    for (const { entityId, rb, ref } of dynamicBodies) {
      const body = ref.current;
      if (!body || typeof body.translation !== 'function') continue;
      const pos = body.translation();
      if (typeof body.linvel !== 'function') continue;
      const vel = body.linvel();
      const charge = rb.charge ?? 0;

      // 2a) 非磁合力以冲量施加：预设力场 + 电荷源库仑力（J = F·dt，等效该步内恒力 F）
      //     磁场力不经过此路径——由下方罗德里格斯旋转单独处理，避免双重施加
      const Ff = computeNonMagneticForce(fields, pos, charge);
      const Fc = computeCoulombForce(chargeSources, entityId, pos, charge);
      const F = { x: Ff.x + Fc.x, y: Ff.y + Fc.y, z: Ff.z + Fc.z };

      if (F.x !== 0 || F.y !== 0 || F.z !== 0) {
        body.applyImpulse({ x: F.x * dt, y: F.y * dt, z: F.z * dt }, true);
      }

      // 2b) 磁场（预设磁场 + 电流源 B）通过罗德里格斯旋转直接旋转速度，保证能量守恒
      if (charge !== 0 && typeof body.mass === 'function' && typeof body.setLinvel === 'function') {
        const Bf = computeTotalMagneticField(fields, charge);
        const Bw = computeWireMagneticField(wires, pos);
        const B = { x: Bf.x + Bw.x, y: Bf.y + Bw.y, z: Bf.z + Bw.z };
        if (B.x !== 0 || B.y !== 0 || B.z !== 0) {
          const mass = body.mass();
          if (mass > 0) {
            const newVel = rotateVelocityByMagneticField(vel, B, charge, mass, dt);
            body.setLinvel(newVel, true);
          }
        }
      }
    }
  });

  return null;
}
