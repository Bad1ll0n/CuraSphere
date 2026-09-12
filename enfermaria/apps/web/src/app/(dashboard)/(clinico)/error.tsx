'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

/**
 * Fronteira de erro das vistas clínicas.
 *
 * Distinta da genérica do dashboard de propósito: aqui a ausência de dados no ecrã não pode
 * ser lida como ausência de dados no doente. A mensagem di-lo explicitamente e é anunciada
 * (`role="alert"`) — um profissional que não veja alertas por causa de uma falha de rede
 * tem de saber que a lista está incompleta, não vazia.
 */
export default function ClinicoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const semRede = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div role="alert" className="flex flex-col items-center justify-center" style={{ minHeight: '420px', padding: '48px 24px' }}>
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center" style={{ marginBottom: '20px' }}>
        <svg className="w-7 h-7 text-red-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900" style={{ marginBottom: '8px' }}>
        {semRede ? 'Sem ligação à rede' : 'Não foi possível carregar esta vista clínica'}
      </h2>
      <p className="text-slate-600 text-sm text-center" style={{ marginBottom: '10px', maxWidth: '420px' }}>
        {semRede
          ? 'O dispositivo está sem ligação. Os dados apresentados podem estar desactualizados.'
          : 'Os dados clínicos desta vista não chegaram.'}
      </p>
      <p className="text-red-700 text-sm text-center font-medium" style={{ marginBottom: '28px', maxWidth: '420px' }}>
        Um ecrã sem registos aqui não significa que o doente não tenha registos — confirme por
        outra via antes de tomar qualquer decisão clínica.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          href="/dashboard"
          className="text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center"
          style={{ padding: '9px 20px', minHeight: '44px' }}>
          Ir ao dashboard
        </Link>
        <button
          onClick={reset}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
          style={{ padding: '9px 20px', minHeight: '44px' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
