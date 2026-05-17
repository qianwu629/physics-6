import { useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowUp, Crosshair, Zap, Magnet } from 'lucide-react';
import { useSimulationStore } from '../store';
import { cn } from '../lib/utils';
import { createForceFieldEntity } from '../ecs/Entity';
import type { ForceFieldKind } from '../ecs/types';

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
import { Switch } from './ui/switch';

// ── Zod Schema (D-03-04: discriminated union) ──

const positionTuple = z.tuple([z.number(), z.number(), z.number()]);
const directionTuple = z.tuple([z.number(), z.number(), z.number()]);

const uniformSchema = z.object({
  kind: z.literal('uniform'),
  position: positionTuple,
  range: z.number().min(0.1, '范围最小 0.1').max(100, '范围最大 100'),
  direction: directionTuple,
  strength: z.number().min(-1000, '强度最小 -1000').max(1000, '强度最大 1000'),
});

const gravitySchema = z.object({
  kind: z.literal('gravity'),
  position: positionTuple,
  range: z.number().min(0.1).max(100),
  strength: z.number().min(0, '强度必须 ≥ 0').max(10000, '强度最大 10000'),
  decay: z.boolean(),
});

const electricSchema = z.object({
  kind: z.literal('electric'),
  position: positionTuple,
  range: z.number().min(0.1).max(100),
  charge: z.number().min(-100, '电荷最小 -100').max(100, '电荷最大 100'),
  decay: z.boolean(),
});

const magneticSchema = z.object({
  kind: z.literal('magnetic'),
  position: positionTuple,
  range: z.number().min(0.1).max(100),
  direction: directionTuple,
  strength: z.number().min(0, '强度必须 ≥ 0').max(1000, '强度最大 1000'),
});

export const forceFieldSchema = z.discriminatedUnion('kind', [
  uniformSchema,
  gravitySchema,
  electricSchema,
  magneticSchema,
]);

export type ForceFieldFormData = z.infer<typeof forceFieldSchema>;

// ── Defaults per kind ──

function getDefaultFormValues(kind: ForceFieldKind): ForceFieldFormData {
  const basePos: [number, number, number] = [0, 5, 0];
  switch (kind) {
    case 'uniform':
      return {
        kind: 'uniform',
        position: basePos,
        range: 10,
        direction: [0, 1, 0],
        strength: 10,
      };
    case 'gravity':
      return {
        kind: 'gravity',
        position: basePos,
        range: 10,
        strength: 100,
        decay: true,
      };
    case 'electric':
      return {
        kind: 'electric',
        position: basePos,
        range: 10,
        charge: 1,
        decay: true,
      };
    case 'magnetic':
      return {
        kind: 'magnetic',
        position: basePos,
        range: 10,
        direction: [0, 0, 1],
        strength: 1,
      };
  }
}

const KIND_OPTIONS: { kind: ForceFieldKind; label: string; Icon: typeof ArrowUp }[] = [
  { kind: 'uniform', label: '均匀方向场', Icon: ArrowUp },
  { kind: 'gravity', label: '点引力源', Icon: Crosshair },
  { kind: 'electric', label: '点电荷电场', Icon: Zap },
  { kind: 'magnetic', label: '均匀磁场', Icon: Magnet },
];

// ── Component ──

