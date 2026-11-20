'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const BANDAS = [
  { chave: 'baixo', badge: 'bg-green-100 text-green-700', faixa: '0–4' },
  { chave: 'medio', badge: 'bg-amber-100 text-amber-700', faixa: '5–6' },
  { chave: 'alto', badge: 'bg-red-100 text-red-700', faixa: '≥7' },
  { chave: 'semRegisto', badge: 'bg-slate-100 text-slate-500', faixa: '—' },
] as const;

/**
 * UX-03 — distribuição NEWS2 do dashboard. Cada número é uma ligação para a lista filtrada
 * (antes era um `<div>` estático: "Alto: 1" sem caminho até ao doente). Era repetida, igual,
 * nos painéis do médico e do enfermeiro.
 */
export function DistribuicaoNews2({ dados, destino, titulo }: {
  dados: { news2?: Partial<Record<(typeof BANDAS)[number]['chave'], number>>; totalAtivos?: number } | null;
  destino: string;
  titulo: string;
}) {
  const t = useTranslations('news2Distribution');
  if (!dados) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-full" style={{ padding: '20px 24px' }}>
      <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '14px' }}>{titulo}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BANDAS.map(({ chave, badge, faixa }) => {
          const valor = dados.news2?.[chave] ?? 0;
          return (
            <Link key={chave} href={`${destino}?banda=${chave}`} aria-label={t('linkLabel', { banda: t(chave), n: valor })}
              className={`rounded-xl text-center hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${badge}`} style={{ padding: '14px 8px' }}>
              <p className="text-2xl font-black">{valor}</p>
              <p className="text-xs font-semibold" style={{ marginTop: '2px' }}>{t(chave)}</p>
              <p className="text-xs opacity-70">{faixa}</p>
            </Link>
          );
        })}
      </div>
      {dados.totalAtivos != null && <p className="text-xs text-slate-500 text-right" style={{ marginTop: '10px' }}>{t('active', { n: dados.totalAtivos })}</p>}
    </div>
  );
}
