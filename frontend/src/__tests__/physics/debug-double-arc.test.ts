/**
 * DEBUG — 复刻浏览器精确设置（density 0 + setAdditionalMass + 地面）查发射原因（临时）
 */
import { describe, it, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { computeDoubleArcWedges } from '../../ecs/doubleArcGeometry';

describe('debug browser replica', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('browser-exact setup', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 120;

    // 地面（生产同款）
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setFriction(0.5).setRestitution(0.25), ground);

    // 轨道：density 0（生产面 collider 写法）
    const track = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 4.5, 0));
    const wedges = computeDoubleArcWedges({ innerR: 3, channelGap: 0.6, thickness: 0.5, arcAngleDeg: 360, width: 2 });
    for (const w of wedges) {
      const desc = RAPIER.ColliderDesc.convexHull(w.points)!;
      desc.setFriction(0.3).setRestitution(0.5).setDensity(0);
      desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply);
      world.createCollider(desc, track);
    }

    // 球：density 0 + setAdditionalMass(1)（生产 EntityRenderer 写法）
    const ball = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 0).setLinvel(6, 0, 0).setLinearDamping(0.1).setAngularDamping(0.05),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.3).setFriction(0.3).setRestitution(0.5).setDensity(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply),
      ball,
    );
    ball.setAdditionalMass(1, true);

    const lines: string[] = [];
    for (let i = 0; i <= 240; i++) {
      world.step();
      if (i % 6 === 0) {
        const p = ball.translation();
        const v = ball.linvel();
        const rho = Math.hypot(p.x, p.y - 4.5);
        lines.push(`t=${(i / 120).toFixed(2)} pos=(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(3)}) rho=${rho.toFixed(3)} |v|=${Math.hypot(v.x, v.y, v.z).toFixed(2)} m=${ball.mass().toFixed(2)}`);
      }
    }
    console.log(lines.join('\n'));
    world.free();
  }, 60000);
});
