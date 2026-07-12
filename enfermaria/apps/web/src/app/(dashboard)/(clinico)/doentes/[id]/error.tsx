'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DoenteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__Sentry__) {
      (window as any).__Sentry__.captureException(error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '400px', padding: '40px 24px' }}>
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center" style={{ marginBottom: '20px' }}>
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '8px' }}>Erro ao carregar doente</h2>
      <p className="text-slate-500 text-sm text-center" style={{ marginBottom: '24px', maxWidth: '360px' }}>
        Não foi possível carregar os dados do doente. O registo pode ter sido removido ou houve um erro de rede.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/doentes')}
          className="text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          style={{ padding: '9px 20px' }}>
          Lista de doentes
        </button>
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
