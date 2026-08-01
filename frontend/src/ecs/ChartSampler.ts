/**
 * Phase 2: 图表采样器 — 60Hz useFrame 采样循环
 *
 * ChartSampler 是纯逻辑组件（无 DOM 输出），挂载在 Scene3D 的 R3F Canvas 内部。
 * 每帧从 Rapier rigidBody 读取物理量，计算能量和加速度，写入 chartBuffer。
 *
 * 遵循 D-02-04 (共享 R3F useFrame) 和 D-02-07 (暂停冻结/重置清空)。
 * 类比 TrajectoryRenderer 的 useFrame 采样模式 (PATTERNS.md)。
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import { useChartDataStore } from '../store/chartDataStore';
import { getOrCreateBuffer, clearAllBuffers, METRICS_PER_ENTITY } from '../store/chartBuffer';
import { useRigidBodyRefRegistry } from '../components/RigidBodyRefContext';
import { computeEnergy, AccelerationSmoother } from '../utils/physicsCalc';
import { nowSeconds } from '../utils/nowSeconds';
import type { ConstraintComponent } from './types';

/** 采样间隔 — 60Hz (与渲染帧同步, D-02-04) */
const SAMPLE_INTERVAL = 1 / 60;

/**
 * ChartSampler — 纯逻辑组件
 *
 * 挂载在 <Physics> 的 Provider 内部（需要访问 RigidBodyRefContext）。
 * 无 DOM 输出 — return null。
 */
export function ChartSampler() {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const resetCounter = useSimulationStore((s) => s.resetCounter);
  const entities = useSimulationStore((s) => s.entities);
  const gravity = useSimulationStore((s) => s.environment.gravity);
  const { getRef } = useRigidBodyRefRegistry();

  // 每实体一个加速度平滑器实例
  const smootherMap = useRef<Map<string, AccelerationSmoother>>(new Map());
  const lastSampleTime = useRef<number>(0);
  const prevResetCounter = useRef(resetCounter);

  // ── 监听 resetCounter 变化 → 清空所有缓冲 (D-02-07) ──
  useEffect(() => {
    if (resetCounter !== prevResetCounter.current) {
      clearAllBuffers();
      smootherMap.current.clear();
      prevResetCounter.current = resetCounter;
    }
  }, [resetCounter]);

  // ── 60Hz 采样循环 (D-02-04: 共享 R3F useFrame) ──
  useFrame(() => {
    // D-02-07: 暂停时冻结 — 不写入任何数据
    if (!isRunning) return;

    // C-01 / W-04 fix: 统一通过 nowSeconds() 读取时间, 与 ChartCanvas
    // 读取端共用同一时钟; 测试可 vi.spyOn(nowSeconds) 防止再次回归。
    const now = nowSeconds();

    // 60Hz 节流 — 避免超过 60Hz 采样
    if (now - lastSampleTime.current < SAMPLE_INTERVAL) return;
    lastSampleTime.current = now;

    const trackedIds = useChartDataStore.getState().trackedEntityIds;
    // C-04 fix: peReferenceY 从 simulationSlice.environment 读取(唯一来源)
    const peReferenceY = useSimulationStore.getState().environment.peReferenceY;

    if (trackedIds.size === 0) return;

    // ── 收集所有弹簧约束信息（用于能量计算）──
    const springs: Array<{
      stiffness: number;
      restLength: number;
      entityAId: string;
      entityBId: string;
    }> = [];

    for (const [, entity] of entities) {
      const constraint = entity.components.get('constraint') as ConstraintComponent | undefined;
      if (constraint && constraint.kind === 'spring') {
        springs.push({
          stiffness: constraint.params.stiffness,
          restLength: constraint.params.restLength,
          entityAId: constraint.entityAId,
          entityBId: constraint.entityBId,
        });
      }
    }

    // ── 获取实体位置的辅助函数 ──
    const getEntityPosition = (id: string): THREE.Vector3 | null => {
      const rbRef = getRef(id);
      if (!rbRef?.current) return null;
      const t = rbRef.current.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    };

    // ── 遍历所有被追踪实体 ──
    for (const entityId of trackedIds) {
      const rbRef = getRef(entityId);
      if (!rbRef?.current) continue;

      const rb = rbRef.current;
      const vel = rb.linvel();
      const pos = rb.translation();
      const mass = rb.mass();

      // 加速度：最小二乘拟合（真实时间戳，每实体一个 smoother 实例）
      let smoother = smootherMap.current.get(entityId);
      if (!smoother) {
        smoother = new AccelerationSmoother();
        smootherMap.current.set(entityId, smoother);
      }
      smoother.push(now, vel.x, vel.y, vel.z);
      const [ax, ay, az] = smoother.getSmoothedAcceleration();

      // 能量计算
      const { ke, peGravity, peSprings, total } = computeEnergy(
        rb,
        mass,
        gravity[1],
        peReferenceY,
        springs,
        getEntityPosition,
      );

      // ── 组装 15 指标 (METRICS_PER_ENTITY = 15) ──
      // 索引约定:
      //   0-2:  位置 (x, y, z)
      //   3-5:  速度 (vx, vy, vz)
      //   6-8:  加速度 (ax, ay, az)
      //   9:    动能 (KE)
      //   10:   势能 (PE_gravity + PE_springs)
      //   11:   总能量 (KE + PE = E)
      //   12-14: 动量 (px, py, pz = m·v)
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      metrics[0] = pos.x;
      metrics[1] = pos.y;
      metrics[2] = pos.z;
      metrics[3] = vel.x;
      metrics[4] = vel.y;
      metrics[5] = vel.z;
      metrics[6] = ax;
      metrics[7] = ay;
      metrics[8] = az;
      metrics[9] = ke;
      metrics[10] = peGravity + peSprings; // 总势能
      metrics[11] = total;
      metrics[12] = mass * vel.x;
      metrics[13] = mass * vel.y;
      metrics[14] = mass * vel.z;

      const buf = getOrCreateBuffer(entityId);
      buf.push(now, metrics);
    }
  });

  return null; // 纯逻辑组件 — 无 DOM 输出
}
