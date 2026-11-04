'use client';

import { useTranslations } from 'next-intl';
import type { EstadoSocket } from '@/lib/use-socket';

/**
 * Aviso de canal em tempo real indisponível.
 *
 * O canal transporta alertas SOS do doente, SLA de urgência, pré-notificação de ambulância e
 * bloqueios de nota concorrente. Quando cai, a interface fica indistinguível de "não há
 * alertas" — por isso a falha é mostrada e anunciada (`role="alert"`), nunca engolida.
 */
export function SocketStatusBanner({
  estado,
  onReconectar,
}: {
  estado: EstadoSocket['estado'];
  onReconectar: () => void;
}) {
  const t = useTranslations('realtime');

  if (estado !== 'falhou') return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-red-300 bg-red-50 text-red-800"
      style={{ padding: '10px 20px' }}
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p className="text-sm font-medium flex-1" style={{ lineHeight: 1.4 }}>
        <strong>{t('offlineTitle')}</strong> {t('offlineBody')}
      </p>
      <button
        type="button"
        onClick={onReconectar}
        className="text-sm font-semibold rounded-lg border border-red-300 bg-white hover:bg-red-100 transition-colors flex-shrink-0"
        style={{ padding: '8px 16px', minHeight: '44px' }}
      >
        {t('retry')}
      </button>
    </div>
  );
}
