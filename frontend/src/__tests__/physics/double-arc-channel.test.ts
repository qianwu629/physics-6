/**
 * 双弧圆轨道物理回归 — 紧配球顺畅通过（防卡顿核心验收）
 *
 * 场景与用户 E2E 一致：
 * - 双弧轨道 innerR=3、channelGap=0.6（内径）、壁厚 0.5、整环 360°、宽 2，中心 (0, 4.5, 0)
 * - 球半径 0.3（直径 = 内径，紧配），初始位于通道底部，切向初速度 6 m/s
 *
 * 通道几何：环形通道径向跨 [innerR, innerR+gap+ε]（ε=内径游隙，见 channelClearance，
 * 防止零间隙预紧力 → 摩擦锁死）。紧配球球心静止时贴外环壁：r = rOut+ε−ballR ≈ 3.31。
 *
 * 直接用 Rapier（与生产同引擎、同一份 computeDoubleArcWedges 楔块数据）跑 8s 仿真。
 * 卡顿判据（用户反馈的「莫名其妙卡顿」）：
 * - 零间隙时球被两面预紧夹住，摩擦锁死在弧段中途（|v|≈0 但远离底部）；
 * - 加游隙后球应持续振荡，只在通道底部附近（≤18°）静止。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { computeDoubleArcWedges } from '../../ecs/doubleArcGeometry';

const TRACK_CENTER = { x: 0, y: 4.5, z: 0 };
const INNER_R = 3;
const GAP = 0.6;
const BALL_R = 0.3;
const V0 = 6;
const DT = 1 / 120;
const SIM_SECONDS = 8;

interface RunResult {
  /** 每步球心相对轨道中心的 XY 径向距离 */
  radial: number[];
  /** 每步 |z| */
  absZ: number[];
  /** 每步切向速度（沿轨道方向的有符号速度） */
  tangentialV: number[];
  /** 每步速率 */
  speed: number[];
  /** 每步离通道底部的角度（°）：0=正底部 */
  angleFromBottom: number[];
}

function runTightFitBall(): RunResult {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;

  // 轨道：fixed 体 + 生产同款楔块 collider（面摩擦 0.3，Multiply 合并）
  const trackBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(TRACK_CENTER.x, TRACK_CENTER.y, TRACK_CENTER.z),
  );
  const wedges = computeDoubleArcWedges({
    innerR: INNER_R,
    channelGap: GAP,
    thickness: 0.5,
    arcAngleDeg: 360,
    width: 2,
  });
  expect(wedges.length).toBeGreaterThan(0);
  for (const w of wedges) {
    const desc = RAPIER.ColliderDesc.convexHull(w.points);
    if (!desc) throw new Error('convexHull 构造失败');
    desc.setFriction(w.faceId === 'body' ? 0.3 : 0.3);
    desc.setRestitution(0.5);
    desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply);
    world.createCollider(desc, trackBody);
  }

  // 紧配球：通道底部中径处、切向初速度（质量 ≈1kg，线性阻尼 0.1 同环境阻力）
  // 球会下落一个游隙 ε 后贴外环壁滚动（静止球心 r ≈ 3.31）
  const ballBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(TRACK_CENTER.x, TRACK_CENTER.y - (INNER_R + BALL_R), TRACK_CENTER.z)
      .setLinvel(V0, 0, 0)
      .setLinearDamping(0.1)
      .setAngularDamping(0.05),
  );
  const ballCollider = RAPIER.ColliderDesc.ball(BALL_R)
    .setFriction(0.3)
    .setRestitution(0.5)
    .setDensity(8.84)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply);
  world.createCollider(ballCollider, ballBody);

  const result: RunResult = { radial: [], absZ: [], tangentialV: [], speed: [], angleFromBottom: [] };
  const steps = Math.round(SIM_SECONDS / DT);
  for (let i = 0; i < steps; i++) {
    world.step();
    const p = ballBody.translation();
    const v = ballBody.linvel();
    const rx = p.x - TRACK_CENTER.x;
    const ry = p.y - TRACK_CENTER.y;
    const rho = Math.hypot(rx, ry);
    result.radial.push(rho);
    result.absZ.push(Math.abs(p.z - TRACK_CENTER.z));
    // 切向单位向量 = 径向旋转 90°（CCW）：t̂ = (−ry, rx)/ρ
    result.tangentialV.push(rho > 1e-6 ? (v.x * -ry + v.y * rx) / rho : 0);
    result.speed.push(Math.hypot(v.x, v.y, v.z));
    // 离底部角度：底部在 −Y 方向（ry<0），atan2(|rx|, −ry)
    result.angleFromBottom.push((Math.abs(Math.atan2(rx, -ry)) * 180) / Math.PI);
  }
  world.free();
  return result;
}

describe('双弧圆轨道 — 紧配球（直径=内径）通过性', () => {
  let r: RunResult;

  beforeAll(async () => {
    await RAPIER.init();
    r = runTightFitBall();
  }, 60000);

  it('球始终被约束在通道内（球心径向带 [3.15, 3.55]，|z| ≤ 0.75）', () => {
    for (const rho of r.radial) {
      expect(rho).toBeGreaterThanOrEqual(3.15);
      expect(rho).toBeLessThanOrEqual(3.55);
    }
    for (const z of r.absZ) {
      expect(z).toBeLessThanOrEqual(0.75);
    }
  });

  it('球在通道内持续振荡（切向速度换向 ≥ 3 次）', () => {
    // 跳过起步 0.2s，统计切向速度符号翻转次数
    const skip = Math.round(0.2 / DT);
    let reversals = 0;
    let prevSign = 0;
    for (let i = skip; i < r.tangentialV.length; i++) {
      const v = r.tangentialV[i];
      if (Math.abs(v) < 0.3) continue; // 换向瞬间低速不计
      const sign = Math.sign(v);
      if (prevSign !== 0 && sign !== prevSign) reversals++;
      prevSign = sign;
    }
    expect(reversals).toBeGreaterThanOrEqual(3);
  });

  it('无摩擦锁死：后程（7–8s）窗口峰值速率 ≥ 1.0 m/s', () => {
    const from = Math.round(7 / DT);
    const lateMax = Math.max(...r.speed.slice(from));
    expect(lateMax).toBeGreaterThanOrEqual(1.0);
  });

  it('不卡在中途：不存在连续 1s 以上且离底部 >18° 的停滞', () => {
    // 摆到顶点瞬时静止是正常物理；只有「持续停滞在弧段中途」才是摩擦锁死
    let runStart = -1;
    const violations: number[] = [];
    for (let i = 0; i <= r.speed.length; i++) {
      const stalled = i < r.speed.length && r.speed[i] < 0.05 && r.angleFromBottom[i] > 18;
      if (stalled && runStart < 0) runStart = i;
      if (!stalled && runStart >= 0) {
        if (i - runStart > Math.round(1 / DT)) violations.push(runStart);
        runStart = -1;
      }
    }
    expect(violations).toEqual([]);
  });

  it('能量合理：全程峰值速率 ≤ 初速 + 容差，首秒峰值 ≥ 5 m/s', () => {
    const allMax = Math.max(...r.speed);
    expect(allMax).toBeLessThanOrEqual(V0 + 0.5);
    const firstSecondMax = Math.max(...r.speed.slice(0, Math.round(1 / DT)));
    expect(firstSecondMax).toBeGreaterThanOrEqual(5);
  });
});
