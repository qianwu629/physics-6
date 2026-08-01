/**
 * builderFields — 建造器共用的小表单字段（ObjectBuilder / TrackBuilder）
 */
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';

export function NumField({
  label,
  value,
  onChange,
  min = -100,
  max = 100,
  step = 0.1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-[var(--muted-foreground)]">
        {label}（{value.toFixed(2)}{unit ? ` ${unit}` : ''}）
      </Label>
      <div className="flex items-center gap-2">
        <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="flex-1" />
        <Input
          type="number"
          value={value}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-16 h-7 text-xs font-mono text-center"
          style={{ background: 'var(--well)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
        />
      </div>
    </div>
  );
}

export function Vec3Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-[var(--muted-foreground)]">{label}</Label>
      <div className="grid grid-cols-3 gap-1.5">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <div key={axis}>
            <span className="block text-[10px] text-[var(--text-dim)] mb-0.5">{axis}</span>
            <Input
              type="number"
              step={0.5}
              value={value[i]}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (isNaN(v)) return;
                const next: [number, number, number] = [...value];
                next[i] = v;
                onChange(next);
              }}
              className="h-7 text-xs font-mono text-center"
              style={{ background: 'var(--well)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
