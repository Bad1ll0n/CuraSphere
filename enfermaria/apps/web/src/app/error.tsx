'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__Sentry__) {
      (window as any).__Sentry__.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px', padding: '40px 24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="32" height="32" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Algo correu mal</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
            Ocorreu um erro inesperado. A equipa de TI foi notificada.
          </p>
          <button
            onClick={reset}
            style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', padding: '11px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
