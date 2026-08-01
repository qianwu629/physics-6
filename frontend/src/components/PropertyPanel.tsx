import { useCallback, useEffect, memo } from 'react';
import { X } from 'lucide-react';
import { useSimulationStore } from '../store';
import { useChartDataStore } from '../store/chartDataStore';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { useDock } from './dock/DockApiContext';
import type {
  Entity,
  TransformComponent,
  RigidBodyComponent,
  ColliderComponent,
  VelocityComponent,
  MaterialComponent,
  ConstraintComponent,
  TrailComponent,
  VectorComponent,
  ColliderParams,
  ForceFieldComponent,
  ForceFieldKind,
  CurrentSourceComponent,
  FaceFriction,
} from '../ecs/types';
import { getShapeFaces } from '../ecs/faceGeometry';
import { DEFAULT_COLORS } from '../ecs/components/Material';

/** 7 preset color swatches for the color picker */
const COLOR_SWATCHES = [
  '#f4a261', // 珊瑚橙
  '#2a9d8f', // 薄荷绿
  '#457b9d', // 天空蓝
  '#9b5de5', // 淡紫
  '#e9c46a', // 柠檬黄
  '#e76f51', // 玫瑰粉
  '#fafafa', // 珍珠白（必须是具体 hex：该值会存入 ECS material.color 并随场景持久化，THREE.Color 无法解析 CSS 变量）
];

/** Shape display names in Chinese */
const SHAPE_LABELS: Record<string, string> = {
  sphere: '球体',
  cuboid: '方块',
  cylinder: '圆柱',
  convexProfile: '自定义凸形',
};

/** ForceField kind display names in Chinese (D-03-06) */
const FORCE_FIELD_KIND_LABELS: Record<ForceFieldKind, string> = {
  uniform: '均匀方向场',
  gravity: '点引力源',
  electric: '点电荷电场',
  magnetic: '均匀磁场',
};

// ── PhysicsField — 可编辑/只读切换 ──

