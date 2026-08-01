/**
 * spliceCalc 单元测试 — 拼接面定义 / 世界变换 / 拼接位姿 / 接缝盒
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getSpliceFaces, getEntryFace, toWorldFace, computeSplicePose, computeSeamBox, pickSpliceFace } from '../spliceCalc';

describe('getSpliceFaces', () => {
  it('Test 1: cuboid → 四个竖直侧边', () => {
    const faces = getSpliceFaces('cuboid', { halfWidth: 2, halfHeight: 1, halfDepth: 3 });
    expect(faces.map((f) => f.faceId)).toEqual(['left', 'right', 'front', 'back']);
    expect(faces[0].center).toEqual([-2, 0, 0]);
    expect(faces[1].normal).toEqual([1, 0, 0]);
  });

  it('Test 2: arc → 两个端面，法线径向', () => {
    const faces = getSpliceFaces('arc', { innerR: 3, thickness: 0.5, arcAngle: 90, width: 2 });
    expect(faces).toHaveLength(2);
    // 90° 弧：θ0=45°, θ1=135°；midR=3.25
    const [f0, f1] = faces;
    expect(f0.center[0]).toBeCloseTo(Math.cos(Math.PI / 4) * 3.25, 6);
    expect(f0.center[1]).toBeCloseTo(Math.sin(Math.PI / 4) * 3.25, 6);
    expect(f1.normal[0]).toBeCloseTo(Math.cos((3 * Math.PI) / 4), 8);
    expect(f1.normal[1]).toBeCloseTo(Math.sin((3 * Math.PI) / 4), 8);
  });

  it('Test 3: 入口面 — cuboid 为 left，arc 为 end-0', () => {
    expect(getEntryFace('cuboid', {})!.faceId).toBe('left');
    expect(getEntryFace('arc', { innerR: 3, thickness: 0.5, arcAngle: 90, width: 2 })!.faceId).toBe('end-0');
  });
});

describe('toWorldFace + computeSplicePose', () => {
  it('Test 4: 平面拼平面（母版在原点，拼右端）→ 新平面紧贴右侧，无旋转', () => {
    const masterFace = toWorldFace(getSpliceFaces('cuboid', { halfWidth: 2, halfDepth: 1 })[1], [0, 0, 0], [0, 0, 0]);
    const entry = getEntryFace('cuboid', { halfWidth: 2, halfDepth: 1 })!;
    const pose = computeSplicePose(masterFace, entry);
    // 母版右端面心 (2,0,0)，新轨道入口面心局部 (-2,0,0) → newPos = (4,0,0)
    expect(pose.position[0]).toBeCloseTo(4, 8);
    expect(pose.position[1]).toBeCloseTo(0, 8);
    expect(pose.rotation[2]).toBeCloseTo(0, 8);
  });

  it('Test 5: 斜面 30° 拼低端 → 新轨道同角 30° 连续延伸', () => {
    const angle = Math.PI / 6;
    const masterFace = toWorldFace(
      getSpliceFaces('cuboid', { halfWidth: 2, halfDepth: 1 })[1], // right 端（旋转后 = 低端）
      [0, 1, 0],
      [0, 0, angle],
    );
    const entry = getEntryFace('cuboid', { halfWidth: 2, halfDepth: 1 })!;
    const pose = computeSplicePose(masterFace, entry);
    // 新轨道旋转应等于母版旋转（30°）→ 连续共线
    expect(pose.rotation[2]).toBeCloseTo(angle, 6);
    // 新轨道入口面心应落在母版面心上：masterCenter = R·(hw,0,0)+(0,1,0)
    const cx = Math.cos(angle) * 2;
    const cy = Math.sin(angle) * 2 + 1;
    // newEntryWorld = pose.pos + R_pose·(-2,0,0) 应等于 (cx, cy)
    const ex = pose.position[0] + Math.cos(angle) * -2;
    const ey = pose.position[1] + Math.sin(angle) * -2;
    expect(ex).toBeCloseTo(cx, 6);
    expect(ey).toBeCloseTo(cy, 6);
  });

  it('Test 6: 拼到 +z 面 → 新轨道贴合法线向外延伸', () => {
    const masterFace = toWorldFace(getSpliceFaces('cuboid', { halfWidth: 2, halfDepth: 1 })[2], [0, 0, 0], [0, 0, 0]);
    const entry = getEntryFace('cuboid', { halfWidth: 2, halfDepth: 1 })!;
    const pose = computeSplicePose(masterFace, entry);
    // 母版面心 (0,0,1)，入口面心局部 (-2,0,0) 经旋转 R(-x→-z) → (0,0,-2)
    // newPos = (0,0,1) − (0,0,-2) = (0,0,3)：新轨道从母版面向 +z 外侧延伸
    expect(pose.position[0]).toBeCloseTo(0, 6);
    expect(pose.position[2]).toBeCloseTo(3, 6);
    // 验证入口面心世界坐标 = newPos + R·entryCenter = (0,0,3)+(0,0,-2) = (0,0,1) = 母版面心
    expect(pose.position[2] - 2).toBeCloseTo(1, 6);
  });
});

describe('computeSeamBox', () => {
  it('Test 7: 接缝盒中心=母版面心，薄壳厚 0.3，面宽 +0.2 余量', () => {
    const masterFace = { center: [2, 0, 0] as [number, number, number], normal: [1, 0, 0] as [number, number, number] };
    const entry = getEntryFace('cuboid', { halfWidth: 2, halfDepth: 1.5 })!;
    const seam = computeSeamBox(masterFace, entry);
    expect(seam.center).toEqual([2, 0, 0]);
    expect(seam.halfExtents[0]).toBeCloseTo(0.3, 8);
    expect(seam.halfExtents[2]).toBeCloseTo(1.5 + 0.2, 8);
    // 法线 +x → quaternion 单位
    expect(Math.hypot(...seam.quaternion)).toBeCloseTo(1, 8);
  });
});

// ── pickSpliceFace ──

describe('pickSpliceFace', () => {
  it('Test 8: cuboid 命中右侧点 → right；左侧点 → left', () => {
    const faces = getSpliceFaces('cuboid', { halfWidth: 2, halfDepth: 1 });
    expect(pickSpliceFace(faces, [1.9, 0.5, 0])!.faceId).toBe('right');
    expect(pickSpliceFace(faces, [-1.8, 0.2, 0.3])!.faceId).toBe('left');
    expect(pickSpliceFace(faces, [0, 0.5, 0.9])!.faceId).toBe('front');
  });

  it('Test 9: arc 命中端面 1 附近 → end-0；端面 2 附近 → end-1', () => {
    const faces = getSpliceFaces('arc', { innerR: 3, thickness: 0.5, arcAngle: 90, width: 2 });
    // θ0=45° 端面附近点（沿 θ0 径向靠外）
    const p0: [number, number, number] = [Math.cos(Math.PI / 4) * 4, Math.sin(Math.PI / 4) * 4, 0];
    expect(pickSpliceFace(faces, p0)!.faceId).toBe('end-0');
    const p1: [number, number, number] = [Math.cos((3 * Math.PI) / 4) * 4, Math.sin((3 * Math.PI) / 4) * 4, 0];
    expect(pickSpliceFace(faces, p1)!.faceId).toBe('end-1');
  });
});

// ── 楔形斜面拼接（slope wedge） ──

describe('slopeWedgeProfile + wedge splice', () => {
  it('Test 10: 楔形轮廓几何 — 薄端 t、厚端 H=L·tanθ、凸形', async () => {
    const { slopeWedgeProfile } = await import('../profileGeometry');
    const { isConvexProfile } = await import('../profileGeometry');
    const p = slopeWedgeProfile(3, 30, 0.3);
    expect(p).toHaveLength(4);
    const L = 6;
    expect(p[1]).toEqual([6, 0]);
    expect(p[2]).toEqual([6, 0.3]);
    expect(p[3][1]).toBeCloseTo(L * Math.tan(Math.PI / 6), 8);
    expect(isConvexProfile(p)).toBe(true);
  });

  it('Test 11: 楔形拼接面 — thin-end/thick-end 中心与法线', () => {
    // profile: (0,0)(6,0)(6,0.3)(0,H)
    const params = {
      profile: [[0, 0], [6, 0], [6, 0.3], [0, 3]] as [number, number][],
      thickness: 3,
    };
    const faces = getSpliceFaces('convexProfile', params);
    expect(faces).toHaveLength(2);
    const thin = faces.find((f) => f.faceId === 'thin-end')!;
    const thick = faces.find((f) => f.faceId === 'thick-end')!;
    // 薄端：边1 (6,0)→(6,0.3)，中心 (6,0.15)，法线 +x
    expect(thin.center[0]).toBeCloseTo(6, 8);
    expect(thin.center[1]).toBeCloseTo(0.15, 8);
    expect(thin.normal[0]).toBeCloseTo(1, 8);
    expect(thin.normal[1]).toBeCloseTo(0, 8);
    // 厚端：边3 (0,3)→(0,0)，中心 (0,1.5)，法线 -x
    expect(thick.center[0]).toBeCloseTo(0, 8);
    expect(thick.center[1]).toBeCloseTo(1.5, 8);
    expect(thick.normal[0]).toBeCloseTo(-1, 8);
  });

  it('Test 12: 平面拼楔形 — 180° 翻转绕 Y 轴且薄端贴合、正立不翻', () => {
    // 母版平面在原点，右端面 normal +x；新楔形薄端 normal +x → 反向 180°
    const masterFace = { center: [3, 2, 0] as [number, number, number], normal: [1, 0, 0] as [number, number, number] };
    const entry = getEntryFace('convexProfile', {
      profile: [[0, 0], [6, 0], [6, 0.3], [0, 3]] as [number, number][],
      thickness: 3,
    })!;
    const pose = computeSplicePose(masterFace, entry);
    // 薄端贴合：入口面心 (6,0.15,0) 经 R_y180 → (−6,0.15,0)；newPos = masterCenter − (−6,0.15,0) = (9,1.85,0)
    expect(pose.position[0]).toBeCloseTo(9, 6);
    expect(pose.position[1]).toBeCloseTo(1.85, 6);
    expect(pose.position[2]).toBeCloseTo(0, 6);
    // 正立验证：把旋转应用到 (0,1,0) 上向量，y 分量必须仍为正（楔形未底朝天）
    const e = new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ');
    const q = new THREE.Quaternion().setFromEuler(e);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    expect(up.y).toBeCloseTo(1, 6);
  });
});
