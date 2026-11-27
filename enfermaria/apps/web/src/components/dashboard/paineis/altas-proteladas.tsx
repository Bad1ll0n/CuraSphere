'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAltasProteladas } from '@/lib/hooks/use-planeamento-alta';
import { CardContainer, CardHeader, Vazio } from '../partilhado';

/**
 * PROD-13 — altas proteladas: doentes com alta clínica dada que continuam internados, há quantos
 * dias, e o que os prende (referenciação à espera de resposta ou de vaga).
 */
export function AltasProteladasCard() {
  const t = useTranslations('delayedDischarges');
  const { data, isLoading, isError, refetch } = useAltasProteladas();
  return (
    <CardContainer>
      <CardHeader title={t('title')} count={data ? t('summary', { doentes: data.doentes, dias: data.diasTotal }) : undefined}
        countColor={data?.doentes ? 'bg-red-100 text-red-700' : undefined} />
      {isLoading ? <Vazio msg={t('loading')} /> : isError ? (
        <div role="alert" className="text-sm text-red-700" style={{ padding: '16px 24px' }}>
          {t('loadError')}{' '}<button type="button" className="underline font-semibold" onClick={() => refetch()}>{t('retry')}</button>
        </div>
      ) : !data?.linhas.length ? <Vazio msg={t('empty')} /> : (
        <ul>
          {data.linhas.slice(0, 8).map((l) => (
            <li key={l.doenteId} className="flex items-center justify-between gap-2 border-b border-slate-50" style={{ padding: '10px 24px' }}>
              <div className="min-w-0">
                <Link href={`/doentes/${l.doenteId}#alta`} className="text-sm font-medium text-slate-800 hover:underline truncate block">{l.nome}</Link>
                <p className="text-xs text-slate-500 truncate">
                  {l.aguarda.length ? l.aguarda.map((a) => t(`waiting.${a.estado}`, { destino: t(`destination.${a.destino}`) })).join(' · ') : t('noReferral')}
                </p>
              </div>
              <span className="text-xs font-bold rounded-full bg-red-50 text-red-700 shrink-0" style={{ padding: '3px 10px' }}>{t('days', { n: l.dias })}</span>
            </li>
          ))}
        </ul>
      )}
    </CardContainer>
  );
}