interface PhysicsFieldProps {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

function PhysicsField({ label, value, unit, min, max, step, disabled, onChange }: PhysicsFieldProps) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        <span className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
          {value.toFixed(2)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label style={{ color: 'var(--muted-foreground)', fontSize: '14px' }}>{label}</Label>
      <div className="flex items-center gap-2">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          className="flex-1"
        />
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-20 text-sm font-mono"
          style={{
            backgroundColor: 'var(--well)',
            borderColor: 'var(--glass-border)',
            color: 'var(--foreground)',
            height: '32px',
          }}
        />
        {unit && <span className="text-xs" style={{ color: 'var(--muted-foreground)', minWidth: '32px' }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Vector3Field — 三轴输入 ──

interface Vector3FieldProps {
  label: string;
  value: [number, number, number];
  unit?: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (index: number, val: number) => void;
}

function Vector3Field({ label, value, unit, min, max, step, disabled, onChange }: Vector3FieldProps) {
  if (disabled) {
    return (
      <div className="space-y-1">
        <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        <div className="flex gap-3">
          {['X', 'Y', 'Z'].map((axis, i) => (
            <div key={axis} className="flex-1">
              <span className="block text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{axis}</span>
              <span className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
                {value[i]?.toFixed(2) ?? '0.00'}{unit ? ` ${unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label style={{ color: 'var(--muted-foreground)', fontSize: '14px' }}>{label}</Label>
      <div className="flex gap-2">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="flex-1">
            <span className="block text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>{axis}</span>
            <Input
              type="number"
              value={value[i] ?? 0}
              min={min}
              max={max}
              step={step}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!isNaN(v)) onChange(i, Math.max(min, Math.min(max, v)));
              }}
              className="w-full text-sm font-mono"
              style={{
                backgroundColor: 'var(--well)',
                borderColor: 'var(--glass-border)',
                color: 'var(--foreground)',
                height: '32px',
              }}
            />
          </div>
        ))}
        {unit && (
          <span className="text-xs self-end pb-1.5" style={{ color: 'var(--muted-foreground)', minWidth: '32px' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ── PropertyPanel ──

export default function PropertyPanel() {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const selectedEntityId = useSimulationStore((s) => s.selectedEntityId);
  const selectEntity = useSimulationStore((s) => s.selectEntity);
  const updateComponent = useSimulationStore((s) => s.updateComponent);
  const removeEntity = useSimulationStore((s) => s.removeEntity);
  const deleteDialogOpen = useSimulationStore((s) => s.deleteDialogOpen);
  const openDeleteDialog = useSimulationStore((s) => s.openDeleteDialog);
  const closeDeleteDialog = useSimulationStore((s) => s.closeDeleteDialog);
  const togglePropertyPanel = useSimulationStore((s) => s.togglePropertyPanel);
  const dock = useDock();
  const toggleTrailVisibility = useSimulationStore((s) => s.toggleTrailVisibility);
  const toggleVectorVisibility = useSimulationStore((s) => s.toggleVectorVisibility);
  const setCurrentSource = useSimulationStore((s) => s.setCurrentSource);

  // Phase 2: 图表追踪
  const trackedIds = useChartDataStore((s) => s.trackedEntityIds);
  const toggleTracking = useChartDataStore((s) => s.toggleTracking);

  const selectedEntity = useSimulationStore((s) => {
    const id = s.selectedEntityId;
    return id ? (s.entities.get(id) ?? null) : null;
  });

  // Keyboard shortcut: Delete/Backspace triggers delete confirmation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !selectedEntityId ||
        deleteDialogOpen ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        openDeleteDialog();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedEntityId, deleteDialogOpen, openDeleteDialog]);

  // Extract component data
  const transform = selectedEntity?.components.get('transform') as TransformComponent | undefined;
  const rigidBody = selectedEntity?.components.get('rigidBody') as RigidBodyComponent | undefined;
  const collider = selectedEntity?.components.get('collider') as ColliderComponent | undefined;
  const velocity = selectedEntity?.components.get('velocity') as VelocityComponent | undefined;
  const material = selectedEntity?.components.get('material') as MaterialComponent | undefined;
  const constraint = selectedEntity?.components.get('constraint') as ConstraintComponent | undefined;
  const trailComp = selectedEntity?.components.get('trail') as TrailComponent | undefined;
  const vectorComp = selectedEntity?.components.get('vector') as VectorComponent | undefined;
  const forceField = selectedEntity?.components.get('forceField') as ForceFieldComponent | undefined;
  const currentSource = selectedEntity?.components.get('currentSource') as CurrentSourceComponent | undefined;

  const isSpring = constraint?.kind === 'spring';
  const isJoint =
    constraint?.kind === 'fixed' ||
    constraint?.kind === 'revolute' ||
    constraint?.kind === 'spherical' ||
    constraint?.kind === 'rope';
  const isSplice = constraint?.kind === 'splice';
  const springParams = constraint?.kind === 'spring' ? constraint.params : null;
  const jointParams = isJoint ? constraint.params : null;
  const spliceParams = constraint?.kind === 'splice' ? constraint.params : null;
  const JOINT_KIND_LABELS: Record<string, string> = {
    fixed: '固定连接（刚性）',
    revolute: '铰链（绕轴旋转）',
    spherical: '球窝（全向旋转）',
    rope: '轻绳（只受拉）',
  };
  const jointKindLabel = constraint && isJoint ? JOINT_KIND_LABELS[constraint.kind] : '';
  const isForceField = !!forceField;
  // 斜面/倾斜固定板：cuboid + fixed + 纯 z 旋转（斜面工厂与工具箱斜面均为此形态）
  const isSlopeLike =
    collider?.shape === 'cuboid' &&
    rigidBody?.kind === 'fixed' &&
    !!transform &&
    transform.rotation[0] === 0 &&
    transform.rotation[1] === 0;

  // Resolve endpoint entity names for spring editor
  const entityAName = useSimulationStore((s) => {
    if (!constraint?.entityAId) return constraint?.entityAId ?? '?';
    return s.entities.get(constraint.entityAId)?.name ?? constraint.entityAId;
  });
  const entityBName = useSimulationStore((s) => {
    if (!constraint?.entityBId) return constraint?.entityBId ?? '?';
    return s.entities.get(constraint.entityBId)?.name ?? constraint.entityBId;
  });

  const disabled = isRunning;

  // Handlers
  const handlePositionChange = useCallback(
    (index: number, val: number) => {
      if (!selectedEntityId || !transform) return;
      const newPos: [number, number, number] = [...transform.position];
      newPos[index] = val;
      updateComponent(selectedEntityId, 'transform', { position: newPos });
    },
    [selectedEntityId, transform, updateComponent],
  );

  const handleVelocityChange = useCallback(
    (index: number, val: number) => {
      if (!selectedEntityId || !velocity) return;
      const newVel: [number, number, number] = [...velocity.linearVelocity];
      newVel[index] = val;
      updateComponent(selectedEntityId, 'velocity', { linearVelocity: newVel });
    },
    [selectedEntityId, velocity, updateComponent],
  );

  // 斜面倾角（度 → rad 写 transform.rotation.z；@react-three/rapier 会响应式同步到物理体）
  const handleSlopeAngleChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !transform) return;
      updateComponent(selectedEntityId, 'transform', {
        rotation: [transform.rotation[0], transform.rotation[1], (val * Math.PI) / 180],
      });
    },
    [selectedEntityId, transform, updateComponent],
  );

  // 圆弧/双弧轨道整体旋转（欧拉 XYZ，度 → rad；同斜面倾角的同步机制，形状不变仅整体转）
  const isArcTrack = collider?.shape === 'arc' || collider?.shape === 'doubleArc';
  const handleRotationChange = useCallback(
    (index: number, val: number) => {
      if (!selectedEntityId || !transform) return;
      const newRot: [number, number, number] = [...transform.rotation];
      newRot[index] = (val * Math.PI) / 180;
      updateComponent(selectedEntityId, 'transform', { rotation: newRot });
    },
    [selectedEntityId, transform, updateComponent],
  );

  const handleMassChange = useCallback(
    (val: number) => {
      if (!selectedEntityId) return;
      updateComponent(selectedEntityId, 'rigidBody', { mass: val });
    },
    [selectedEntityId, updateComponent],
  );

  const handleRestitutionChange = useCallback(
    (val: number) => {
      if (!selectedEntityId) return;
      updateComponent(selectedEntityId, 'rigidBody', { restitution: val });
    },
    [selectedEntityId, updateComponent],
  );

  const handleFrictionChange = useCallback(
    (val: number) => {
      if (!selectedEntityId) return;
      updateComponent(selectedEntityId, 'rigidBody', { friction: val });
    },
    [selectedEntityId, updateComponent],
  );

  // ── W3 面摩擦/固定 ──
  const handleEnablePerFace = useCallback(() => {
    if (!selectedEntityId || !collider) return;
    const mu = rigidBody?.friction ?? 0.3;
    const faces: FaceFriction[] = getShapeFaces(collider.shape, collider.params).map((d) => ({
      id: d.id,
      label: d.label,
      friction: mu,
      pinned: false,
    }));
    updateComponent(selectedEntityId, 'collider', { faces });
  }, [selectedEntityId, collider, rigidBody, updateComponent]);

  const handleDisablePerFace = useCallback(() => {
    if (!selectedEntityId) return;
    updateComponent(selectedEntityId, 'collider', { faces: undefined });
  }, [selectedEntityId, updateComponent]);

  const handleFaceChange = useCallback(
    (faceId: string, patch: Partial<FaceFriction>) => {
      if (!selectedEntityId || !collider?.faces) return;
      const faces = collider.faces.map((f) => (f.id === faceId ? { ...f, ...patch } : f));
      updateComponent(selectedEntityId, 'collider', { faces });
    },
    [selectedEntityId, collider, updateComponent],
  );

  // Phase 3 (03-03): charge 字段 (D-03-06)
  const handleChargeChange = useCallback(
    (val: number) => {
      if (!selectedEntityId) return;
      updateComponent(selectedEntityId, 'rigidBody', { charge: val });
    },
    [selectedEntityId, updateComponent],
  );

  // Phase 8: 电流源（实体等效为无限长直导线，产生环形磁场）
  const handleToggleCurrentSource = useCallback(
    (on: boolean) => {
      if (!selectedEntityId) return;
      setCurrentSource(selectedEntityId, on ? { magnitude: 10, direction: [0, 0, 1] } : null);
    },
    [selectedEntityId, setCurrentSource],
  );

  const handleCurrentMagnitudeChange = useCallback(
    (val: number) => {
      if (!selectedEntityId) return;
      updateComponent(selectedEntityId, 'currentSource', { magnitude: val });
    },
    [selectedEntityId, updateComponent],
  );

  const handleCurrentDirectionChange = useCallback(
    (index: number, val: number) => {
      if (!selectedEntityId || !currentSource) return;
      const newDir: [number, number, number] = [...currentSource.direction];
      newDir[index] = val;
      updateComponent(selectedEntityId, 'currentSource', { direction: newDir });
    },
    [selectedEntityId, currentSource, updateComponent],
  );

  const handleColliderParamChange = useCallback(
    (key: keyof ColliderParams, val: number) => {
      if (!selectedEntityId || !collider) return;
      updateComponent(selectedEntityId, 'collider', {
        params: { ...collider.params, [key]: val },
      });
    },
    [selectedEntityId, collider, updateComponent],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedEntityId) return;
      updateComponent(selectedEntityId, 'material', { color });
    },
    [selectedEntityId, updateComponent],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!selectedEntityId) return;
    removeEntity(selectedEntityId);
    closeDeleteDialog();
  }, [selectedEntityId, removeEntity, closeDeleteDialog]);

  // ── Spring property handlers ──
  const handleSpringStiffnessChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint || constraint.kind !== 'spring') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, stiffness: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  const handleSpringRestLengthChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint || constraint.kind !== 'spring') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, restLength: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  const handleSpringDampingChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint || constraint.kind !== 'spring') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, damping: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  // ── W4/W6 关节 handlers ──
  const handleFixedJointShowLinkChange = useCallback(
    (show: boolean) => {
      if (!selectedEntityId || !constraint || constraint.kind === 'spring') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, showLink: show },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  // ── W8 轻绳 handlers ──
  const handleRopeLengthChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint || constraint.kind !== 'rope') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, length: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  // ── P5 拼接损耗 handlers ──
  const handleSpliceLossTypeChange = useCallback(
    (t: 'value' | 'percent') => {
      if (!selectedEntityId || !constraint || constraint.kind !== 'splice') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, lossType: t },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  const handleSpliceLossChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint || constraint.kind !== 'splice') return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, loss: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  // ── Phase 3 (03-03): ForceField property handlers (D-03-06) ──
  const handleForceFieldRangeChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !forceField) return;
      updateComponent(selectedEntityId, 'forceField', { range: val });
    },
    [selectedEntityId, forceField, updateComponent],
  );

  const handleForceFieldStrengthChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !forceField) return;
      if (forceField.kind === 'uniform' || forceField.kind === 'gravity' || forceField.kind === 'magnetic') {
        updateComponent(selectedEntityId, 'forceField', { strength: val });
      }
    },
    [selectedEntityId, forceField, updateComponent],
  );

  const handleForceFieldChargeChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !forceField) return;
      if (forceField.kind === 'electric') {
        updateComponent(selectedEntityId, 'forceField', { charge: val });
      }
    },
    [selectedEntityId, forceField, updateComponent],
  );

  const handleForceFieldDecayChange = useCallback(
    (val: boolean) => {
      if (!selectedEntityId || !forceField) return;
      if (forceField.kind === 'gravity' || forceField.kind === 'electric') {
        updateComponent(selectedEntityId, 'forceField', { decay: val });
      }
    },
    [selectedEntityId, forceField, updateComponent],
  );

  const handleForceFieldDirectionChange = useCallback(
    (index: number, val: number) => {
      if (!selectedEntityId || !forceField) return;
      const current =
        forceField.kind === 'uniform' || forceField.kind === 'magnetic'
          ? forceField.direction
          : [0, 0, 0];
      const newDir: [number, number, number] = [current[0], current[1], current[2]];
      newDir[index] = val;
      updateComponent(selectedEntityId, 'forceField', { direction: newDir });
    },
    [selectedEntityId, forceField, updateComponent],
  );

  const handleForceFieldPositionChange = useCallback(
    (index: number, val: number) => {
      if (!selectedEntityId || !forceField) return;
      const newPos: [number, number, number] = [
        forceField.position[0],
        forceField.position[1],
        forceField.position[2],
      ];
      newPos[index] = val;
      // 同步更新 transform.position 和 forceField.position (ECS 双 source — D-03-01: 力场只读 transform.position 即可)
      updateComponent(selectedEntityId, 'forceField', { position: newPos });
      if (transform) {
        updateComponent(selectedEntityId, 'transform', { position: newPos });
      }
    },
    [selectedEntityId, forceField, transform, updateComponent],
  );

  // Panel border based on editable/readonly state：可编辑时全息青描边 + 发光
  const panelBorder = disabled
    ? '1px solid var(--glass-border)'
    : '1px solid var(--holo)';

  return (
    <>
      <div
        className="h-full w-full flex flex-col"
        style={{
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: panelBorder,
          boxShadow: disabled ? 'none' : 'var(--glow-sm)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 shrink-0"
          style={{ height: '40px', borderBottom: '1px solid var(--glass-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            实体属性
          </span>
          <button
            type="button"
            className="rounded hover:bg-white/5 transition-colors p-1"
            onClick={() => {
              selectEntity(null);
              // dock 内：关闭 dock 面板；dock 外（旧测试独立渲染）：回退 store toggle
              if (dock) dock.closePanel('property');
              else togglePropertyPanel();
            }}
            aria-label="关闭面板"
          >
            <X size={14} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto px-3 py-2 space-y-3"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#333 transparent',
          }}
        >
          {!selectedEntity ? (
            /* No entity selected — hint */
            <div className="text-sm text-center py-6" style={{ color: 'var(--text-dim)' }}>
              点击场景中的实体或从上方列表选择以编辑属性
            </div>
          ) : isForceField && forceField ? (
            /* ── ForceField Property Editor (D-03-06) ── */
            <>
              {/* Running banner */}
              {disabled && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs text-center bg-[var(--holo-a10)] text-[var(--holo)] border border-[var(--holo-a20)]">
                  运行中,请暂停后编辑
                </div>
              )}

              <div className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                当前选中: <span style={{ color: 'var(--holo)' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 力场类型 — 只读 */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>类型</span>
                <span className="text-sm font-mono" style={{ color: 'var(--foreground)' }}>
                  {FORCE_FIELD_KIND_LABELS[forceField.kind]}
                </span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 中心位置 */}
              <Vector3Field
                label="中心位置"
                value={forceField.position}
                unit="米"
                min={-100}
                max={100}
                step={0.1}
                disabled={disabled}
                onChange={handleForceFieldPositionChange}
              />

              <Separator className="bg-white/[0.06]" />

              {/* 作用范围 */}
              <PhysicsField
                label="作用范围"
                value={forceField.range}
                unit="米"
                min={0.1}
                max={100}
                step={0.1}
                disabled={disabled}
                onChange={handleForceFieldRangeChange}
              />

              <Separator className="bg-white/[0.06]" />

              {/* 类型专用参数 */}
              {forceField.kind === 'uniform' && (
                <>
                  <Vector3Field
                    label="方向向量"
                    value={forceField.direction}
                    min={-100}
                    max={100}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleForceFieldDirectionChange}
                  />
                  <PhysicsField
                    label="强度"
                    value={forceField.strength}
                    unit="N"
                    min={-1000}
                    max={1000}
                    step={1}
                    disabled={disabled}
                    onChange={handleForceFieldStrengthChange}
                  />
                </>
              )}

              {forceField.kind === 'gravity' && (
                <>
                  <PhysicsField
                    label="G·M 强度"
                    value={forceField.strength}
                    unit="N·m²"
                    min={0}
                    max={10000}
                    step={1}
                    disabled={disabled}
                    onChange={handleForceFieldStrengthChange}
                  />
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-[var(--muted-foreground)]">1/r² 衰减</label>
                    <Switch
                      checked={forceField.decay}
                      onCheckedChange={handleForceFieldDecayChange}
                      disabled={disabled}
                    />
                  </div>
                </>
              )}

              {forceField.kind === 'electric' && (
                <>
                  <PhysicsField
                    label="场源电荷"
                    value={forceField.charge}
                    unit="C"
                    min={-100}
                    max={100}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleForceFieldChargeChange}
                  />
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-[var(--muted-foreground)]">1/r² 衰减</label>
                    <Switch
                      checked={forceField.decay}
                      onCheckedChange={handleForceFieldDecayChange}
                      disabled={disabled}
                    />
                  </div>
                </>
              )}

              {forceField.kind === 'magnetic' && (
                <>
                  <Vector3Field
                    label="B 场方向"
                    value={forceField.direction}
                    min={-100}
                    max={100}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleForceFieldDirectionChange}
                  />
                  <PhysicsField
                    label="B 场强度"
                    value={forceField.strength}
                    unit="T"
                    min={0}
                    max={1000}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleForceFieldStrengthChange}
                  />
                </>
              )}

              <Separator className="bg-white/[0.06]" />

              {/* 删除按钮 */}
              <Button
                variant="destructive"
                className="w-full"
                size="default"
                onClick={openDeleteDialog}
                style={{ marginBottom: '8px' }}
              >
                删除力场
              </Button>
            </>
          ) : isSpring ? (
            /* ── Spring Property Editor ── */
            <>
              {/* Running banner */}
              {disabled && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs text-center bg-[var(--holo-a10)] text-[var(--holo)] border border-[var(--holo-a20)]">
                  运行中，请暂停后编辑
                </div>
              )}

              <div className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                当前选中: <span style={{ color: 'var(--holo)' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Endpoints */}
              <div className="space-y-1 py-1">
                <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>端点</div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-dim)' }}>A:</span>
                  <button
                    type="button"
                    className="text-[var(--holo)] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityAId && selectEntity(constraint.entityAId)}
                    disabled={disabled}
                  >
                    {entityAName}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-dim)' }}>B:</span>
                  <button
                    type="button"
                    className="text-[var(--holo)] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityBId && selectEntity(constraint.entityBId)}
                    disabled={disabled}
                  >
                    {entityBName}
                  </button>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Spring parameters */}
              <PhysicsField
                label="刚度"
                value={springParams?.stiffness ?? 100}
                unit="N/m"
                min={1}
                max={1000}
                step={1}
                disabled={disabled}
                onChange={handleSpringStiffnessChange}
              />
              <PhysicsField
                label="原长"
                value={springParams?.restLength ?? 2.0}
                unit="m"
                min={0.1}
                max={50}
                step={0.1}
                disabled={disabled}
                onChange={handleSpringRestLengthChange}
              />
              <PhysicsField
                label="阻尼"
                value={springParams?.damping ?? 0.1}
                unit="N·s/m"
                min={0}
                max={50}
                step={0.1}
                disabled={disabled}
                onChange={handleSpringDampingChange}
              />

              <Separator className="bg-white/[0.06]" />

              {/* 可视化开关 — Phase 4 */}
              <div className="pt-2 mt-2 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">显示轨迹</label>
                  <Switch
                    checked={trailComp?.visible ?? true}
                    onCheckedChange={(v) => toggleTrailVisibility(selectedEntity.id, v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">显示矢量</label>
                  <Switch
                    checked={vectorComp?.showVelocity ?? true}
                    onCheckedChange={(v) => toggleVectorVisibility(selectedEntity.id, v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">图表追踪</label>
                  <Switch
                    checked={trackedIds.has(selectedEntity.id)}
                    onCheckedChange={() => toggleTracking(selectedEntity.id)}
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 删除按钮 */}
              <Button
                variant="destructive"
                className="w-full"
                size="default"
                onClick={openDeleteDialog}
                style={{ marginBottom: '8px' }}
              >
                删除弹簧
              </Button>
            </>
          ) : isJoint ? (
            /* ── Joint Property Editor (W4/W6：固定/铰链/球窝) ── */
            <>
              {disabled && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs text-center bg-[var(--holo-a10)] text-[var(--holo)] border border-[var(--holo-a20)]">
                  运行中，请暂停后编辑
                </div>
              )}

              <div className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                当前选中: <span style={{ color: 'var(--holo)' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 类型 */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>类型</span>
                <span className="text-sm font-mono" style={{ color: 'var(--foreground)' }}>{jointKindLabel}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Endpoints */}
              <div className="space-y-1 py-1">
                <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>端点</div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-dim)' }}>A:</span>
                  <button
                    type="button"
                    className="text-[var(--holo)] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityAId && selectEntity(constraint.entityAId)}
                    disabled={disabled}
                  >
                    {entityAName}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-dim)' }}>B:</span>
                  <button
                    type="button"
                    className="text-[var(--holo)] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityBId && selectEntity(constraint.entityBId)}
                    disabled={disabled}
                  >
                    {entityBName}
                  </button>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 轻绳：绳长编辑 */}
              {constraint?.kind === 'rope' && (
                <>
                  <PhysicsField
                    label="绳长"
                    value={constraint.params.length}
                    unit="m"
                    min={0.1}
                    max={50}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleRopeLengthChange}
                  />
                  <Separator className="bg-white/[0.06]" />
                </>
              )}

              {/* 连接线开关 */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/60">显示连接线</label>
                <Switch
                  checked={jointParams?.showLink ?? true}
                  onCheckedChange={handleFixedJointShowLinkChange}
                  disabled={disabled}
                />
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 删除按钮 */}
              <Button
                variant="destructive"
                className="w-full"
                size="default"
                onClick={openDeleteDialog}
                style={{ marginBottom: '8px' }}
              >
                删除连接
              </Button>
            </>
          ) : isSplice ? (
            /* ── Splice Property Editor (P5 轨道拼接) ── */
            <>
              {disabled && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs text-center bg-[var(--holo-a10)] text-[var(--holo)] border border-[var(--holo-a20)]">
                  运行中，请暂停后编辑
                </div>
              )}

              <div className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                当前选中: <span style={{ color: 'var(--holo)' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 类型 */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>类型</span>
                <span className="text-sm font-mono" style={{ color: 'var(--foreground)' }}>轨道拼接</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Endpoints */}
              <div className="space-y-1 py-1">
                <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>端点</div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-dim)' }}>母版:</span>
                  <button
                    type="button"
                    className="text-[var(--holo)] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityAId && selectEntity(constraint.entityAId)}
                    disabled={disabled}
                  >
                    {entityAName}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-dim)' }}>拼接:</span>
                  <button
                    type="button"
                    className="text-[var(--holo)] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityBId && selectEntity(constraint.entityBId)}
                    disabled={disabled}
                  >
                    {entityBName}
                  </button>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 损耗类型 */}
              <div className="space-y-1.5">
                <span className="block text-sm" style={{ color: 'var(--muted-foreground)' }}>通过损耗</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['percent', 'value'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSpliceLossTypeChange(t)}
                      className="px-2 py-1 rounded-lg text-xs transition-all border"
                      style={{
                        borderColor: spliceParams?.lossType === t ? 'var(--holo)' : 'var(--glass-border)',
                        backgroundColor: spliceParams?.lossType === t ? 'var(--holo-a15)' : 'transparent',
                        color: spliceParams?.lossType === t ? 'var(--holo)' : 'var(--muted-foreground)',
                      }}
                    >
                      {t === 'percent' ? '百分比' : '数值'}
                    </button>
                  ))}
                </div>
                <PhysicsField
                  label="损耗量"
                  value={spliceParams?.loss ?? 0}
                  min={0}
                  max={spliceParams?.lossType === 'percent' ? 1 : 10}
                  step={spliceParams?.lossType === 'percent' ? 0.05 : 0.1}
                  disabled={disabled}
                  onChange={handleSpliceLossChange}
                />
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 删除按钮 */}
              <Button
                variant="destructive"
                className="w-full"
                size="default"
                onClick={openDeleteDialog}
                style={{ marginBottom: '8px' }}
              >
                删除拼接
              </Button>
            </>
          ) : (
            <>
              {/* Status badge */}
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="gap-1.5 text-xs"
                  style={{
                    borderColor: disabled ? 'var(--glass-border)' : 'rgba(255,255,255,0.2)',
                    color: disabled ? 'var(--text-dim)' : 'var(--foreground)',
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: disabled ? 'var(--text-dim)' : '#22c55e',
                    }}
                  />
                  {disabled ? '只读 — 暂停后可编辑' : '可编辑'}
                </Badge>
              </div>

              {/* Selected entity name */}
              <div className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                当前选中: <span style={{ color: 'var(--holo)' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 形状 (display only) */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>形状</span>
                <span className="text-sm font-mono" style={{ color: 'var(--foreground)' }}>
                  {SHAPE_LABELS[collider?.shape ?? 'sphere'] ?? collider?.shape ?? '未知'}
                </span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 位置 */}
              <Vector3Field
                label="位置"
                value={transform?.position ?? [0, 0, 0]}
                unit="米"
                min={-100}
                max={100}
                step={0.01}
                disabled={disabled}
                onChange={handlePositionChange}
              />

              {/* 倾角（斜面/倾斜固定板） */}
              {isSlopeLike && transform && (
                <>
                  <Separator className="bg-white/[0.06]" />
                  <PhysicsField
                    label="倾角"
                    value={Math.round((transform.rotation[2] * 180) / Math.PI)}
                    unit="°"
                    min={5}
                    max={60}
                    step={1}
                    disabled={disabled}
                    onChange={handleSlopeAngleChange}
                  />
                </>
              )}

              {/* 整体旋转（圆弧/双弧轨道）：欧拉 XYZ，空间旋转但形状不变 */}
              {isArcTrack && transform && (
                <>
                  <Separator className="bg-white/[0.06]" />
                  <Vector3Field
                    label="整体旋转"
                    value={[
                      Math.round((transform.rotation[0] * 180) / Math.PI),
                      Math.round((transform.rotation[1] * 180) / Math.PI),
                      Math.round((transform.rotation[2] * 180) / Math.PI),
                    ]}
                    unit="°"
                    min={-180}
                    max={180}
                    step={1}
                    disabled={disabled}
                    onChange={handleRotationChange}
                  />
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                    已拼接轨道的接缝检测盒不随旋转更新，建议先旋转再拼接
                  </p>
                </>
              )}

              <Separator className="bg-white/[0.06]" />

              {/* 尺寸 — dynamic based on shape */}
              <div>
                <span className="block text-sm mb-1.5" style={{ color: 'var(--muted-foreground)' }}>尺寸</span>
                {collider?.shape === 'sphere' && (
                  <PhysicsField
                    label="半径"
                    value={collider.params.radius ?? 1}
                    unit="米"
                    min={0.1}
                    max={10}
                    step={0.1}
                    disabled={disabled}
                    onChange={(v) => handleColliderParamChange('radius', v)}
                  />
                )}
                {collider?.shape === 'cuboid' && (
                  <div className="space-y-1.5">
                    <PhysicsField
                      label="半长"
                      value={collider.params.halfWidth ?? 1}
                      unit="米"
                      min={0.1}
                      max={10}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => handleColliderParamChange('halfWidth', v)}
                    />
                    <PhysicsField
                      label="半宽"
                      value={collider.params.halfDepth ?? 1}
                      unit="米"
                      min={0.1}
                      max={10}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => handleColliderParamChange('halfDepth', v)}
                    />
                    <PhysicsField
                      label="半高"
                      value={collider.params.halfHeight ?? 1}
                      unit="米"
                      min={0.1}
                      max={10}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => handleColliderParamChange('halfHeight', v)}
                    />
                  </div>
                )}
                {collider?.shape === 'cylinder' && (
                  <div className="space-y-1.5">
                    <PhysicsField
                      label="半高"
                      value={collider.params.halfHeight ?? 1}
                      unit="米"
                      min={0.1}
                      max={10}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => handleColliderParamChange('halfHeight', v)}
                    />
                    <PhysicsField
                      label="半径"
                      value={collider.params.radius ?? 1}
                      unit="米"
                      min={0.1}
                      max={10}
                      step={0.1}
                      disabled={disabled}
                      onChange={(v) => handleColliderParamChange('radius', v)}
                    />
                  </div>
                )}
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 物理参数 */}
              <div>
                <span className="block text-sm mb-1.5" style={{ color: 'var(--muted-foreground)' }}>物理参数</span>
                <div className="space-y-1.5">
                  <PhysicsField
                    label="质量"
                    value={rigidBody?.mass ?? 1}
                    unit="千克"
                    min={0.1}
                    max={100}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleMassChange}
                  />
                  <PhysicsField
                    label="弹性系数"
                    value={rigidBody?.restitution ?? 0.5}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={disabled}
                    onChange={handleRestitutionChange}
                  />
                  {!collider?.faces && (
                    <PhysicsField
                      label="摩擦系数"
                      value={rigidBody?.friction ?? 0.3}
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={disabled}
                      onChange={handleFrictionChange}
                    />
                  )}
                  <PhysicsField
                    label="电荷"
                    value={rigidBody?.charge ?? 0}
                    unit="C"
                    min={-10}
                    max={10}
                    step={0.1}
                    disabled={disabled}
                    onChange={handleChargeChange}
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 面摩擦与固定 — W3 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>面摩擦与固定</span>
                  {collider?.faces ? (
                    <button
                      type="button"
                      className="text-xs px-2 py-0.5 rounded hover:bg-[var(--holo-a15)] transition-colors"
                      style={{ color: 'var(--text-dim)' }}
                      onClick={handleDisablePerFace}
                      disabled={disabled}
                    >
                      恢复统一
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs px-2 py-0.5 rounded hover:bg-[var(--holo-a15)] transition-colors"
                      style={{ color: 'var(--holo)' }}
                      onClick={handleEnablePerFace}
                      disabled={disabled}
                    >
                      逐面设置
                    </button>
                  )}
                </div>
                {collider?.faces && (
                  <div className="space-y-1.5">
                    {collider.faces.map((face) =>
                      disabled ? (
                        <div key={face.id} className="flex items-center justify-between py-0.5">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{face.label}</span>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
                            {face.pinned ? '固定' : face.friction.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div key={face.id} className="flex items-center gap-2">
                          <span className="text-xs w-14 shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                            {face.label}
                          </span>
                          <Slider
                            value={[face.friction]}
                            min={0}
                            max={2}
                            step={0.05}
                            className="flex-1"
                            onValueChange={([v]) => handleFaceChange(face.id, { friction: v })}
                          />
                          <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-dim)' }}>
                            {face.friction.toFixed(2)}
                          </span>
                          <label
                            className="flex items-center gap-1 text-xs shrink-0 cursor-pointer"
                            style={{ color: face.pinned ? 'var(--holo)' : 'var(--muted-foreground)' }}
                            title="固定面：与其他物体接触时不发生相对滑动"
                          >
                            <input
                              type="checkbox"
                              checked={face.pinned}
                              onChange={(e) => handleFaceChange(face.id, { pinned: e.target.checked })}
                            />
                            固定
                          </label>
                        </div>
                      ),
                    )}
                  </div>
                )}
                {!collider?.faces && (
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    当前为统一摩擦（{rigidBody?.friction.toFixed(2) ?? '0.30'}）；开启逐面设置后可单独调整每个面的摩擦系数或固定某面。
                  </p>
                )}
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 初始速度 */}
              <Vector3Field
                label="初始速度"
                value={velocity?.linearVelocity ?? [0, 0, 0]}
                unit="米/秒"
                min={-50}
                max={50}
                step={0.01}
                disabled={disabled}
                onChange={handleVelocityChange}
              />

              <Separator className="bg-white/[0.06]" />

              {/* 电流源 — Phase 8：实体等效为无限长直导线，产生环形磁场使带电粒子绕转 */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>电流源（直导线）</span>
                  <Switch
                    checked={!!currentSource}
                    onCheckedChange={handleToggleCurrentSource}
                    disabled={disabled}
                  />
                </div>
                {currentSource && (
                  <div className="space-y-1.5 mt-1.5">
                    <PhysicsField
                      label="电流"
                      value={currentSource.magnitude}
                      unit="A"
                      min={-100}
                      max={100}
                      step={0.5}
                      disabled={disabled}
                      onChange={handleCurrentMagnitudeChange}
                    />
                    <Vector3Field
                      label="电流方向"
                      value={currentSource.direction}
                      min={-1}
                      max={1}
                      step={0.1}
                      disabled={disabled}
                      onChange={handleCurrentDirectionChange}
                    />
                  </div>
                )}
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 颜色 */}
              <div>
                <span className="block text-sm mb-1.5" style={{ color: 'var(--muted-foreground)' }}>颜色</span>
                {disabled ? (
                  <div className="flex items-center gap-2 py-1">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: material?.color ?? 'var(--muted-foreground)' }}
                    />
                    <span className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
                      {material?.color ?? 'var(--muted-foreground)'}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {COLOR_SWATCHES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        style={{
                          backgroundColor: color,
                          border: material?.color === color ? '2px solid var(--foreground)' : '2px solid transparent',
                          transform: material?.color === color ? 'scale(1.15)' : undefined,
                        }}
                        onClick={() => handleColorChange(color)}
                        aria-label={`选择颜色 ${color}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 可视化开关 — Phase 4 */}
              <div className="pt-2 mt-2 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">显示轨迹</label>
                  <Switch
                    checked={trailComp?.visible ?? true}
                    onCheckedChange={(v) => toggleTrailVisibility(selectedEntity.id, v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">显示矢量</label>
                  <Switch
                    checked={vectorComp?.showVelocity ?? true}
                    onCheckedChange={(v) => toggleVectorVisibility(selectedEntity.id, v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">图表追踪</label>
                  <Switch
                    checked={trackedIds.has(selectedEntity.id)}
                    onCheckedChange={() => toggleTracking(selectedEntity.id)}
                  />
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 删除按钮 */}
              <Button
                variant="destructive"
                className="w-full"
                size="default"
                onClick={openDeleteDialog}
                style={{ marginBottom: '8px' }}
              >
                删除实体
              </Button>
            </>
          )}
        </div>
      </div>

      <DeleteConfirmDialog entityName={selectedEntity?.name ?? '未知'} />
    </>
  );
}

// ── DeleteConfirmDialog — 独立 memoized 组件，隔离 radix-ui Dialog 重渲染 ──

interface DeleteConfirmDialogProps {
  entityName: string;
}

const DeleteConfirmDialog = memo(function DeleteConfirmDialog({
  entityName,
}: DeleteConfirmDialogProps) {
  const deleteDialogOpen = useSimulationStore((s) => s.deleteDialogOpen);
  const closeDeleteDialog = useSimulationStore((s) => s.closeDeleteDialog);
  const selectedEntityId = useSimulationStore((s) => s.selectedEntityId);
  const removeEntity = useSimulationStore((s) => s.removeEntity);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeDeleteDialog();
    },
    [closeDeleteDialog],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (selectedEntityId) removeEntity(selectedEntityId);
    closeDeleteDialog();
  }, [selectedEntityId, removeEntity, closeDeleteDialog]);

  if (!deleteDialogOpen) return null;

  return (
    <Dialog open={deleteDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除「{entityName}」吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeDeleteDialog}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleDeleteConfirm}>
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
