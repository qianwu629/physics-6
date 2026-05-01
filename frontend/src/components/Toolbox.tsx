import { Circle, Square, Database, TriangleAlert, Plus, X } from 'lucide-react';
import { useSimulationStore } from '../store';
import { cn } from '../lib/utils';
import type { ShapeType } from '../store/uiSlice';

const SHAPES: { type: ShapeType; label: string; tooltip: string; shortcut: string; Icon: typeof Circle }[] = [
  { type: 'sphere', label: '添加球体', tooltip: '添加球体', shortcut: 'B', Icon: Circle },
  { type: 'box', label: '添加方块', tooltip: '添加方块', shortcut: 'N', Icon: Square },
  { type: 'cylinder', label: '添加圆柱', tooltip: '添加圆柱', shortcut: 'C', Icon: Database },
  { type: 'slope', label: '添加斜面', tooltip: '添加斜面', shortcut: 'S', Icon: TriangleAlert },
];

export default function Toolbox() {
  const toolboxCollapsed = useSimulationStore((s) => s.toolboxCollapsed);
  const toggleToolbox = useSimulationStore((s) => s.toggleToolbox);
  const openDialog = useSimulationStore((s) => s.openDialog);

  return (
    <div
      className="fixed z-40 flex flex-col items-center gap-2 p-2 rounded-xl select-none"
      style={{
        left: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'rgba(26, 26, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      {toolboxCollapsed ? (
        /* 折叠状态 — 仅 "+" 按钮 */
        <button
          type="button"
          aria-label="展开工具箱"
          title="展开工具箱"
          onClick={toggleToolbox}
          className="flex items-center justify-center w-10 h-10 rounded-lg
            text-[#a0a0a0] hover:bg-[rgba(59,130,246,0.15)] hover:text-[#3b82f6]
            active:bg-[rgba(59,130,246,0.3)] active:scale-95
            transition-all duration-150"
        >
          <Plus size={20} strokeWidth={2} />
        </button>
      ) : (
        /* 展开状态 — 4 个形状按钮 + 收起按钮 */
        <>
          {SHAPES.map(({ type, label, tooltip, shortcut, Icon }) => (
            <button
              key={type}
              type="button"
              aria-label={label}
              title={`${tooltip} (${shortcut})`}
              onClick={() => openDialog(type)}
              className="flex items-center justify-center w-10 h-10 rounded-lg
                text-[#a0a0a0] hover:bg-[rgba(59,130,246,0.15)] hover:text-[#3b82f6]
                active:bg-[rgba(59,130,246,0.3)] active:scale-95
                transition-all duration-150"
            >
              <Icon size={20} strokeWidth={2} />
            </button>
          ))}
          {/* 折叠按钮 */}
          <button
            type="button"
            aria-label="收起工具箱"
            title="收起工具箱"
            onClick={toggleToolbox}
            className="flex items-center justify-center w-8 h-8 rounded-lg
              text-[#666] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#a0a0a0]
              active:scale-95 transition-all duration-150 mt-1"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}
