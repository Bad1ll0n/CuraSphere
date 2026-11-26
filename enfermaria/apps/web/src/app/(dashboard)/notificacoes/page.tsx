'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Notificacao } from '@org/shared';
import { useToast } from '@/components/toast';
import { useNotificacoes, useMarcarLida, useMarcarTodasLidas } from '@/lib/hooks';
import { Button } from '@/components/ui';

const ORDEM = { critico: 0, aviso: 1, informativo: 2 } as const;
const ESTILO: Record<string, string> = {
  critico: 'border-red-300 bg-red-50/60',
  aviso: 'border-amber-200 bg-amber-50/40',
  informativo: 'border-slate-100',
};
const fmt = (d: string) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * UX-11 — notificações com prioridade (crítico / aviso / informativo), agrupadas por doente,
 * críticas primeiro; o clique abre a ficha do doente (antes só marcava como lida). Os não
 * críticos ficam resumidos num grupo próprio, para não competirem com os críticos.
 */
export default function NotificacoesPage() {
  const t = useTranslations('notifications');
  const toast = useToast();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas'>('nao_lidas');

  const { data, isLoading, isError, refetch } = useNotificacoes(page);
  const mutLer = useMarcarLida();
  const mutTodasLidas = useMarcarTodasLidas();

  const notificacoes = data?.notificacoes ?? [];
  const lista = (filtro === 'nao_lidas' ? notificacoes.filter((n) => !n.lida) : notificacoes)
    .slice().sort((a, b) => ORDEM[a.nivel ?? 'informativo'] - ORDEM[b.nivel ?? 'informativo'] || b.criadaEm.localeCompare(a.criadaEm));

  // Agrupar por doente (o grupo herda o nível mais alto); sem doente vão para o fim.
  const grupos = new Map<string, Notificacao[]>();
  for (const n of lista) {
    const chave = n.doenteId ?? '';
    grupos.set(chave, [...(grupos.get(chave) ?? []), n]);
  }
  const ordenados = [...grupos.entries()].sort(([ka, a], [kb, b]) =>
    Number(ka === '') - Number(kb === '') || ORDEM[a[0].nivel ?? 'informativo'] - ORDEM[b[0].nivel ?? 'informativo']);

  const abrir = (n: Notificacao) => {
    if (!n.lida) mutLer.mutate(n.id);
    if (n.doenteId) router.push(`/doentes/${n.doenteId}`);
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>{data?.naoLidas ? t('unread', { n: data.naoLidas }) : t('allRead')}</p>
        </div>
        {(data?.naoLidas ?? 0) > 0 && (
          <Button variant="secondary" onClick={() => mutTodasLidas.mutate(undefined, { onSuccess: () => toast.success(t('allMarked')), onError: () => toast.error(t('markError')) })}
            disabled={mutTodasLidas.isPending}
             style={{ padding: '8px 16px' }}>
            {t('markAll')}
          </Button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit" style={{ marginBottom: '20px' }}>
        {(['nao_lidas', 'todas'] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`text-sm font-semibold rounded-lg px-4 py-2 transition-all ${filtro === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t(f === 'todas' ? 'filterAll' : 'filterUnread')}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-slate-500" style={{ padding: '40px 0' }}>{t('loading')}</p>
        : isError ? (
          <p role="alert" className="text-sm text-red-700">{t('loadError')}{' '}<button type="button" className="underline font-semibold" onClick={() => refetch()}>{t('retry')}</button></p>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '48px 40px' }}>
            <p className="text-slate-700 font-semibold">{t('empty')}</p>
            <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>{t(filtro === 'nao_lidas' ? 'emptyUnread' : 'emptyAll')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ordenados.map(([doenteId, ns]) => (
              <section key={doenteId || 'geral'} aria-label={doenteId ? t('groupPatient', { n: ns.length }) : t('groupGeneral')} className="flex flex-col gap-2">
                {ns.length > 1 && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{doenteId ? t('groupPatient', { n: ns.length }) : t('groupGeneral')}</p>}
                {ns.map((n) => (
                  <button key={n.id} type="button" onClick={() => abrir(n)}
                    className={`w-full text-left bg-white rounded-2xl border flex items-start gap-4 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${ESTILO[n.nivel ?? 'informativo']} ${n.lida ? 'opacity-70' : ''}`}
                    style={{ padding: '16px 20px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.nivel && n.nivel !== 'informativo' && (
                          <span className={`text-xs font-bold rounded-lg ${n.nivel === 'critico' ? 'text-red-700 bg-red-100' : 'text-amber-800 bg-amber-100'}`} style={{ padding: '1px 6px' }}>
                            {t(n.nivel === 'critico' ? 'critical' : 'warning')}
                          </span>
                        )}
                        <p className={`text-sm font-semibold ${n.lida ? 'text-slate-600' : 'text-slate-900'}`}>{n.titulo}</p>
                      </div>
                      <p className="text-sm text-slate-600" style={{ marginTop: '2px' }}>{n.corpo}</p>
                      <p className="text-xs text-slate-500" style={{ marginTop: '6px' }}>{fmt(n.criadaEm)}{n.doenteId ? ` · ${t('openFile')}` : ''}</p>
                    </div>
                    {!n.lida && <span className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full" style={{ padding: '2px 8px' }}>{t('new')}</span>}
                  </button>
                ))}
              </section>
            ))}
          </div>
        )}

      {(data?.totalPaginas ?? 1) > 1 && (
        <div className="flex justify-center gap-2" style={{ marginTop: '24px' }}>
          <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
             style={{ padding: '8px 16px' }}>{t('prev')}</Button>
          <span className="text-sm text-slate-500 flex items-center" style={{ padding: '8px 12px' }}>{page} / {data?.totalPaginas}</span>
          <Button variant="secondary" onClick={() => setPage((p) => Math.min(data?.totalPaginas ?? 1, p + 1))} disabled={page === (data?.totalPaginas ?? 1)}
             style={{ padding: '8px 16px' }}>{t('next')}</Button>
        </div>
      )}
    </div>
  );
}
