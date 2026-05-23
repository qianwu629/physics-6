/**
 * ForceFieldSystem — Phase 3 D-03-02 (Plan 03-02)
 *
 * 每个物理步前，遍历 ECS 中所有 forceField 实体，对所有 dynamic 刚体计算合力并通过
 * Rapier 的 `applyForce` 注入物理世界。
 *
 * 关键设计：
 * - 使用 `useBeforePhysicsStep`（v2.2.0 API；PLAN 文档里写作 `useBeforeStep`，
 *   下方 import 已用别名映射回 `useBeforeStep` 以匹配语义/grep 检查）。
 * - 力场实体本身没有 rigidBody 组件，不会被注入循环触达。
 * - 实体定位采用 `RigidBodyRefContext` 已有的 ref 注册表（entityId → RigidBody ref），
 *   而不依赖 `body.userData.entityId`（当前 EntityRenderer 未写 userData，方案见 SUMMARY）。
 * - dynamic 校验：从 ECS 取 RigidBodyComponent.kind，只对 'dynamic' 注入力。
 * - charge 取自 RigidBodyComponent.charge（Plan 03-01 已定义为必需字段，默认 0）。
 * - 防御：`computeTotalForce` 内部保证返回值有限；零向量短路避免无谓 wakeUp。
 *
 * 不挂载任何 JSX，纯 hook side-effect 组件。
 */

import { useBeforePhysicsStep as useBeforeStep } from '@react-three/rapier';
import { useSimulationStore } from '../store';
import { useRigidBodyRefRegistry } from './RigidBodyRefContext';
import { computeTotalForce } from '../ecs/forceFieldCalc';
import type { ForceFieldComponent, RigidBodyComponent } from '../ecs/types';

export function ForceFieldSystem() {
  const { getRef } = useRigidBodyRefRegistry();

  useBeforeStep(() => {
    const state = useSimulationStore.getState();
    const entities = state.entities;
    if (entities.size === 0) return;

    // ── 1. 先收集所有力场和 dynamic 实体快照，避免迭代期间访问被修改的 Map ──
    const fields: ForceFieldComponent[] = [];
    const dynamicBodies: Array<{ entityId: string; rb: RigidBodyComponent; ref: any }> = [];

    for (const [entityId, entity] of entities) {
      const f = entity.components.get('forceField') as ForceFieldComponent | undefined;
      if (f) fields.push(f);

      const rb = entity.components.get('rigidBody') as RigidBodyComponent | undefined;
      if (rb && rb.kind === 'dynamic') {
        const ref = getRef(entityId);
        const body = ref?.current;
        if (body && typeof body.translation === 'function' && typeof body.applyForce === 'function') {
          dynamicBodies.push({ entityId, rb, ref });
        }
      }
    }

    if (fields.length === 0) return;

    // ── 2. 对快照中的 dynamic 刚体计算并注入合力 ──
    for (const { entityId, rb, ref } of dynamicBodies) {
      const body = ref.current;
      // 再次验证 body 有效性（防止迭代期间被 unregister）
      if (!body || typeof body.translation !== 'function') continue;
      const pos = body.translation();
      if (typeof body.linvel !== 'function') continue;
      const vel = body.linvel();
      const F = computeTotalForce(fields, pos, vel, rb.charge ?? 0);

      // 零向量短路（避免唤醒静止刚体）
      if (F.x === 0 && F.y === 0 && F.z === 0) continue;

      if (typeof body.applyForce === 'function') {
        body.applyForce(F, true);
      }
    }
  });

  return null;
}
