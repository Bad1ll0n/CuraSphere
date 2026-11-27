'use client';

import { useTranslations } from 'next-intl';
import { useFaixaDoente } from '@/lib/hooks/use-resumo-clinico';

function haQuanto(iso: string, agora = Date.now()) {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60_000));
  return min < 60 ? { n: min, u: 'min' as const } : { n: Math.round(min / 60), u: 'h' as const };
}

/**
 * UX-03 — uma só pontuação de alerta no cabeçalho do doente: o último NEWS2, com a hora e há
 * quanto tempo ("NEWS2 11 · 13:57 · há 2 h"), e a sépsis ativa. Antes coexistiam o "Risco 0" das
 * baselines (verde) e um NEWS2 de 11 noutro separador. Se o estado registado diz "Estável" e o
 * NEWS2 é ≥ 7 ou há sépsis, pede reavaliação — o estado não pode contradizer o alerta.
 */
export function PontuacaoAlerta({ doenteId, estado }: { doenteId: string; estado?: string }) {
  const t = useTranslations('alertScore');
  const { data } = useFaixaDoente(doenteId);
  if (!data) return null;
  const n2 = data.news2?.valor ?? null;
  const cor = data.sepsisAtiva || (n2 != null && n2 >= 7) ? 'bg-red-100 text-red-800 border-red-300'
    : n2 != null && n2 >= 5 ? 'bg-amber-100 text-amber-800 border-amber-300'
      : n2 != null ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200';
  const ha = data.news2 ? haQuanto(data.news2.em) : null;
  const contradiz = estado === 'estavel' && (data.sepsisAtiva || (n2 != null && n2 >= 7));
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className={`text-xs font-bold rounded-lg border px-2 py-0.5 ${cor}`}>
        {n2 != null && data.news2
          ? t('news2', { valor: n2, hora: new Date(data.news2.em).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }), ha: t(ha!.u === 'min' ? 'agoMin' : 'agoH', { n: ha!.n }) })
          : t('noNews2')}
      </span>
      {data.sepsisAtiva && <span className="text-xs font-bold rounded-lg border px-2 py-0.5 bg-red-600 text-white border-red-700">{t('sepsis')}</span>}
      {contradiz && <span role="status" className="text-xs font-semibold rounded-lg px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300">{t('reassess')}</span>}
    </span>
  );
}
