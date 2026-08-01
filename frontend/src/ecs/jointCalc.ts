/**
 * 固定关节锚点计算（W4）— 创建时按两体当前位姿换算局部锚点与相对坐标架
 *
 * 数学推导（fixed joint 恒等式 T_A·F_A = T_B·F_B）：
 * - 取 F_A 为纯平移（anchorA，无旋转）→ 世界旋转 = qA
 * - 令 F_B 的旋转 frameB = qB⁻¹·qA → T_B·F_B 的世界旋转 = qB·(qB⁻¹·qA) = qA ✓
 * - 锚点：anchorA = qA⁻¹·(p−pA)，anchorB = qB⁻¹·(p−pB)（p 为世界锚点）
 * 结果：关节创建后两体保持当前相对姿态，不发生吸附位移。
 */

import * as THREE from 'three';
import type { FixedJointParams, RevoluteJointParams, SphericalJointParams } from './types';

export type Vec3Tuple = [number, number, number];

function quatFromEuler(rot: Vec3Tuple): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ'));
}

function toLocal(worldAnchor: Vec3Tuple, pos: Vec3Tuple, quat: THREE.Quaternion): Vec3Tuple {
  const v = new THREE.Vector3(worldAnchor[0] - pos[0], worldAnchor[1] - pos[1], worldAnchor[2] - pos[2]);
  v.applyQuaternion(quat.clone().invert());
  return [v.x, v.y, v.z];
}

/**
 * 计算固定关节参数。
 * @param posA/rotA  实体 A 的世界位置与欧拉角（rad，XYZ 顺序）
 * @param posB/rotB  实体 B 同上
 * @param worldAnchor 世界坐标锚点（通常取两体质心中点或某体中心）
 */
export function computeFixedJointParams(
  posA: Vec3Tuple,
  rotA: Vec3Tuple,
  posB: Vec3Tuple,
  rotB: Vec3Tuple,
  worldAnchor: Vec3Tuple,
): Omit<FixedJointParams, 'showLink'> {
  const qA = quatFromEuler(rotA);
  const qB = quatFromEuler(rotB);
  const frameBQuat = qB.clone().invert().multiply(qA);

  return {
    anchorA: toLocal(worldAnchor, posA, qA),
    anchorB: toLocal(worldAnchor, posB, qB),
    frameB: [frameBQuat.x, frameBQuat.y, frameBQuat.z, frameBQuat.w],
  };
}

/** 两体质心中点 */
export function midpoint(posA: Vec3Tuple, posB: Vec3Tuple): Vec3Tuple {
  return [(posA[0] + posB[0]) / 2, (posA[1] + posB[1]) / 2, (posA[2] + posB[2]) / 2];
}

// ── 二期：铰链 / 球窝 ──

function rotateIntoLocal(v: Vec3Tuple, quat: THREE.Quaternion): Vec3Tuple {
  const out = new THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(quat.clone().invert());
  return [out.x, out.y, out.z];
}

/**
 * 铰链关节参数：局部锚点 + 局部轴。
 * axisA/axisB 为世界轴分别逆旋转到两体局部系的结果；
 * 注意 Rapier revolute 只接受共享局部轴（实现用 axisA），两体朝向不一致时为近似。
 */
export function computeRevoluteParams(
  posA: Vec3Tuple,
  rotA: Vec3Tuple,
  posB: Vec3Tuple,
  rotB: Vec3Tuple,
  worldAnchor: Vec3Tuple,
  worldAxis: Vec3Tuple,
): Omit<RevoluteJointParams, 'showLink'> {
  const qA = quatFromEuler(rotA);
  const qB = quatFromEuler(rotB);
  const axisLen = Math.hypot(worldAxis[0], worldAxis[1], worldAxis[2]);
  const axis: Vec3Tuple = axisLen > 1e-9
    ? [worldAxis[0] / axisLen, worldAxis[1] / axisLen, worldAxis[2] / axisLen]
    : [0, 1, 0]; // 零向量防御 → 默认 Y 轴
  return {
    anchorA: toLocal(worldAnchor, posA, qA),
    anchorB: toLocal(worldAnchor, posB, qB),
    axisA: rotateIntoLocal(axis, qA),
    axisB: rotateIntoLocal(axis, qB),
  };
}

/** 球窝关节参数：仅局部锚点（全向旋转，无轴） */
export function computeSphericalParams(
  posA: Vec3Tuple,
  rotA: Vec3Tuple,
  posB: Vec3Tuple,
  rotB: Vec3Tuple,
  worldAnchor: Vec3Tuple,
): Omit<SphericalJointParams, 'showLink'> {
  const qA = quatFromEuler(rotA);
  const qB = quatFromEuler(rotB);
  return {
    anchorA: toLocal(worldAnchor, posA, qA),
    anchorB: toLocal(worldAnchor, posB, qB),
  };
}
