import { useEffect, useState, useRef } from 'react';
import { useSimulationStore } from '../store';
import { DEFAULT_ENVIRONMENT } from '../store/simulationSlice';

const GRAVITY_PRESETS: { label: string; value: [number, number, number] }[] = [
  { label: '地球', value: [0, -9.81, 0] },
  { label: '月球', value: [0, -1.62, 0] },
  { label: '火星', value: [0, -3.71, 0] },
  { label: '零重力', value: [0, 0, 0] },
];

const FRICTION_PRESETS: { label: string; value: number }[] = [
  { label: '超滑', value: 0.1 },
  { label: '低摩擦', value: 0.5 },
  { label: '标准', value: 1.0 },
  { label: '高摩擦', value: 2.0 },
];

function HighlightSlider({ value, onChange, min, max, step, disabled, unit }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step: number; disabled: boolean; unit: string;
}) {
  const [highlight, setHighlight] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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
          ${highlight ? 'accent-[#3b82f6] ring-2 ring-[#3b82f6]/40' : 'accent-[#3b82f6]'}
        `}
        style={{ background: highlight ? 'rgba(59,130,246,0.2)' : '#333' }}
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
          bg-[#0a0a0a] text-[#e0e0e0] border-[rgba(255,255,255,0.08)]
          disabled:opacity-30 disabled:cursor-not-allowed
          ${highlight ? 'border-[#3b82f6]' : ''}
        `}
      />
      <span className="text-xs text-[#666] w-8">{unit}</span>
    </div>
  );
}

export default function EnvironmentPanel() {
  const environmentPanelOpen = useSimulationStore((s) => s.environmentPanelOpen);
  const closeEnvironmentPanel = useSimulationStore((s) => s.closeEnvironmentPanel);
  const environment = useSimulationStore((s) => s.environment);
  const setGravity = useSimulationStore((s) => s.setGravity);
  const setFrictionScale = useSimulationStore((s) => s.setFrictionScale);
  const setRestitutionScale = useSimulationStore((s) => s.setRestitutionScale);
  const setDrag = useSimulationStore((s) => s.setDrag);
  const isRunning = useSimulationStore((s) => s.isRunning);

  // Phase 2: 势能参考高度 (C-04 fix: 唯一来源在 simulationSlice.environment)
  const peReferenceY = useSimulationStore((s) => s.environment.peReferenceY);
  const setPeReferenceY = useSimulationStore((s) => s.setPeReferenceY);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!environmentPanelOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEnvironmentPanel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [environmentPanelOpen, closeEnvironmentPanel]);

  // Close on outside click
  useEffect(() => {
    if (!environmentPanelOpen) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeEnvironmentPanel();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => document.removeEventListener('mousedown', onClick);
  }, [environmentPanelOpen, closeEnvironmentPanel]);

  if (!environmentPanelOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 rounded-xl select-none"
      style={{
        right: '16px',
        top: '60px',
        width: '320px',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'rgba(26, 26, 26, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        padding: '20px',
      }}
    >
      {/* Title + Close */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-[#a0a0a0] uppercase tracking-wider">环境参数</span>
        <button
          type="button"
          onClick={closeEnvironmentPanel}
          className="text-[#666] hover:text-[#e0e0e0] text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Running banner */}
      {isRunning && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs text-center bg-[rgba(59,130,246,0.1)] text-[#3b82f6] border border-[rgba(59,130,246,0.2)]">
          运行中，请暂停后编辑
        </div>
      )}

      {/* Gravity */}
      <div className="mb-4">
        <div className="text-xs font-medium text-[#a0a0a0] mb-2">重力</div>
        <div className="flex gap-1.5 mb-2">
          {GRAVITY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={isRunning}
              onClick={() => setGravity([...p.value])}
              className={`flex-1 px-1 py-1.5 rounded-lg text-xs transition-all
                ${environment.gravity[1] === p.value[1] && environment.gravity[0] === p.value[0] && environment.gravity[2] === p.value[2]
                  ? 'bg-[rgba(59,130,246,0.2)] border border-[#3b82f6] text-[#e0e0e0]'
                  : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[#888] hover:bg-[rgba(59,130,246,0.1)]'}
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <div key={axis} className="flex items-center gap-2 mb-1">
            <span className="text-xs text-[#666] w-3">{axis}</span>
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

      <div className="h-px bg-[rgba(255,255,255,0.06)] my-3" />

      {/* Friction Scale */}
      <div className="mb-4">
        <div className="text-xs font-medium text-[#a0a0a0] mb-2">摩擦倍率</div>
        <div className="flex gap-1.5 mb-2">
          {FRICTION_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={isRunning}
              onClick={() => setFrictionScale(p.value)}
              className={`flex-1 px-1 py-1.5 rounded-lg text-xs transition-all
                ${environment.frictionScale === p.value
                  ? 'bg-[rgba(59,130,246,0.2)] border border-[#3b82f6] text-[#e0e0e0]'
                  : 'bg-[rgba(255,255,255,0.04)] border border-transparent text-[#888] hover:bg-[rgba(59,130,246,0.1)]'}
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
        <HighlightSlider
          value={environment.frictionScale}
          onChange={setFrictionScale}
          min={0}
          max={5}
          step={0.1}
          disabled={isRunning}
          unit="×"
        />
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.06)] my-3" />

      {/* Restitution Scale */}
      <div className="mb-4">
        <div className="text-xs font-medium text-[#a0a0a0] mb-2">弹性倍率</div>
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

      <div className="h-px bg-[rgba(255,255,255,0.06)] my-3" />

      {/* Drag */}
      <div className="mb-2">
        <div className="text-xs font-medium text-[#a0a0a0] mb-2">空气阻力</div>
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

      <div className="h-px bg-[rgba(255,255,255,0.06)] my-3" />

      {/* Phase 2: 势能参考高度 */}
      <div className="mb-2">
        <div className="text-xs font-medium text-[#a0a0a0] mb-2">势能参考高度 (y=0)</div>
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
    </div>
  );
}
