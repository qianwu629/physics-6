import { useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Circle, Square, Database, TriangleAlert } from 'lucide-react';
import { useSimulationStore } from '../store';
import { cn } from '../lib/utils';
import type { ShapeType } from '../store/uiSlice';
import { createSphereEntity, createBoxEntity, createCylinderEntity, createSlopeEntity } from '../ecs/Entity';
import { DEFAULT_COLORS } from '../ecs/components/Material';
import type { Entity } from '../ecs/types';

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
import { Slider } from './ui/slider';

// ── Zod Schema ──

export const creationSchema = z.object({
  shape: z.enum(['sphere', 'box', 'cylinder', 'slope']),

  // Sphere: radius > 0
  radius: z.number().positive('尺寸必须为正数').optional(),
  // Box: halfWidth, halfHeight, halfDepth all > 0
  halfWidth: z.number().positive('尺寸必须为正数').optional(),
  halfHeight: z.number().positive('尺寸必须为正数').optional(),
  halfDepth: z.number().positive('尺寸必须为正数').optional(),

  // Cylinder: halfHeight > 0, radius > 0
  cylinderRadius: z.number().positive('尺寸必须为正数').optional(),

  // Slope: halfWidth > 0, halfDepth > 0
  slopeHalfWidth: z.number().positive('尺寸必须为正数').optional(),
  slopeHalfDepth: z.number().positive('尺寸必须为正数').optional(),

  // Physics params (all shapes)
  mass: z.number().positive('质量必须大于 0').default(1.0),
  restitution: z.number().min(0, '弹性系数必须在 0 到 1 之间').max(1, '弹性系数必须在 0 到 1 之间').default(0.5),
  friction: z.number().min(0, '摩擦系数必须在 0 到 1 之间').max(1, '摩擦系数必须在 0 到 1 之间').default(0.3),

  // Velocity (optional, defaults to [0,0,0])
  velocityX: z.number().default(0),
  velocityY: z.number().default(0),
  velocityZ: z.number().default(0),

  // Color
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '无效颜色格式').default('#f4a261'),
});

export type CreationFormData = z.infer<typeof creationSchema>;

// ── Constants ──

const SHAPE_OPTIONS: { type: ShapeType; label: string; Icon: typeof Circle }[] = [
  { type: 'sphere', label: '球体', Icon: Circle },
  { type: 'box', label: '方块', Icon: Square },
  { type: 'cylinder', label: '圆柱', Icon: Database },
  { type: 'slope', label: '斜面', Icon: TriangleAlert },
];

const COLOR_PRESETS = [
  '#f4a261', // 珊瑚橙
  '#2a9d8f', // 薄荷绿
  '#457b9d', // 天空蓝
  '#9b5de5', // 淡紫
  '#e9c46a', // 柠檬黄
  '#e76f51', // 玫瑰粉
  '#e0e0e0', // 珍珠白
];

function getDefaultColor(shape: ShapeType): string {
  return DEFAULT_COLORS[shape] ?? '#f4a261';
}

function getDefaultFormValues(shape: ShapeType): CreationFormData {
  const base: CreationFormData = {
    shape,
    mass: 1.0,
    restitution: 0.5,
    friction: 0.3,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    color: getDefaultColor(shape),
  };

  switch (shape) {
    case 'sphere':
      base.radius = 1.0;
      break;
    case 'box':
      base.halfWidth = 1.0;
      base.halfHeight = 1.0;
      base.halfDepth = 1.0;
      break;
    case 'cylinder':
      base.cylinderRadius = 0.5;
      base.halfHeight = 1.0;
      break;
    case 'slope':
      base.slopeHalfWidth = 4.0;
      base.slopeHalfDepth = 2.0;
      break;
  }
  return base;
}

// ── Component ──

