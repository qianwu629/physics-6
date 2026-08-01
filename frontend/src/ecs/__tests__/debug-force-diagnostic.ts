/**
 * 力场诊断脚本 — 绕过 UI，直接验证力计算
 *
 * 用法: npx tsx src/ecs/__tests__/debug-force-diagnostic.ts
 *
 * 复现场景:
 * - 电场源在 [0, 20, 0]，电荷 Q=1，范围 range=10
 * - 带电球在 [0, 1, 0]，电荷 q=1.3，质量 m=1.3
 * - 对比不带电球 (q=0) 在同一位置的受力
 */

import { computeFieldForce, computeTotalForce, computeNonMagneticForce } from '../forceFieldCalc';
import type { ForceFieldComponent, ElectricFieldComponent } from '../types';

// ═══════════════════════════════════════════
// 场景参数（与用户实际设置一致）
// ═══════════════════════════════════════════

const GRAVITY = 9.81;
const BALL_MASS = 1.3;
const DT = 1 / 120;

interface TestCase {
  label: string;
  fieldPos: [number, number, number];
  fieldRange: number;
  fieldCharge: number;
  ballPos: { x: number; y: number; z: number };
  ballCharge: number;
  ballMass: number;
}

const cases: TestCase[] = [
  {
    label: '场景 A: 默认电场 (range=10, 球在 y=1, 场源在 y=20)',
    fieldPos: [0, 20, 0],
    fieldRange: 10,
    fieldCharge: 1,
    ballPos: { x: 0, y: 1, z: 0 },
    ballCharge: 1.3,
    ballMass: BALL_MASS,
  },
  {
    label: '场景 B: 扩大范围 (range=50, 球在 y=1, 场源在 y=20)',
    fieldPos: [0, 20, 0],
    fieldRange: 50,
    fieldCharge: 1,
    ballPos: { x: 0, y: 1, z: 0 },
    ballCharge: 1.3,
    ballMass: BALL_MASS,
  },
  {
    label: '场景 C: 不带电球 (q=0) 对照 — 仅重力',
    fieldPos: [0, 20, 0],
    fieldRange: 50,
    fieldCharge: 1,
    ballPos: { x: 0, y: 1, z: 0 },
    ballCharge: 0,
    ballMass: BALL_MASS,
  },
  {
    label: '场景 D: 异性电荷 (球 q=-1.3, 场源 Q=1) — 应吸引↑',
    fieldPos: [0, 20, 0],
    fieldRange: 50,
    fieldCharge: 1,
    ballPos: { x: 0, y: 1, z: 0 },
    ballCharge: -1.3,
    ballMass: BALL_MASS,
  },
  {
    label: '场景 E: 球在 y=10 (距离 10m)，同性电荷',
    fieldPos: [0, 20, 0],
    fieldRange: 50,
    fieldCharge: 1,
    ballPos: { x: 0, y: 10, z: 0 },
    ballCharge: 1.3,
    ballMass: BALL_MASS,
  },
  {
    label: '场景 F: 球在 y=19 (距离 1m)，异性电荷 — 应强力吸引↑',
    fieldPos: [0, 20, 0],
    fieldRange: 50,
    fieldCharge: 1,
    ballPos: { x: 0, y: 19, z: 0 },
    ballCharge: -1.3,
    ballMass: BALL_MASS,
  },
];

function fmt(n: number, decimals = 4): string {
  return n.toFixed(decimals);
}

