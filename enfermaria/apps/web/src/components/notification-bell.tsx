'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Notificacao } from '@org/shared';
import { useNaoLidasCount, useNotificacoes, useMarcarLida, useMarcarTodasLidas } from '@/lib/hooks/use-notificacoes';
import { useAlertaSonoro } from '@/lib/alerta-sonoro';

const ORDEM_NIVEL = { critico: 0, aviso: 1, informativo: 2 } as const;
const COR_NIVEL: Record<string, string> = {
  critico: 'border-l-4 border-red-500 bg-red-50/70',
  aviso: 'border-l-4 border-amber-400',
  informativo: 'border-l-4 border-transparent',
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

/**
 * UX-11 — o sino:
 *  - a lista vinha vazia (lia `data`; a API devolve `notificacoes`);
 *  - críticos primeiro, com cor própria; som no PRIMEIRO crítico e repetido enquanto houver
 *    críticos por ler (com "Silenciar 5 min");
 *  - o clique abre a ficha do doente (e marca como lida), em vez de só marcar como lida.
 */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: countData } = useNaoLidasCount();
  const { data: notifData } = useNotificacoes(1);
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();

  const count = countData?.count ?? 0;
  const notificacoes: Notificacao[] = [...(notifData?.notificacoes ?? [])]
    .sort((a, b) => Number(a.lida) - Number(b.lida) || ORDEM_NIVEL[a.nivel ?? 'informativo'] - ORDEM_NIVEL[b.nivel ?? 'informativo']);
  const criticosPorLer = notificacoes.filter((n) => !n.lida && n.nivel === 'critico').length;
  const { silenciar, silenciado } = useAlertaSonoro(criticosPorLer);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const abrir = (n: Notificacao) => {
    if (!n.lida) marcarLida.mutate(n.id);
    if (n.doenteId) { setOpen(false); router.push(`/doentes/${n.doenteId}`); }
  };

  return (
    <div ref={ref} className="relative">
      <button data-tour="notificacoes"
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? t('bellUnread', { count }) : t('bell')}
        aria-expanded={open}
        className={`relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${criticosPorLer ? 'ring-2 ring-red-500' : ''}`}
      >
        <svg className={`w-5 h-5 ${criticosPorLer ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V4a2 2 0 10-4 0v1.341A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label={t('panel')}
          className="absolute right-0 top-11 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{t('title')}</span>
            <span className="flex items-center gap-3">
              {criticosPorLer > 0 && (
                <button onClick={silenciar} disabled={silenciado} className="text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50">
                  {silenciado ? t('silenced') : t('silence')}
                </button>
              )}
              {count > 0 && (
                <button onClick={() => marcarTodas.mutate()} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                  {t('markAll')}
                </button>
              )}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {notificacoes.length === 0 && <p className="text-sm text-slate-500 text-center py-8">{t('empty')}</p>}
            {notificacoes.map((n) => (
              <button key={n.id} type="button" onClick={() => abrir(n)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${COR_NIVEL[n.nivel ?? 'informativo']} ${!n.lida ? 'font-medium' : 'opacity-75'}`}>
                <p className={`text-xs font-semibold ${n.nivel === 'critico' ? 'text-red-700' : 'text-slate-800'}`}>
                  {n.nivel === 'critico' && <span className="uppercase">{t('critical')} · </span>}{n.titulo}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{n.corpo}</p>
                <p className="text-[11px] text-slate-400 mt-1">{hora(n.criadaEm)}{n.doenteId ? ` · ${t('openFile')}` : ''}</p>
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-right">
            <button type="button" onClick={() => { setOpen(false); router.push('/notificacoes'); }} className="text-xs text-blue-600 hover:underline">{t('seeAll')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
