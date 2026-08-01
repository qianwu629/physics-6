import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorFallback — 致命错误时显示的错误卡片
 *
 * 两种错误类型对应 UI-SPEC 合同文案:
 * - type="webgl": 浏览器不支持 WebGL 2.0
 * - type="wasm": Rapier WASM 初始化失败
 */

export type ErrorType = 'webgl' | 'wasm';

const ERROR_CONFIG: Record<ErrorType, { heading: string; description: string }> = {
  webgl: {
    heading: 'WebGL 不可用',
    description: '您的浏览器不支持 WebGL 2.0。请使用最新版 Chrome、Firefox 或 Edge。',
  },
  wasm: {
    heading: '物理引擎加载失败',
    description: 'Rapier WASM 初始化失败，请刷新页面重试。如持续出现，请检查浏览器是否支持 WebAssembly。',
  },
};

export default function ErrorFallback({ type }: { type: ErrorType }) {
  const config = ERROR_CONFIG[type];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--well)',
        zIndex: 200,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '40px 48px',
          backgroundColor: 'var(--background)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          maxWidth: '420px',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={40} strokeWidth={1.5} color="var(--destructive)" />

        <h2 style={{
          color: 'var(--foreground)',
          fontSize: '20px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          margin: 0,
        }}>
          {config.heading}
        </h2>

        <p style={{
          color: 'var(--muted-foreground)',
          fontSize: '14px',
          fontWeight: 400,
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.5,
          margin: 0,
        }}>
          {config.description}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            marginTop: '8px',
            backgroundColor: 'var(--holo)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            transition: 'background-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--holo)'; }}
        >
          <RefreshCw size={16} strokeWidth={2} />
          刷新页面
        </button>
      </div>
    </div>
  );
}
