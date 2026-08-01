import { type MetricType } from '../store/chartDataStore';

const METRICS: { key: MetricType; label: string; color: string }[] = [
  { key: 'position', label: '位置', color: 'var(--holo)' },
  { key: 'velocity', label: '速度', color: '#22c55e' },
  { key: 'acceleration', label: '加速度', color: '#f97316' },
  { key: 'energy', label: '能量', color: '#a855f7' },
  { key: 'momentum', label: '动量', color: '#eab308' },
];

interface ChartMetricTabsProps {
  activeMetric: MetricType;
  onChange: (metric: MetricType) => void;
}

export function ChartMetricTabs({ activeMetric, onChange }: ChartMetricTabsProps) {
  return (
    <div className="flex gap-1.5 px-3 py-2 shrink-0">
      {METRICS.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          className={`flex-1 px-2 py-1 rounded-lg text-xs transition-all
            ${activeMetric === m.key
              ? 'bg-[var(--holo-a20)] border border-[var(--holo)] text-[var(--foreground)]'
              : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[var(--muted-foreground)] hover:bg-[var(--holo-a10)]'}
          `}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
