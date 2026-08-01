import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useSimulationStore } from '../store';
import {
  createFixedJointEntity,
  createRevoluteJointEntity,
  createSphericalJointEntity,
  createSpringEntity,
  createRopeJointEntity,
  createRodLinkEntity,
  DEFAULT_SPRING_PARAMS,
} from '../ecs/Entity';
import { computeFixedJointParams, computeRevoluteParams, computeSphericalParams, midpoint, type Vec3Tuple } from '../ecs/jointCalc';
import type { TransformComponent } from '../ecs/types';
import { getLiveRigidBodyRef } from './RigidBodyRefContext';
import { MAX_ENTITIES } from '../store/entitySlice';

interface Pose {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
}

/**
 * 读取实体当前位姿：优先 Rapier 活体（仿真运行后的真实位置），
 * 回退 ECS store 初始位姿（实体尚未挂载/已卸载时）。
 * 关节锚点必须用活体位姿计算——store 的 transform 是初始值，仿真后不更新。
 */
function getLivePose(entityId: string): Pose | null {
  const rbRef = getLiveRigidBodyRef(entityId);
  if (rbRef?.current) {
    const t = rbRef.current.translation();
    const q = rbRef.current.rotation();
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w), 'XYZ');
    return { position: [t.x, t.y, t.z], rotation: [e.x, e.y, e.z] };
  }
  const t = useSimulationStore.getState().entities.get(entityId)?.components.get('transform') as TransformComponent | undefined;
  return t ? { position: [...t.position] as Vec3Tuple, rotation: [...t.rotation] as Vec3Tuple } : null;
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

type AnchorMode = 'midpoint' | 'centerA' | 'centerB';
type JointType = 'fixed' | 'revolute' | 'spherical' | 'spring' | 'rope' | 'rod';

const ANCHOR_OPTIONS: { mode: AnchorMode; label: string }[] = [
  { mode: 'midpoint', label: '自动中点' },
  { mode: 'centerA', label: 'A 中心' },
  { mode: 'centerB', label: 'B 中心' },
];

const JOINT_TYPE_OPTIONS: { type: JointType; label: string; hint: string }[] = [
  { type: 'fixed', label: '固定', hint: '相对位姿完全锁定（轨道组合）' },
  { type: 'revolute', label: '铰链', hint: '绕共享轴相对旋转（门/轮/摆）' },
  { type: 'spherical', label: '球窝', hint: '锚点重合，全向旋转（钟摆）' },
  { type: 'spring', label: '弹簧', hint: '弹性连接，可调刚度/原长/阻尼' },
  { type: 'rope', label: '轻绳', hint: '只受拉不可推，松弛下垂（最大距离约束）' },
  { type: 'rod', label: '轻杆', hint: '拉压双向的无质量刚性连杆' },
];

const AXIS_OPTIONS: { axis: Vec3Tuple; label: string }[] = [
  { axis: [1, 0,0], label: 'X 轴' },
  { axis: [0, 1, 0], label: 'Y 轴' },
  { axis: [0, 0, 1], label: 'Z 轴' },
];

/** 使用锚点选择的类型（其余默认两端体中心） */
const TYPES_WITH_ANCHOR_MODE: JointType[] = ['fixed', 'revolute', 'spherical'];

/**
 * FixedJointDialog — 连接设置对话框（W4 固定 / 二期铰链球窝 / W8 弹簧轻绳轻杆）
 *
 * 两个实体选定后弹出：连接类型 + 锚点模式（部分类型）+ 类型参数 + 连接线开关。
 */