export default function CreationDialog() {
  const dialogOpen = useSimulationStore((s) => s.dialogOpen);
  const dialogDefaultShape = useSimulationStore((s) => s.dialogDefaultShape);
  const closeDialog = useSimulationStore((s) => s.closeDialog);
  const addEntity = useSimulationStore((s) => s.addEntity);

  const form = useForm<CreationFormData>({
    resolver: zodResolver(creationSchema),
    defaultValues: getDefaultFormValues(dialogDefaultShape),
  });

  const { watch, setValue, handleSubmit, formState, control, reset, setError } = form;
  const selectedShape = watch('shape');

  // Reset form each time dialog opens with the pre-selected shape
  useEffect(() => {
    if (dialogOpen) {
      reset(getDefaultFormValues(dialogDefaultShape));
    }
  }, [dialogOpen, dialogDefaultShape, reset]);

  // Shape selector handler — also resets size fields for the new shape
  const handleShapeSelect = useCallback(
    (shape: ShapeType) => {
      const defaults = getDefaultFormValues(shape);
      reset(defaults);
    },
    [reset],
  );

  // Confirm handler
  const onConfirm = useCallback(
    (data: CreationFormData) => {
      let entity: Entity;
      const velocity: [number, number, number] = [data.velocityX, data.velocityY, data.velocityZ];

      switch (data.shape) {
        case 'sphere':
          entity = createSphereEntity(
            data.radius!,
            data.mass,
            data.restitution,
            data.friction,
            data.color,
            velocity,
          );
          break;
        case 'box':
          entity = createBoxEntity(
            data.halfWidth!,
            data.halfHeight!,
            data.halfDepth!,
            data.mass,
            data.restitution,
            data.friction,
            data.color,
            velocity,
          );
          break;
        case 'cylinder':
          entity = createCylinderEntity(
            data.halfHeight!,
            data.cylinderRadius!,
            data.mass,
            data.restitution,
            data.friction,
            data.color,
            velocity,
          );
          break;
        case 'slope':
          entity = createSlopeEntity(
            data.slopeHalfWidth!,
            data.slopeHalfDepth!,
            data.friction,
            data.color,
          );
          break;
        default:
          return;
      }

      const success = addEntity(entity);
      if (!success) {
        setError('root', { message: '场景已达到最大实体数量 (50 个)' });
        return;
      }
      closeDialog();
    },
    [addEntity, closeDialog, setError],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeDialog();
      }
    },
    [closeDialog],
  );

  // ── Render helpers ──

  const renderSliderField = (
    name: keyof CreationFormData,
    label: string,
    min: number,
    max: number,
    step: number,
    unit?: string,
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">
            {label} ({typeof field.value === 'number' ? field.value.toFixed(2) : '0.00'}{unit ? ` ${unit}` : ''})
          </Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[field.value as number]}
              onValueChange={([v]) => field.onChange(v)}
              min={min}
              max={max}
              step={step}
              className="flex-1"
            />
            <Input
              type="number"
              value={field.value as number}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="w-20 h-8 text-sm font-mono text-center"
              style={{
                background: '#222',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fafafa',
              }}
            />
          </div>
        </div>
      )}
    />
  );

  const renderNumberField = (
    name: keyof CreationFormData,
    label: string,
    min = 0.1,
    step = 0.1,
    unit = '米',
  ) => (
    <div className="space-y-1.5">
      <Label className="text-sm text-[#a0a0a0]">{label}</Label>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
          <>
            <Input
              type="number"
              min={min}
              step={step}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
              placeholder={String(min)}
              className={cn('text-sm font-mono', fieldState.error && 'border-[#ef4444]')}
              style={{
                background: '#222',
                border: fieldState.error
                  ? '1px solid #ef4444'
                  : '1px solid rgba(255,255,255,0.1)',
                color: '#fafafa',
              }}
            />
            {fieldState.error && (
              <p className="text-xs text-[#ef4444] mt-0.5">{fieldState.error.message}</p>
            )}
          </>
        )}
      />
    </div>
  );

  const isFormValid = formState.isValid && Object.keys(formState.errors).length === 0;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[420px]"
        style={{
          background: 'rgba(26, 26, 26, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[#fafafa] text-lg">添加实体</DialogTitle>
          <DialogDescription className="text-[#888] text-xs">
            配置参数后点击确认添加，实体将出现在场景中心
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onConfirm)} className="flex flex-col gap-6">
          {/* Section 1: 形状选择器 */}
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">形状</Label>
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_OPTIONS.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  aria-label={label}
                  onClick={() => handleShapeSelect(type)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all duration-150',
                    'text-[#a0a0a0] hover:bg-[rgba(59,130,246,0.08)] hover:text-[#3b82f6]',
                    'active:scale-95',
                  )}
                  style={{
                    borderColor:
                      selectedShape === type
                        ? '#3b82f6'
                        : 'rgba(255, 255, 255, 0.08)',
                    backgroundColor:
                      selectedShape === type
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'transparent',
                    color: selectedShape === type ? '#3b82f6' : undefined,
                  }}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: 尺寸参数 (dynamic based on shape) */}
          <div className="space-y-3">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">尺寸参数</Label>

            {selectedShape === 'sphere' && (
              <>{renderNumberField('radius', '半径', 0.1, 0.1, '米')}</>
            )}

            {selectedShape === 'box' && (
              <div className="grid grid-cols-3 gap-2">
                {renderNumberField('halfWidth', '半尺寸 X', 0.1, 0.1, '米')}
                {renderNumberField('halfHeight', '半尺寸 Y', 0.1, 0.1, '米')}
                {renderNumberField('halfDepth', '半尺寸 Z', 0.1, 0.1, '米')}
              </div>
            )}

            {selectedShape === 'cylinder' && (
              <div className="grid grid-cols-2 gap-2">
                {renderNumberField('halfHeight', '半高', 0.1, 0.1, '米')}
                {renderNumberField('cylinderRadius', '半径', 0.1, 0.1, '米')}
              </div>
            )}

            {selectedShape === 'slope' && (
              <div className="grid grid-cols-2 gap-2">
                {renderNumberField('slopeHalfWidth', '半宽', 0.1, 0.1, '米')}
                {renderNumberField('slopeHalfDepth', '半深', 0.1, 0.1, '米')}
              </div>
            )}
          </div>

          {/* Section 3: 物理参数 */}
          <div className="space-y-3">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">物理参数</Label>
            {renderSliderField('mass', '质量', 0.1, 100, 0.1, 'kg')}
            {renderSliderField('restitution', '弹性系数', 0, 1, 0.01)}
            {renderSliderField('friction', '摩擦系数', 0, 1, 0.01)}
          </div>

          {/* Section 4: 初始速度 (可选) */}
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">
              初始速度（可选）
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Controller
                name="velocityX"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1">
                    <Label className="text-xs text-[#666]">X</Label>
                    <Input
                      type="number"
                      step={0.1}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="text-sm font-mono text-center"
                      style={{
                        background: '#222',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fafafa',
                      }}
                    />
                  </div>
                )}
              />
              <Controller
                name="velocityY"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1">
                    <Label className="text-xs text-[#666]">Y</Label>
                    <Input
                      type="number"
                      step={0.1}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="text-sm font-mono text-center"
                      style={{
                        background: '#222',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fafafa',
                      }}
                    />
                  </div>
                )}
              />
              <Controller
                name="velocityZ"
                control={control}
                render={({ field }) => (
                  <div className="space-y-1">
                    <Label className="text-xs text-[#666]">Z</Label>
                    <Input
                      type="number"
                      step={0.1}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="text-sm font-mono text-center"
                      style={{
                        background: '#222',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fafafa',
                      }}
                    />
                  </div>
                )}
              />
            </div>
          </div>

          {/* Section 5: 颜色 */}
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">颜色</Label>
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`选择颜色 ${color}`}
                      onClick={() => field.onChange(color)}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-all duration-150',
                        'hover:scale-110 active:scale-95',
                      )}
                      style={{
                        backgroundColor: color,
                        borderColor:
                          field.value === color
                            ? '#fafafa'
                            : 'rgba(255, 255, 255, 0.15)',
                        boxShadow:
                          field.value === color
                            ? `0 0 8px ${color}80`
                            : 'none',
                      }}
                    />
                  ))}
                </div>
              )}
            />
          </div>

          {/* Root error (MAX_ENTITIES) */}
          {formState.errors.root && (
            <p className="text-sm text-[#ef4444] text-center">
              {formState.errors.root.message}
            </p>
          )}

          {/* Button row */}
          <DialogFooter className="-mx-6 -mb-6 px-6 pb-6 pt-4 border-t border-[rgba(255,255,255,0.06)]">
            <Button
              type="button"
              variant="ghost"
              onClick={closeDialog}
              className="text-[#888] hover:text-[#a0a0a0]"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid}
              style={{
                backgroundColor: isFormValid ? '#3b82f6' : '#333',
                color: isFormValid ? '#ffffff' : '#666',
              }}
            >
              确认添加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
