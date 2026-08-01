/**
 * SketchBoard — 2D 轮廓画板（自定义凸形建模）
 *
 * 交互：点击空白添加顶点（0.25m 网格吸附）、拖动顶点、右键删点、清空。
 * 实时凸性校验（isConvexProfile）：非凸/退化时红字提示，由父组件决定是否禁止提交。
 */
import { useCallback, useEffect, useRef } from 'react';
import { isConvexProfile, type ProfilePoint } from '../ecs/profileGeometry';

const SIZE = 360;           // 画布像素
const WORLD_HALF = 4;       // 世界坐标半范围（米）：[-4, 4]
const SNAP = 0.25;          // 网格吸附（米）
const HIT_PX = 10;          // 顶点拾取半径（像素）

interface SketchBoardProps {
  value: ProfilePoint[];
  onChange: (points: ProfilePoint[]) => void;
  /** 成型方式：revolve（车削）时顶点钳制到右半平面（x ≥ 0），中心轴高亮 */
  mode?: 'extrude' | 'revolve';
}

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

export default function SketchBoard({ value, onChange, mode = 'extrude' }: SketchBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const convex = isConvexProfile(value);
  const isRevolve = mode === 'revolve';

  const toWorld = useCallback((px: number, py: number): ProfilePoint => {
    let x = (px / SIZE) * WORLD_HALF * 2 - WORLD_HALF;
    const y = WORLD_HALF - (py / SIZE) * WORLD_HALF * 2;
    x = snap(x);
    // 车削模式：轮廓必须在轴的一侧（x ≥ 0）
    if (isRevolve) x = Math.max(0, x);
    return [x, snap(y)];
  }, [isRevolve]);

  const toPx = useCallback((wx: number, wy: number): [number, number] => {
    return [((wx + WORLD_HALF) / (WORLD_HALF * 2)) * SIZE, ((WORLD_HALF - wy) / (WORLD_HALF * 2)) * SIZE];
  }, []);

  const pickVertex = useCallback((px: number, py: number): number | null => {
    for (let i = value.length - 1; i >= 0; i--) {
      const [x, y] = toPx(value[i][0], value[i][1]);
      if (Math.hypot(x - px, y - py) <= HIT_PX) return i;
    }
    return null;
  }, [value, toPx]);

  // ── 渲染 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = 'rgba(5, 5, 17, 0.6)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 车削模式：左半平面（x<0）灰色禁示
    if (isRevolve) {
      const [axisX] = toPx(0, 0);
      ctx.fillStyle = 'rgba(100, 100, 120, 0.12)';
      ctx.fillRect(0, 0, axisX, SIZE);
    }

    // 网格
    ctx.strokeStyle = 'rgba(41, 211, 232, 0.08)';
    ctx.lineWidth = 1;
    for (let w = -WORLD_HALF; w <= WORLD_HALF; w += SNAP) {
      const [x1] = toPx(w, 0);
      const [, y2] = toPx(0, w);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(SIZE, y2); ctx.stroke();
    }
    // 轴线（车削模式的中心轴 = 旋转轴，加粗高亮）
    const [ox, oy] = toPx(0, 0);
    ctx.strokeStyle = 'rgba(41, 211, 232, 0.25)';
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(SIZE, oy); ctx.stroke();
    if (isRevolve) {
      ctx.strokeStyle = 'rgba(41, 211, 232, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, SIZE); ctx.stroke();
      ctx.lineWidth = 1;
    }

    // 轮廓边（含闭合边）
    if (value.length >= 2) {
      ctx.strokeStyle = convex ? '#29d3e8' : '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const [sx, sy] = toPx(value[0][0], value[0][1]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < value.length; i++) {
        const [x, y] = toPx(value[i][0], value[i][1]);
        ctx.lineTo(x, y);
      }
      if (value.length >= 3) ctx.closePath();
      ctx.stroke();
      // 半透明填充
      if (value.length >= 3) {
        ctx.fillStyle = convex ? 'rgba(41, 211, 232, 0.08)' : 'rgba(248, 113, 113, 0.08)';
        ctx.fill();
      }
    }

    // 顶点
    for (let i = 0; i < value.length; i++) {
      const [x, y] = toPx(value[i][0], value[i][1]);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#f4a261' : '#29d3e8';
      ctx.fill();
    }
  }, [value, convex, toPx, isRevolve]);

  // ── 事件 ──
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * SIZE,
      ((e.clientY - rect.top) / rect.height) * SIZE,
    ];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [px, py] = getCanvasPos(e);
    if (e.button === 2) {
      // 右键删点
      const idx = pickVertex(px, py);
      if (idx !== null) onChange(value.filter((_, i) => i !== idx));
      return;
    }
    if (e.button !== 0) return;
    const idx = pickVertex(px, py);
    if (idx !== null) {
      dragIndexRef.current = idx;
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      onChange([...value, toWorld(px, py)]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current === null) return;
    const [px, py] = getCanvasPos(e);
    const next = [...value];
    next[dragIndexRef.current] = toWorld(px, py);
    onChange(next);
  };

  const handlePointerUp = () => {
    dragIndexRef.current = null;
  };

  const status =
    value.length < 3
      ? { text: `点击添加顶点（${value.length}/至少 3 个）`, color: 'var(--muted-foreground)' }
      : convex
        ? { text: `凸形 ✓（${value.length} 个顶点）`, color: 'var(--holo)' }
        : { text: '非凸轮廓 — 仅支持凸形，请调整顶点', color: '#f87171' };

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: '8px',
          border: '1px solid var(--glass-border)',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: status.color }}>{status.text}</span>
        <button
          type="button"
          className="text-xs px-2 py-0.5 rounded hover:bg-[var(--holo-a15)] transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onClick={() => onChange([])}
        >
          清空
        </button>
      </div>
    </div>
  );
}
