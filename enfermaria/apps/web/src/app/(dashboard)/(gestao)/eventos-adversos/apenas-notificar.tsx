'use client';

import { useTranslations } from 'next-intl';

/**
 * Quem não gere o risco notifica incidentes mas não vê a lista — que tem os incidentes de todos
 * os doentes, com o nome. A notificação fica registada e segue para a gestão de risco.
 */
export function ApenasNotificar() {
  const t = useTranslations('adverseEvents');
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
      <p className="text-sm font-semibold text-slate-800">{t('reportOnlyTitle')}</p>
      <p className="text-sm text-slate-600" style={{ marginTop: '6px' }}>{t('reportOnlyBody')}</p>
    </div>
  );
}
