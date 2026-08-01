import { useSimulationStore } from '../store';

/**
 * FixedJointBanner — 固定连接创建模式提示横幅 (W4)
 *
 * 当 fixedJointStage !== 'idle' 时渲染在 Toolbar 下方。
 */
export default function FixedJointBanner() {
  const stage = useSimulationStore((s) => s.fixedJointStage);
  const entityAId = useSimulationStore((s) => s.fixedJointEntityAId);

  const entityAName = useSimulationStore((s) => {
    if (!entityAId) return null;
    return s.entities.get(entityAId)?.name ?? entityAId;
  });

  if (stage === 'idle') return null;

  let message: string;
  if (stage === 'pendingA') {
    message = '🔗 连接模式 — 点击场景中第一个实体，或按 Esc 取消';
  } else if (stage === 'pendingB' && entityAName) {
    message = `已选「${entityAName}」— 点击第二个实体进行连接，或按 Esc 取消`;
  } else {
    message = '连接模式';
  }

  return (
    <div
      className="fixed z-40 select-none"
      style={{
        top: '70px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 20px',
        borderRadius: '8px',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--holo-a30)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <span className="text-sm" style={{ color: 'var(--holo)', fontWeight: 500 }}>
        {message}
      </span>
    </div>
  );
}
