'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';
import { useNotificacoes, useMarcarLida, useMarcarTodasLidas } from '@/lib/hooks';

export default function NotificacoesPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas'>('todas');

  const { data, isLoading } = useNotificacoes(page);
  const mutLer = useMarcarLida();
  const mutTodasLidas = useMarcarTodasLidas();

  const notificacoes = data?.notificacoes ?? [];
  const lista = filtro === 'nao_lidas' ? notificacoes.filter(n => !n.lida) : notificacoes;

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '4px' }}>
            {data?.naoLidas ? `${data.naoLidas} não lida${data.naoLidas > 1 ? 's' : ''}` : 'Todas lidas'}
          </p>
        </div>
        {(data?.naoLidas ?? 0) > 0 && (
          <button
            onClick={() => mutTodasLidas.mutate(undefined, { onSuccess: () => toast.success('Todas marcadas como lidas'), onError: () => toast.error('Erro ao marcar como lidas') })}
            disabled={mutTodasLidas.isPending}
            className="text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl disabled:opacity-50"
            style={{ padding: '8px 16px' }}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit" style={{ marginBottom: '20px' }}>
        {(['todas', 'nao_lidas'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`text-sm font-semibold rounded-lg px-4 py-2 transition-all ${filtro === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {f === 'todas' ? 'Todas' : 'Não lidas'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : lista.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center" style={{ padding: '60px 40px' }}>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto" style={{ marginBottom: '12px' }}>
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold">Sem notificações</p>
          <p className="text-slate-400 text-sm" style={{ marginTop: '4px' }}>
            {filtro === 'nao_lidas' ? 'Todas as notificações foram lidas.' : 'Não há notificações de momento.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map(n => (
            <div key={n.id}
              className={`bg-white rounded-2xl border flex items-start gap-4 cursor-pointer transition-colors hover:bg-slate-50 ${n.lida ? 'border-slate-100' : 'border-blue-100 bg-blue-50/30'}`}
              style={{ padding: '18px 20px' }}
              onClick={() => { if (!n.lida) mutLer.mutate(n.id); }}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${n.lida ? 'bg-slate-200' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${n.lida ? 'text-slate-600' : 'text-slate-900'}`}>{n.titulo}</p>
                <p className="text-sm text-slate-500" style={{ marginTop: '2px' }}>{n.corpo}</p>
                <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>{fmt(n.criadaEm)}</p>
              </div>
              {!n.lida && (
                <span className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full" style={{ padding: '2px 8px' }}>Nova</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {(data?.totalPaginas ?? 1) > 1 && (
        <div className="flex justify-center gap-2" style={{ marginTop: '24px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl disabled:opacity-40"
            style={{ padding: '8px 16px' }}>← Anterior</button>
          <span className="text-sm text-slate-500 flex items-center" style={{ padding: '8px 12px' }}>
            {page} / {data?.totalPaginas}
          </span>
          <button onClick={() => setPage(p => Math.min(data?.totalPaginas ?? 1, p + 1))} disabled={page === (data?.totalPaginas ?? 1)}
            className="text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl disabled:opacity-40"
            style={{ padding: '8px 16px' }}>Seguinte →</button>
        </div>
      )}
    </div>
  );
}