export default function ForceFieldDialog() {
  const dialogOpen = useSimulationStore((s) => s.forceFieldDialogOpen);
  const dialogKind = useSimulationStore((s) => s.forceFieldDialogKind);
  const closeDialog = useSimulationStore((s) => s.closeForceFieldDialog);
  const addEntity = useSimulationStore((s) => s.addEntity);

  // Resolve current kind (fallback to 'uniform' when dialog closed / kind=null)
  const currentKind: ForceFieldKind = dialogKind ?? 'uniform';

  const form = useForm<ForceFieldFormData>({
    resolver: zodResolver(forceFieldSchema),
    defaultValues: getDefaultFormValues(currentKind),
    mode: 'onChange',
  });

  const { watch, handleSubmit: rhfHandleSubmit, formState, control, reset, setError } = form;
  const selectedKind = watch('kind');

  // Reset form whenever dialog opens or pre-selected kind changes
  useEffect(() => {
    if (dialogOpen && dialogKind) {
      reset(getDefaultFormValues(dialogKind));
    }
  }, [dialogOpen, dialogKind, reset]);

  // Kind selector handler — reset form with new defaults
  const handleKindSelect = useCallback(
    (kind: ForceFieldKind) => {
      reset(getDefaultFormValues(kind));
    },
    [reset],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeDialog();
    },
    [closeDialog],
  );

  const handleConfirm = useCallback(
    (data: ForceFieldFormData) => {
      let entity;
      switch (data.kind) {
        case 'uniform':
          entity = createForceFieldEntity('uniform', data.position, data.range, {
            direction: data.direction,
            strength: data.strength,
          });
          break;
        case 'gravity':
          entity = createForceFieldEntity('gravity', data.position, data.range, {
            strength: data.strength,
            decay: data.decay,
          });
          break;
        case 'electric':
          entity = createForceFieldEntity('electric', data.position, data.range, {
            charge: data.charge,
            decay: data.decay,
          });
          break;
        case 'magnetic':
          entity = createForceFieldEntity('magnetic', data.position, data.range, {
            direction: data.direction,
            strength: data.strength,
          });
          break;
      }

      const success = addEntity(entity);
      if (!success) {
        setError('root', { message: '场景已达到最大实体数量 (50 个)' });
        return;
      }
      closeDialog();
      reset(getDefaultFormValues(data.kind));
    },
    [addEntity, closeDialog, setError, reset],
  );

  // ── Render helpers ──

  const renderSliderField = (
    name: 'range' | 'strength' | 'charge',
    label: string,
    min: number,
    max: number,
    step: number,
    unit?: string,
  ) => (
    <Controller
      name={name as never}
      control={control}
      render={({ field }) => {
        const numericValue = typeof field.value === 'number' ? field.value : 0;
        return (
          <div className="space-y-1.5">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">
              {label} ({numericValue.toFixed(2)}{unit ? ` ${unit}` : ''})
            </Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[numericValue]}
                onValueChange={([v]) => field.onChange(v)}
                min={min}
                max={max}
                step={step}
                className="flex-1"
              />
              <Input
                type="number"
                value={numericValue}
                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-20 h-8 text-sm font-mono text-center"
                style={{
                  background: '#222',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fafafa',
                }}
              />
            </div>
          </div>
        );
      }}
    />
  );

  const renderVector3Field = (
    name: 'position' | 'direction',
    label: string,
  ) => (
    <div className="space-y-2">
      <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <Controller
            key={axis}
            name={`${name}.${i}` as never}
            control={control}
            render={({ field }) => (
              <div className="space-y-1">
                <Label className="text-xs text-[#666]">{axis}</Label>
                <Input
                  type="number"
                  step={0.1}
                  value={(field.value as number) ?? 0}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                  }
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
        ))}
      </div>
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
          <DialogTitle className="text-[#fafafa] text-lg">创建力场</DialogTitle>
          <DialogDescription className="text-[#888] text-xs">
            选择力场类型并配置参数，确认后将在场景中创建力场实体
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={rhfHandleSubmit(handleConfirm)} className="flex flex-col gap-6">
          {/* Section 1: 力场类型选择器 */}
          <div className="space-y-2">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">
              力场类型
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {KIND_OPTIONS.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  aria-label={label}
                  onClick={() => handleKindSelect(kind)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all duration-150',
                    'text-[#a0a0a0] hover:bg-[rgba(59,130,246,0.08)] hover:text-[#3b82f6]',
                    'active:scale-95',
                  )}
                  style={{
                    borderColor:
                      selectedKind === kind ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                    backgroundColor:
                      selectedKind === kind ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: selectedKind === kind ? '#3b82f6' : undefined,
                  }}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="text-[10px] leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: 通用参数 — 位置 + 范围 */}
          <div className="space-y-3">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">
              通用参数
            </Label>
            {renderVector3Field('position', '中心位置')}
            {renderSliderField('range', '作用范围', 0.1, 100, 0.1, '米')}
          </div>

          {/* Section 3: 类型专用参数 */}
          <div className="space-y-3">
            <Label className="text-sm text-[#a0a0a0] font-semibold tracking-wider uppercase">
              类型参数
            </Label>

            {selectedKind === 'uniform' && (
              <>
                {renderVector3Field('direction', '方向向量')}
                {renderSliderField('strength', '强度', -1000, 1000, 1, 'N')}
              </>
            )}

            {selectedKind === 'gravity' && (
              <>
                {renderSliderField('strength', 'G·M 强度', 0, 10000, 1, 'N·m²')}
                <Controller
                  name="decay"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-[#a0a0a0]">1/r² 衰减</Label>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(v) => field.onChange(v)}
                      />
                    </div>
                  )}
                />
              </>
            )}

            {selectedKind === 'electric' && (
              <>
                {renderSliderField('charge', '场源电荷', -100, 100, 0.1, 'C')}
                <Controller
                  name="decay"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-[#a0a0a0]">1/r² 衰减</Label>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(v) => field.onChange(v)}
                      />
                    </div>
                  )}
                />
              </>
            )}

            {selectedKind === 'magnetic' && (
              <>
                {renderVector3Field('direction', 'B 场方向')}
                {renderSliderField('strength', 'B 场强度', 0, 1000, 0.1, 'T')}
              </>
            )}
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
              确认创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
