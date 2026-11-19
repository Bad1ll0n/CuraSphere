'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** PROD-18 — acesso aos indicadores de enfermagem a partir do dashboard de qualidade. */
export function LinkIndicadores() {
  const t = useTranslations('qualityDashboard');
  return (
    <Link href="/dashboard-qualidade/indicadores" className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-2xl hover:bg-blue-100/60" style={{ padding: '14px 18px', marginBottom: '24px' }}>
      <span>
        <span className="block text-sm font-semibold text-blue-900">{t('indicatorsTitle')}</span>
        <span className="block text-xs text-blue-800">{t('indicatorsBody')}</span>
      </span>
      <span className="text-sm font-semibold text-blue-700 shrink-0">{t('open')} →</span>
    </Link>
  );
}
