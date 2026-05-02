import { useCallback, useEffect, memo } from 'react';
import { X } from 'lucide-react';
import { useSimulationStore } from '../store';
import { Button } from './ui/button';
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
import EntityList from './EntityList';
import type {
  Entity,
  TransformComponent,
  RigidBodyComponent,
  ColliderComponent,
  VelocityComponent,
  MaterialComponent,
  ConstraintComponent,
  ColliderParams,
} from '../ecs/types';
import { DEFAULT_COLORS } from '../ecs/components/Material';

/** 7 preset color swatches for the color picker */
const COLOR_SWATCHES = [
  '#f4a261', // 珊瑚橙
  '#2a9d8f', // 薄荷绿
  '#457b9d', // 天空蓝
  '#9b5de5', // 淡紫
  '#e9c46a', // 柠檬黄
  '#e76f51', // 玫瑰粉
  '#e0e0e0', // 珍珠白
];

/** Shape display names in Chinese */
const SHAPE_LABELS: Record<string, string> = {
  sphere: '球体',
  cuboid: '方块',
  cylinder: '圆柱',
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
        <span className="text-sm" style={{ color: '#a0a0a0' }}>{label}</span>
        <span className="text-sm font-mono" style={{ color: '#666' }}>
          {value.toFixed(2)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label style={{ color: '#a0a0a0', fontSize: '14px' }}>{label}</Label>
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
            backgroundColor: '#222',
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#fff',
            height: '32px',
          }}
        />
        {unit && <span className="text-xs" style={{ color: '#888', minWidth: '32px' }}>{unit}</span>}
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
        <span className="text-sm" style={{ color: '#a0a0a0' }}>{label}</span>
        <div className="flex gap-3">
          {['X', 'Y', 'Z'].map((axis, i) => (
            <div key={axis} className="flex-1">
              <span className="block text-xs mb-0.5" style={{ color: '#666' }}>{axis}</span>
              <span className="text-sm font-mono" style={{ color: '#666' }}>
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
      <Label style={{ color: '#a0a0a0', fontSize: '14px' }}>{label}</Label>
      <div className="flex gap-2">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <div key={axis} className="flex-1">
            <span className="block text-xs mb-1" style={{ color: '#888' }}>{axis}</span>
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
                backgroundColor: '#222',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                height: '32px',
              }}
            />
          </div>
        ))}
        {unit && (
          <span className="text-xs self-end pb-1.5" style={{ color: '#888', minWidth: '32px' }}>
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

  const isSpring = !!constraint;

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
      if (!selectedEntityId || !constraint) return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, stiffness: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  const handleSpringRestLengthChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint) return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, restLength: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  const handleSpringDampingChange = useCallback(
    (val: number) => {
      if (!selectedEntityId || !constraint) return;
      updateComponent(selectedEntityId, 'constraint', {
        params: { ...constraint.params, damping: val },
      });
    },
    [selectedEntityId, constraint, updateComponent],
  );

  // Panel border based on editable/readonly state
  const panelBorder = disabled
    ? '1px solid rgba(255, 255, 255, 0.06)'
    : '1px solid rgba(255, 255, 255, 0.12)';

  return (
    <>
      <div
        className="fixed z-40 rounded-xl flex flex-col"
        style={{
          right: '16px',
          top: '80px',
          bottom: '16px',
          width: '280px',
          backgroundColor: 'rgba(26, 26, 26, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: panelBorder,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 shrink-0"
          style={{ height: '40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#e0e0e0' }}>
            实体属性
          </span>
          <button
            type="button"
            className="rounded hover:bg-white/5 transition-colors p-1"
            onClick={() => {
              selectEntity(null);
              togglePropertyPanel();
            }}
            aria-label="关闭面板"
          >
            <X size={14} style={{ color: '#a0a0a0' }} />
          </button>
        </div>

        {/* Entity List */}
        <div className="shrink-0">
          <EntityList />
        </div>

        <div className="px-3 shrink-0">
          <Separator className="bg-white/[0.06]" />
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
            <div className="text-sm text-center py-6" style={{ color: '#666' }}>
              点击场景中的实体或从上方列表选择以编辑属性
            </div>
          ) : isSpring ? (
            /* ── Spring Property Editor ── */
            <>
              {/* Running banner */}
              {disabled && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs text-center bg-[rgba(59,130,246,0.1)] text-[#3b82f6] border border-[rgba(59,130,246,0.2)]">
                  运行中，请暂停后编辑
                </div>
              )}

              <div className="text-sm text-center" style={{ color: '#a0a0a0' }}>
                当前选中: <span style={{ color: '#3b82f6' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Endpoints */}
              <div className="space-y-1 py-1">
                <div className="text-xs font-medium" style={{ color: '#a0a0a0' }}>端点</div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: '#666' }}>A:</span>
                  <button
                    type="button"
                    className="text-[#3b82f6] hover:underline truncate ml-2"
                    onClick={() => constraint?.entityAId && selectEntity(constraint.entityAId)}
                    disabled={disabled}
                  >
                    {entityAName}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: '#666' }}>B:</span>
                  <button
                    type="button"
                    className="text-[#3b82f6] hover:underline truncate ml-2"
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
                value={constraint?.params.stiffness ?? 100}
                unit="N/m"
                min={1}
                max={1000}
                step={1}
                disabled={disabled}
                onChange={handleSpringStiffnessChange}
              />
              <PhysicsField
                label="原长"
                value={constraint?.params.restLength ?? 2.0}
                unit="m"
                min={0.1}
                max={50}
                step={0.1}
                disabled={disabled}
                onChange={handleSpringRestLengthChange}
              />
              <PhysicsField
                label="阻尼"
                value={constraint?.params.damping ?? 0.1}
                unit="N·s/m"
                min={0}
                max={50}
                step={0.1}
                disabled={disabled}
                onChange={handleSpringDampingChange}
              />

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
          ) : (
            <>
              {/* Status badge */}
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="gap-1.5 text-xs"
                  style={{
                    borderColor: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)',
                    color: disabled ? '#666' : '#e0e0e0',
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: disabled ? '#666' : '#22c55e',
                    }}
                  />
                  {disabled ? '只读 — 暂停后可编辑' : '可编辑'}
                </Badge>
              </div>

              {/* Selected entity name */}
              <div className="text-sm text-center" style={{ color: '#a0a0a0' }}>
                当前选中: <span style={{ color: '#3b82f6' }}>{selectedEntity.name}</span>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* 形状 (display only) */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: '#a0a0a0' }}>形状</span>
                <span className="text-sm font-mono" style={{ color: '#e0e0e0' }}>
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

              <Separator className="bg-white/[0.06]" />

              {/* 尺寸 — dynamic based on shape */}
              <div>
                <span className="block text-sm mb-1.5" style={{ color: '#a0a0a0' }}>尺寸</span>
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
                <span className="block text-sm mb-1.5" style={{ color: '#a0a0a0' }}>物理参数</span>
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
                  <PhysicsField
                    label="摩擦系数"
                    value={rigidBody?.friction ?? 0.3}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={disabled}
                    onChange={handleFrictionChange}
                  />
                </div>
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

              {/* 颜色 */}
              <div>
                <span className="block text-sm mb-1.5" style={{ color: '#a0a0a0' }}>颜色</span>
                {disabled ? (
                  <div className="flex items-center gap-2 py-1">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: material?.color ?? '#888' }}
                    />
                    <span className="text-sm font-mono" style={{ color: '#666' }}>
                      {material?.color ?? '#888'}
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
                          border: material?.color === color ? '2px solid #fff' : '2px solid transparent',
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
