import { useState, useRef } from 'react';
import { useSimulationStore } from '../store';
import { useVisualizationStore } from '../store/visualizationStore';

const GRAVITY_PRESETS: { label: string; value: [number, number, number] }[] = [
  { label: '地球', value: [0, -9.81, 0] },
  { label: '月球', value: [0, -1.62, 0] },
  { label: '火星', value: [0, -3.71, 0] },
  { label: '零重力', value: [0, 0, 0] },
];

// W3: 全局「摩擦倍率」已移除 — 摩擦改为面级配置（见 collider.faces / faceGeometry）

function HighlightSlider({ value, onChange, min, max, step, disabled, unit }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; disabled: boolean; unit: string;
}) {
  const [highlight, setHighlight] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = (v: number) => {
    onChange(v);
    if (!disabled) {
      setHighlight(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHighlight(false), 300);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer
          disabled:opacity-30 disabled:cursor-not-allowed
          ${highlight ? 'accent-[var(--holo)] ring-2 ring-[var(--holo)]/40' : 'accent-[var(--holo)]'}
        `}
        style={{ background: highlight ? 'var(--holo-a20)' : 'var(--text-dim)' }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
        className={`w-20 px-2 py-1 text-xs text-right rounded border
          bg-[var(--well)] text-[var(--foreground)] border-[var(--glass-border)]
          disabled:opacity-30 disabled:cursor-not-allowed
          ${highlight ? 'border-[var(--holo)]' : ''}
        `}
      />
      <span className="text-xs text-[var(--text-dim)] w-8">{unit}</span>
    </div>
  );
}

export default function EnvironmentPanel() {
  const environment = useSimulationStore((s) => s.environment);
  const setGravity = useSimulationStore((s) => s.setGravity);
  const setRestitutionScale = useSimulationStore((s) => s.setRestitutionScale);
  const setDrag = useSimulationStore((s) => s.setDrag);
  const isRunning = useSimulationStore((s) => s.isRunning);
  // 箭头缩放（可视化 store）
  const arrowScale = useVisualizationStore((s) => s.arrowScale);
  const setArrowScale = useVisualizationStore((s) => s.setArrowScale);

  // Phase 2: 势能参考高度 (C-04 fix: 唯一来源在 simulationSlice.environment)
  const peReferenceY = useSimulationStore((s) => s.environment.peReferenceY);
  const setPeReferenceY = useSimulationStore((s) => s.setPeReferenceY);

  // Ticket 1: 迁入 dock — 可见性由 dock 管理，移除 open 门控/Escape/外部点击关闭
  return (
    <div
      className="h-full w-full select-none"
      style={{
        overflowY: 'auto',
        padding: '20px',
      }}
    >
      {/* Running banner */}
      {isRunning && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs text-center bg-[var(--holo-a10)] text-[var(--holo)] border border-[var(--holo-a20)]">
          运行中，请暂停后编辑
        </div>
      )}

      {/* Gravity */}
      <div className="mb-4">
        <div className="text-xs font-medium text-[var(--muted-foreground)] mb-2">重力</div>
        <div className="flex gap-1.5 mb-2">
          {GRAVITY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={isRunning}
              onClick={() => setGravity([...p.value])}
              className={`flex-1 px-1 py-1.5 rounded-lg text-xs transition-all
                ${environment.gravity[1] === p.value[1] && environment.gravity[0] === p.value[0] && environment.gravity[2] === p.value[2]
                  ? 'bg-[var(--holo-a20)] border border-[var(--holo)] text-[var(--foreground)]'
                  : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[var(--muted-foreground)] hover:bg-[var(--holo-a10)]'}
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <div key={axis} className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[var(--text-dim)] w-3">{axis}</span>
            <HighlightSlider
              value={environment.gravity[i]}
              onChange={(v) => {
                const g = [...environment.gravity] as [number, number, number];
                g[i] = v;
                setGravity(g);
              }}
              min={-20}
              max={20}
              step={0.1}
              disabled={isRunning}
              unit="m/s²"
            />
          </div>
        ))}
      </div>

      <div className="h-px bg-[var(--glass-border)] my-3" />

      {/* Restitution Scale */}
      <div className="mb-4">
        <div className="text-xs font-medium text-[var(--muted-foreground)] mb-2">弹性倍率</div>
        <HighlightSlider
          value={environment.restitutionScale}
          onChange={setRestitutionScale}
          min={0}
          max={5}
          step={0.1}
          disabled={isRunning}
          unit="×"
        />
      </div>

      <div className="h-px bg-[var(--glass-border)] my-3" />

      {/* Drag */}
      <div className="mb-2">
        <div className="text-xs font-medium text-[var(--muted-foreground)] mb-2">空气阻力</div>
        <HighlightSlider
          value={environment.drag}
          onChange={setDrag}
          min={0}
          max={5}
          step={0.05}
          disabled={isRunning}
          unit=""
        />
      </div>

      <div className="h-px bg-[var(--glass-border)] my-3" />

      {/* Phase 2: 势能参考高度 */}
      <div className="mb-2" data-testid="pe-reference-section">
        <div className="text-xs font-medium text-[var(--muted-foreground)] mb-2">势能参考高度 (y=0)</div>
        <HighlightSlider
          value={peReferenceY}
          onChange={setPeReferenceY}
          min={-50}
          max={50}
          step={0.1}
          disabled={false}
          unit="m"
        />
      </div>

      <div className="h-px bg-[var(--glass-border)] my-3" />

      {/* 箭头缩放（可视化；与势能参考高度一样，运行中也可调） */}
      <div className="mb-2" data-testid="arrow-scale-section">
        <div className="text-xs font-medium text-[var(--muted-foreground)] mb-2">箭头缩放</div>
        <HighlightSlider
          value={arrowScale}
          onChange={setArrowScale}
          min={0.2}
          max={3}
          step={0.1}
          disabled={false}
          unit="×"
        />
      </div>
    </div>
  );
}