export default function FixedJointDialog() {
  const open = useSimulationStore((s) => s.fixedJointDialogOpen);
  const closeDialog = useSimulationStore((s) => s.closeFixedJointDialog);
  const addEntity = useSimulationStore((s) => s.addEntity);

  const entityAId = useSimulationStore((s) => s.fixedJointEntityAId);
  const entityBId = useSimulationStore((s) => s.fixedJointEntityBId);

  const entityAName = useSimulationStore((s) =>
    entityAId ? (s.entities.get(entityAId)?.name ?? entityAId) : '未知',
  );
  const entityBName = useSimulationStore((s) =>
    entityBId ? (s.entities.get(entityBId)?.name ?? entityBId) : '未知',
  );

  const [anchorMode, setAnchorMode] = useState<AnchorMode>('midpoint');
  const [jointType, setJointType] = useState<JointType>('fixed');
  const [axis, setAxis] = useState<Vec3Tuple>([0, 1, 0]);
  const [showLink, setShowLink] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 弹簧参数
  const [stiffness, setStiffness] = useState(DEFAULT_SPRING_PARAMS.stiffness);
  const [restLength, setRestLength] = useState(DEFAULT_SPRING_PARAMS.restLength);
  const [damping, setDamping] = useState(DEFAULT_SPRING_PARAMS.damping);

  // 轻绳长度（默认 = 两端中心距）
  const [ropeLength, setRopeLength] = useState(0);

  // 打开时按当前两端距离初始化绳长（活体位姿）
  useEffect(() => {
    if (open && entityAId && entityBId) {
      const poseA = getLivePose(entityAId);
      const poseB = getLivePose(entityBId);
      if (poseA && poseB) {
        const d = Math.hypot(
          poseB.position[0] - poseA.position[0],
          poseB.position[1] - poseA.position[1],
          poseB.position[2] - poseA.position[2],
        );
        setRopeLength(Math.round(d * 100) / 100);
      }
      setError(null);
    }
  }, [open, entityAId, entityBId]);

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) closeDialog();
    },
    [closeDialog],
  );

  const handleConfirm = useCallback(() => {
    if (!entityAId || !entityBId) return;
    const entities = useSimulationStore.getState().entities;
    // 活体位姿（仿真后位置正确）；锚点计算严禁使用 store 初始位姿
    const poseA = getLivePose(entityAId);
    const poseB = getLivePose(entityBId);
    if (!poseA || !poseB) {
      setError('无法读取两端实体的位置信息');
      return;
    }

    // 轻杆一次创建 3 个实体（连杆 + 2 球窝），先校验容量
    const need = jointType === 'rod' ? 3 : 1;
    if (entities.size + need > MAX_ENTITIES) {
      setError(`场景实体数量上限 (${MAX_ENTITIES}) 不足，无法创建`);
      return;
    }

    const worldAnchor: Vec3Tuple =
      anchorMode === 'centerA' ? poseA.position : anchorMode === 'centerB' ? poseB.position : midpoint(poseA.position, poseB.position);

    const toAdd = [];
    if (jointType === 'revolute') {
      const params = computeRevoluteParams(poseA.position, poseA.rotation, poseB.position, poseB.rotation, worldAnchor, axis);
      toAdd.push(createRevoluteJointEntity(entityAId, entityBId, { ...params, showLink }));
    } else if (jointType === 'spherical') {
      const params = computeSphericalParams(poseA.position, poseA.rotation, poseB.position, poseB.rotation, worldAnchor);
      toAdd.push(createSphericalJointEntity(entityAId, entityBId, { ...params, showLink }));
    } else if (jointType === 'spring') {
      toAdd.push(
        createSpringEntity(entityAId, entityBId, { stiffness, restLength, damping }),
      );
    } else if (jointType === 'rope') {
      toAdd.push(
        createRopeJointEntity(entityAId, entityBId, {
          anchorA: [0, 0, 0],
          anchorB: [0, 0, 0],
          length: ropeLength,
          showLink,
        }),
      );
    } else if (jointType === 'rod') {
      const dist = Math.hypot(
        poseB.position[0] - poseA.position[0],
        poseB.position[1] - poseA.position[1],
        poseB.position[2] - poseA.position[2],
      );
      if (dist < 0.1) {
        setError('两端实体太近，无法创建轻杆');
        return;
      }
      const center = midpoint(poseA.position, poseB.position);
      const dir = new THREE.Vector3(
        (poseB.position[0] - poseA.position[0]) / dist,
        (poseB.position[1] - poseA.position[1]) / dist,
        (poseB.position[2] - poseA.position[2]) / dist,
      );
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
      const rod = createRodLinkEntity(center, [euler.x, euler.y, euler.z], dist);
      // 杆轴 = 局部 +Y 指向 B：A 端 [0,-L/2,0]，B 端 [0,+L/2,0]
      toAdd.push(
        rod,
        createSphericalJointEntity(entityAId, rod.id, {
          anchorA: [0, 0, 0],
          anchorB: [0, -dist / 2, 0],
          showLink: false,
        }),
        createSphericalJointEntity(rod.id, entityBId, {
          anchorA: [0, dist / 2, 0],
          anchorB: [0, 0, 0],
          showLink: false,
        }),
      );
    } else {
      const params = computeFixedJointParams(poseA.position, poseA.rotation, poseB.position, poseB.rotation, worldAnchor);
      toAdd.push(createFixedJointEntity(entityAId, entityBId, { ...params, showLink }));
    }

    for (const e of toAdd) {
      if (!addEntity(e)) {
        setError('场景已达到最大实体数量');
        return;
      }
    }
    setError(null);
    closeDialog();
  }, [entityAId, entityBId, anchorMode, jointType, axis, showLink, stiffness, restLength, damping, ropeLength, addEntity, closeDialog]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)] text-lg">连接设置</DialogTitle>
          <DialogDescription className="text-[var(--muted-foreground)] text-xs">
            将「{entityAName}」与「{entityBName}」连接：{JOINT_TYPE_OPTIONS.find((o) => o.type === jointType)?.hint}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 连接类型 */}
          <div className="space-y-2">
            <Label className="text-sm text-[var(--muted-foreground)] font-semibold tracking-wider uppercase">
              连接类型
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {JOINT_TYPE_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setJointType(type)}
                  className="px-2 py-1.5 rounded-lg text-xs transition-all border"
                  style={{
                    borderColor: jointType === type ? 'var(--holo)' : 'var(--glass-border)',
                    backgroundColor: jointType === type ? 'var(--holo-a15)' : 'transparent',
                    color: jointType === type ? 'var(--holo)' : 'var(--muted-foreground)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 铰链轴（仅铰链） */}
          {jointType === 'revolute' && (
            <div className="space-y-2">
              <Label className="text-sm text-[var(--muted-foreground)] font-semibold tracking-wider uppercase">
                铰链轴（世界方向）
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {AXIS_OPTIONS.map(({ axis: a, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAxis(a)}
                    className="px-2 py-1.5 rounded-lg text-xs transition-all border"
                    style={{
                      borderColor: axis === a ? 'var(--holo)' : 'var(--glass-border)',
                      backgroundColor: axis === a ? 'var(--holo-a15)' : 'transparent',
                      color: axis === a ? 'var(--holo)' : 'var(--muted-foreground)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 锚点模式（固定/铰链/球窝） */}
          {TYPES_WITH_ANCHOR_MODE.includes(jointType) && (
            <div className="space-y-2">
              <Label className="text-sm text-[var(--muted-foreground)] font-semibold tracking-wider uppercase">
                连接锚点
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {ANCHOR_OPTIONS.map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAnchorMode(mode)}
                    className="px-2 py-1.5 rounded-lg text-xs transition-all border"
                    style={{
                      borderColor: anchorMode === mode ? 'var(--holo)' : 'var(--glass-border)',
                      backgroundColor: anchorMode === mode ? 'var(--holo-a15)' : 'transparent',
                      color: anchorMode === mode ? 'var(--holo)' : 'var(--muted-foreground)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 弹簧参数 */}
          {jointType === 'spring' && (
            <div className="space-y-2">
              <Label className="text-sm text-[var(--muted-foreground)] font-semibold tracking-wider uppercase">
                弹簧参数
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['刚度', stiffness, setStiffness, 'N/m'],
                  ['原长', restLength, setRestLength, 'm'],
                  ['阻尼', damping, setDamping, ''],
                ] as const).map(([label, val, setter, unit]) => (
                  <div key={label} className="space-y-1">
                    <span className="text-xs text-[var(--text-dim)]">
                      {label}{unit ? ` (${unit})` : ''}
                    </span>
                    <Input
                      type="number"
                      step={label === '原长' ? 0.1 : 1}
                      min={0}
                      value={val}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v)) setter(v);
                      }}
                      className="text-sm font-mono text-center"
                      style={{ background: 'var(--well)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 轻绳长度 */}
          {jointType === 'rope' && (
            <div className="space-y-2">
              <Label className="text-sm text-[var(--muted-foreground)] font-semibold tracking-wider uppercase">
                绳长（默认 = 两端中心距）
              </Label>
              <Input
                type="number"
                step={0.1}
                min={0.1}
                value={ropeLength}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!isNaN(v)) setRopeLength(v);
                }}
                className="text-sm font-mono text-center"
                style={{ background: 'var(--well)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
              />
            </div>
          )}

          {/* 轻杆说明 */}
          {jointType === 'rod' && (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              将在两端中心之间创建一根刚性轻杆（杆长 = 两端中心距，两端球窝铰接）。
            </p>
          )}

          {/* 连接线开关（杆/弹簧不显示——杆身即视觉、弹簧有螺旋线） */}
          {jointType !== 'rod' && jointType !== 'spring' && (
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[var(--muted-foreground)]">显示连接线</Label>
              <input
                type="checkbox"
                checked={showLink}
                onChange={(e) => setShowLink(e.target.checked)}
              />
            </div>
          )}

          {error && <p className="text-sm text-[var(--destructive)] text-center">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={closeDialog} className="text-[var(--muted-foreground)]">
            取消
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            style={{ backgroundColor: 'var(--holo)', color: 'var(--primary-foreground)' }}
          >
            确认连接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
