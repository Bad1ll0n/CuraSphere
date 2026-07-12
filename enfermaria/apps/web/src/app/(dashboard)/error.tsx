'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__Sentry__) {
      (window as any).__Sentry__.captureException(error);
    }
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '400px', padding: '40px 24px' }}>
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center" style={{ marginBottom: '20px' }}>
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '8px' }}>Erro ao carregar</h2>
      <p className="text-slate-500 text-sm text-center" style={{ marginBottom: '24px', maxWidth: '360px' }}>
        Não foi possível carregar esta secção. Pode tentar novamente ou regressar ao dashboard.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard"
          className="text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          style={{ padding: '9px 20px' }}>
          Ir ao dashboard
        </Link>
        <button
          onClick={reset}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
          style={{ padding: '9px 20px' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