function runDiagnostics() {
  console.log('═'.repeat(70));
  console.log('力场诊断报告');
  console.log('═'.repeat(70));
  console.log(`重力加速度: ${GRAVITY} m/s²`);
  console.log(`物理步长: ${DT} s (${1/DT} Hz)`);
  console.log('');

  for (const tc of cases) {
    console.log('─'.repeat(70));
    console.log(`【${tc.label}】`);
    console.log(`  场源位置: [${tc.fieldPos.join(', ')}]  Q=${tc.fieldCharge}  range=${tc.fieldRange}`);
    console.log(`  球体位置: [${fmt(tc.ballPos.x)}, ${fmt(tc.ballPos.y)}, ${fmt(tc.ballPos.z)}]  q=${tc.ballCharge}  m=${tc.ballMass}`);

    const field: ElectricFieldComponent = {
      type: 'forceField',
      kind: 'electric',
      position: tc.fieldPos,
      range: tc.fieldRange,
      charge: tc.fieldCharge,
      decay: true,
    };

    const fields: ForceFieldComponent[] = [field];

    // 计算距离
    const dx = tc.ballPos.x - tc.fieldPos[0];
    const dy = tc.ballPos.y - tc.fieldPos[1];
    const dz = tc.ballPos.z - tc.fieldPos[2];
    const r = Math.hypot(dx, dy, dz);
    const inRange = r <= tc.fieldRange;
    console.log(`  距场源: ${fmt(r, 2)} m  ${inRange ? '✅ 范围内' : '❌ 超出范围!'}`);

    // 电场力
    const F_field = computeFieldForce(field, tc.ballPos, { x: 0, y: 0, z: 0 }, tc.ballCharge);
    const Fmag_field = Math.hypot(F_field.x, F_field.y, F_field.z);

    // 验证：computeTotalForce vs computeNonMagneticForce (纯电场应一致)
    const F_total = computeTotalForce(fields, tc.ballPos, { x: 0, y: 0, z: 0 }, tc.ballCharge);
    const F_nonmag = computeNonMagneticForce(fields, tc.ballPos, tc.ballCharge);
    const Fmag_total = Math.hypot(F_total.x, F_total.y, F_total.z);
    const Fmag_nonmag = Math.hypot(F_nonmag.x, F_nonmag.y, F_nonmag.z);

    // 重力
    const F_gravity = tc.ballMass * GRAVITY;

    // 净力
    const netY = F_field.y - F_gravity; // 电场力向上为正，重力向下为负
    const netAccel = netY / tc.ballMass;

    console.log(`  电场力: F = [${fmt(F_field.x, 6)}, ${fmt(F_field.y, 6)}, ${fmt(F_field.z, 6)}]  |F|=${fmt(Fmag_field, 6)} N`);
    console.log(`  重力:   F = [0, ${fmt(-F_gravity, 2)}, 0]  |F|=${fmt(F_gravity, 2)} N`);
    console.log(`  净力:   F_net_y = ${fmt(netY, 4)} N  →  a_y = ${fmt(netAccel, 4)} m/s²`);

    // 验证一致性
    const totalVsNonmagOk = Math.abs(Fmag_total - Fmag_nonmag) < 0.0001;
    const fieldVsTotalOk = Math.abs(Fmag_field - Fmag_total) < 0.0001;
    console.log(`  一致性检查: totalForce==nonMagForce: ${totalVsNonmagOk ? '✅' : '❌'}  fieldForce==totalForce: ${fieldVsTotalOk ? '✅' : '❌'}`);

    // 诊断结论
    if (!inRange) {
      console.log(`  ⚠️  球体在力场范围外！电场力=0。球体不受电场影响。`);
      console.log(`  → 修复建议: 增大 range 参数（当前 ${tc.fieldRange}m < 距离 ${fmt(r, 1)}m）`);
    } else if (Fmag_field < 0.01) {
      console.log(`  ⚠️  电场力极小 (${fmt(Fmag_field, 6)} N)，远小于重力 (${fmt(F_gravity, 2)} N)`);
      console.log(`  → 修复建议: 需要增大库仑常数 COULOMB_K`);
    } else if (tc.ballCharge > 0 && tc.fieldCharge > 0 && F_field.y < 0) {
      console.log(`  ℹ️  同性电荷排斥：场源在上方，球被向下排斥（与重力同向）→ 球下落更快`);
    } else if (tc.ballCharge < 0 && tc.fieldCharge > 0 && F_field.y > 0) {
      const canOvercomeGravity = F_field.y > F_gravity;
      console.log(`  ℹ️  异性电荷吸引：场源在上方，球被向上吸引`);
      console.log(`  → 电场力${canOvercomeGravity ? '能' : '不能'}克服重力 (${fmt(F_field.y, 4)} vs ${fmt(F_gravity, 2)} N)`);
    }

    // 速度影响预估（单步）
    if (inRange && Fmag_field > 0) {
      const dv_y_field = (F_field.y / tc.ballMass) * DT;
      const dv_y_grav = -GRAVITY * DT;
      console.log(`  单步速度变化: Δv_field_y=${fmt(dv_y_field, 6)} m/s  Δv_grav_y=${fmt(dv_y_grav, 4)} m/s`);
    }

    console.log('');
  }

  // ═══════════════════════════════════════════
  // 汇总建议
  // ═══════════════════════════════════════════
  console.log('═'.repeat(70));
  console.log('诊断汇总');
  console.log('═'.repeat(70));
  console.log('1. 如果球在力场范围外 → 电场力=0，球不受影响');
  console.log('2. 同性电荷 (q·Q > 0) → 排斥力，场源在上方则球加速下落');
  console.log('3. 异性电荷 (q·Q < 0) → 吸引力，场源在上方则球上升');
  console.log('4. COULOMB_K=1000 已应用，使 1C 电荷在 10m 处产生 ~10N 力');
  console.log('5. 力箭头 (VectorRenderer) 和实际力 (ForceFieldSystem) 使用不同函数:');
  console.log('   - VectorRenderer: computeTotalForce (含磁场)');
  console.log('   - ForceFieldSystem: computeNonMagneticForce (排除磁场)');
  console.log('   纯电场场景下二者一致 ✅');
  console.log('═'.repeat(70));
}

runDiagnostics();
