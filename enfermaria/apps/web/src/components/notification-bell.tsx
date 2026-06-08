'use client';

import { useState, useRef, useEffect } from 'react';
import { useNaoLidasCount, useNotificacoes, useMarcarLida, useMarcarTodasLidas } from '@/lib/hooks/use-notificacoes';

const TIPOS_CRITICOS = new Set(['ia_watchdog', 'escalacao_automatica', 'news2_critico', 'sepsis', 'sos']);

function tocarAlerta() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch { /* browser policy ou contexto não suportado */ }
}

const TIPO_LABEL: Record<string, { emoji: string; cor: string }> = {
  ia_watchdog:          { emoji: '🧠', cor: 'text-purple-600' },
  escalacao_automatica: { emoji: '⬆️', cor: 'text-red-600' },
  news2_critico:        { emoji: '🚨', cor: 'text-red-600' },
  sepsis:               { emoji: '⚠️', cor: 'text-orange-600' },
  sos:                  { emoji: '🆘', cor: 'text-red-700' },
};

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: countData } = useNaoLidasCount();
  const { data: notifData } = useNotificacoes(1);
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();

  const count = countData?.count ?? 0;
  const notificacoes = (notifData as any)?.data ?? [];
  const prevCountRef = useRef<number>(0);

  useEffect(() => {
    const novoCount = count;
    if (novoCount > prevCountRef.current && prevCountRef.current !== 0) {
      const temCritico = notificacoes.some((n: any) => !n.lida && TIPOS_CRITICOS.has(n.tipo));
      if (temCritico) tocarAlerta();
    }
    prevCountRef.current = novoCount;
  }, [count, notificacoes]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificações${count > 0 ? ` (${count} não lidas)` : ''}`}
        aria-expanded={open}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V4a2 2 0 10-4 0v1.341A6 6 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Painel de notificações"
          className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Notificações</span>
            {count > 0 && (
              <button
                onClick={() => marcarTodas.mutate()}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Marcar todas lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {notificacoes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Sem notificações</p>
            )}
            {notificacoes.map((n: any) => {
              const style = TIPO_LABEL[n.tipo] ?? { emoji: '🔔', cor: 'text-slate-600' };
              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!n.lida ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  onClick={() => !n.lida && marcarLida.mutate(n.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && !n.lida && marcarLida.mutate(n.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{style.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${style.cor} dark:${style.cor}`}>{n.titulo}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{n.corpo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-slate-400">{formatarHora(n.criadoEm)}</span>
                      {!n.lida && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
