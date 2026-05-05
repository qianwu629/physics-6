import { type MetricType } from '../store/chartDataStore';

const METRICS: { key: MetricType; label: string; color: string }[] = [
  { key: 'position', label: '位置', color: '#3b82f6' },
  { key: 'velocity', label: '速度', color: '#22c55e' },
  { key: 'acceleration', label: '加速度', color: '#f97316' },
  { key: 'energy', label: '能量', color: '#a855f7' },
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
              ? 'bg-[rgba(59,130,246,0.2)] border border-[#3b82f6] text-[#e0e0e0]'
              : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[#888] hover:bg-[rgba(59,130,246,0.1)]'}
          `}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
