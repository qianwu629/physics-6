import { Loader2 } from 'lucide-react';

/**
 * LoadingScreen — WASM 引擎加载中屏幕
 *
 * D-11: WASM 加载期间中央显示加载动画 + "正在加载物理引擎..." 文字。
 * 加载完成后自动渲染场景并进入暂停状态（D-04）。
 *
 * UI-SPEC 合同:
 * - 背景: dominant #0a0a0a
 * - 图标: Lucide Loader2 + spin CSS 动画
 * - 文字: "正在加载物理引擎..." (16px body 字号, #888888)
 * - 布局: 垂直居中, flex column, gap 16px
 */
export default function LoadingScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        backgroundColor: '#0a0a0a',
        zIndex: 100,
      }}
    >
      <Loader2
        size={40}
        strokeWidth={1.5}
        color="#3b82f6"
        style={{ animation: 'spin 1s linear infinite' }}
      />
      <p
        style={{
          color: '#888888',
          fontSize: '16px',
          fontWeight: 400,
          fontFamily: 'var(--font-sans)',
        }}
      >
        正在加载物理引擎...
      </p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
