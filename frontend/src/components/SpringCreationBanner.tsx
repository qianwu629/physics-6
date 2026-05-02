import { useSimulationStore } from '../store';

/**
 * SpringCreationBanner — 弹簧创建模式提示横幅
 *
 * 当 springCreationStage !== 'idle' 时渲染在 Toolbar 下方。
 * 显示当前步骤提示和已选端点信息。
 *
 * 状态:
 *   pendingA: "〰 弹簧创建模式 — 点击场景中第一个实体（锚点 A），或按 Esc 取消"
 *   pendingB:  "已选「XX」— 点击第二个实体（锚点 B），或按 Esc 取消"
 */
export default function SpringCreationBanner() {
  const stage = useSimulationStore((s) => s.springCreationStage);
  const entityAId = useSimulationStore((s) => s.springEntityAId);

  if (stage === 'idle') return null;

  // Resolve entity A name
  const entityAName = useSimulationStore((s) => {
    if (!entityAId) return null;
    return s.entities.get(entityAId)?.name ?? entityAId;
  });

  let message: string;
  if (stage === 'pendingA') {
    message = '〰 弹簧创建模式 — 点击场景中第一个实体（锚点 A），或按 Esc 取消';
  } else if (stage === 'pendingB' && entityAName) {
    message = `已选「${entityAName}」— 点击第二个实体（锚点 B），或按 Esc 取消`;
  } else {
    message = '弹簧创建模式';
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
        background: 'rgba(26, 26, 26, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <span
        className="text-sm"
        style={{ color: '#3b82f6', fontWeight: 500 }}
      >
        {message}
      </span>
    </div>
  );
}
