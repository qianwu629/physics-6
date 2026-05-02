import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSimulationStore } from '../store';
import { createSpringEntity, DEFAULT_SPRING_PARAMS } from '../ecs/Entity';
import { cn } from '../lib/utils';

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

// ── Zod Schema ──

const springSchema = z.object({
  stiffness: z.number().min(1, '刚度最小值 1 N/m').max(1000, '刚度最大值 1000 N/m').default(DEFAULT_SPRING_PARAMS.stiffness),
  restLength: z.number().min(0.1, '原长最小值 0.1 m').max(50, '原长最大值 50 m').default(DEFAULT_SPRING_PARAMS.restLength),
  damping: z.number().min(0, '阻尼最小值 0').max(50, '阻尼最大值 50').default(DEFAULT_SPRING_PARAMS.damping),
});

type SpringFormValues = z.infer<typeof springSchema>;

export default function SpringCreationDialog() {
  const springDialogOpen = useSimulationStore((s) => s.springDialogOpen);
  const closeSpringDialog = useSimulationStore((s) => s.closeSpringDialog);
  const exitSpringMode = useSimulationStore((s) => s.exitSpringMode);
  const addEntity = useSimulationStore((s) => s.addEntity);
  const selectEntity = useSimulationStore((s) => s.selectEntity);

  const springEntityAId = useSimulationStore((s) => s.springEntityAId);
  const springEntityBId = useSimulationStore((s) => s.springEntityBId);

  const entityAName = useSimulationStore((s) => {
    if (!springEntityAId) return '未知';
    return s.entities.get(springEntityAId)?.name ?? springEntityAId;
  });

  const entityBName = useSimulationStore((s) => {
    if (!springEntityBId) return '未知';
    return s.entities.get(springEntityBId)?.name ?? springEntityBId;
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SpringFormValues>({
    resolver: zodResolver(springSchema),
    defaultValues: {
      stiffness: DEFAULT_SPRING_PARAMS.stiffness,
      restLength: DEFAULT_SPRING_PARAMS.restLength,
      damping: DEFAULT_SPRING_PARAMS.damping,
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeSpringDialog();
      }
    },
    [closeSpringDialog],
  );

  const onSubmit = useCallback(
    (data: SpringFormValues) => {
      if (!springEntityAId || !springEntityBId) return;

      const springEntity = createSpringEntity(springEntityAId, springEntityBId, {
        stiffness: data.stiffness,
        restLength: data.restLength,
        damping: data.damping,
      });

      const added = addEntity(springEntity);
      if (added) {
        selectEntity(springEntity.id);
      }
      exitSpringMode();
    },
    [springEntityAId, springEntityBId, addEntity, selectEntity, exitSpringMode],
  );

  if (!springDialogOpen) return null;

  return (
    <Dialog open={springDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>创建弹簧</DialogTitle>
          <DialogDescription>
            连接「{entityAName}」和「{entityBName}」
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Stiffness */}
          <div className="space-y-1.5">
            <Label htmlFor="springStiffness">
              刚度 <span className="text-[#666]">(N/m)</span>
            </Label>
            <Input
              id="springStiffness"
              type="number"
              step={1}
              min={1}
              max={1000}
              {...register('stiffness', { valueAsNumber: true })}
              className={cn(errors.stiffness && 'border-red-500')}
              style={{
                backgroundColor: '#222',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}
            />
            {errors.stiffness && (
              <span className="text-xs text-red-400">{errors.stiffness.message}</span>
            )}
          </div>

          {/* Rest Length */}
          <div className="space-y-1.5">
            <Label htmlFor="springRestLength">
              原长 <span className="text-[#666]">(m)</span>
            </Label>
            <Input
              id="springRestLength"
              type="number"
              step={0.1}
              min={0.1}
              max={50}
              {...register('restLength', { valueAsNumber: true })}
              className={cn(errors.restLength && 'border-red-500')}
              style={{
                backgroundColor: '#222',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}
            />
            {errors.restLength && (
              <span className="text-xs text-red-400">{errors.restLength.message}</span>
            )}
          </div>

          {/* Damping */}
          <div className="space-y-1.5">
            <Label htmlFor="springDamping">
              阻尼 <span className="text-[#666]">(N·s/m)</span>
            </Label>
            <Input
              id="springDamping"
              type="number"
              step={0.1}
              min={0}
              max={50}
              {...register('damping', { valueAsNumber: true })}
              className={cn(errors.damping && 'border-red-500')}
              style={{
                backgroundColor: '#222',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
              }}
            />
            {errors.damping && (
              <span className="text-xs text-red-400">{errors.damping.message}</span>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSpringDialog}>
              取消
            </Button>
            <Button type="submit">
              确认添加弹簧
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
