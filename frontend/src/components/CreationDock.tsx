import { Box, Link2, Route, Waves } from 'lucide-react';
import { useSimulationStore } from '../store';

/**
 * CreationDock — 底部悬浮创建栏（W8 创建体系重构）
 *
 * 取代旧左侧工具箱：4 个创建入口
 * - 创建物体 → ObjectBuilderDialog（三栏建造器）
 * - 创建连接体 → 连接模式（点选两个实体，类型：固定/铰链/球窝/弹簧/轻绳/轻杆）
 * - 创建轨道 → TrackBuilderDialog
 * - 创建场 → ForceFieldDialog（顶部类型选择）
 */
export default function CreationDock() {
  const openObjectBuilder = useSimulationStore((s) => s.openObjectBuilder);
  const openTrackBuilder = useSimulationStore((s) => s.openTrackBuilder);
  const fixedJointStage = useSimulationStore((s) => s.fixedJointStage);
  const enterFixedJointMode = useSimulationStore((s) => s.enterFixedJointMode);
  const exitFixedJointMode = useSimulationStore((s) => s.exitFixedJointMode);
  const openForceFieldDialog = useSimulationStore((s) => s.openForceFieldDialog);

  const isConnectMode = fixedJointStage !== 'idle';

  const items: {
    key: string;
    label: string;
    Icon: typeof Box;
    active?: boolean;
    onClick: () => void;
  }[] = [
    { key: 'object', label: '创建物体', Icon: Box, onClick: openObjectBuilder },
    {
      key: 'connect',
      label: '创建连接体',
      Icon: Link2,
      active: isConnectMode,
      onClick: () => (isConnectMode ? exitFixedJointMode() : enterFixedJointMode()),
    },
    { key: 'track', label: '创建轨道', Icon: Route, onClick: openTrackBuilder },
    { key: 'field', label: '创建场', Icon: Waves, onClick: () => openForceFieldDialog('uniform') },
  ];

  return (
    <div
      className="fixed z-40 select-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
      style={{
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}
    >
      {items.map(({ key, label, Icon, active, onClick }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          title={label}
          onClick={onClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150
            text-[var(--muted-foreground)] hover:bg-[var(--holo-a15)] hover:text-[var(--holo)]
            active:bg-[var(--holo-a30)] active:scale-95"
          style={active ? { backgroundColor: 'var(--holo-a20)', color: 'var(--holo)' } : {}}
        >
          <Icon size={15} strokeWidth={2} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
