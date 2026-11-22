'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { StatCard, SecaoTitulo, CardContainer, Vazio, DashboardHeader, TIPO_EXAME_LABELS, Spinner } from '../partilhado';

export function DashboardImagiologia({ utilizador }: { utilizador: any }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [resultadoModal, setResultadoModal] = useState<any | null>(null);
  const [resultadoTexto, setResultadoTexto] = useState('');

  const { data: worklist = [], isLoading } = useQuery<any[]>({
    queryKey: ['dash-worklist'],
    queryFn: () => api.get('/exames/worklist').then(r => r.data).catch(() => []),
    staleTime: 30_000,
  });

  const iniciarExame = async (id: string) => {
    setAtualizando(id);
    try { await api.patch(`/exames/${id}/estado`, { estado: 'em_progresso' }); qc.invalidateQueries({ queryKey: ['dash-worklist'] }); }
    finally { setAtualizando(null); }
  };

  const mutResultado = useMutation({
    mutationFn: ({ id, resultado }: { id: string; resultado: string }) =>
      api.patch(`/exames/${id}/resultado`, { resultado }),
    onSuccess: () => { toast.success('Resultado registado'); setResultadoModal(null); setResultadoTexto(''); qc.invalidateQueries({ queryKey: ['dash-worklist'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao registar resultado'),
  });

  const urgentes = worklist.filter(e => e.urgente).length;
  const emProgresso = worklist.filter(e => e.estado === 'em_progresso').length;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Exames Pendentes" value={worklist.length} color="bg-sky-500" sub={`${emProgresso} em progresso`} />
        <StatCard label="Urgentes" value={urgentes} color={urgentes > 0 ? 'bg-red-500' : 'bg-slate-400'} />
      </div>

      <SecaoTitulo>Worklist — Exames Pendentes</SecaoTitulo>
      <CardContainer>
        {isLoading ? (
          <Spinner />
        ) : worklist.length === 0 ? (
          <Vazio msg="Worklist limpa — sem exames pendentes" />
        ) : (
          <div className="flex flex-col gap-3">
            {worklist.map(e => (
              <div key={e.id} className={`rounded-xl border flex items-start justify-between gap-3 ${e.urgente ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`} style={{ padding: '14px 16px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2" style={{ marginBottom: '4px' }}>
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 badge-pad py-0.5 rounded-full">
                      {TIPO_EXAME_LABELS[e.tipo] ?? e.tipo}
                    </span>
                    {e.urgente && <span className="text-xs font-bold text-red-600 bg-red-100 badge-pad py-0.5 rounded-full">URGENTE</span>}
                    <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${e.estado === 'em_progresso' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {e.estado === 'em_progresso' ? 'Em progresso' : 'Aguarda'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{e.descricao}</p>
                  <p className="text-xs text-slate-500 font-semibold" style={{ marginTop: '4px' }}>
                    {e.doente?.nome} · Processo {e.doente?.numeroProcesso}
                    {e.doente?.cama && ` · Cama ${e.doente.cama.numero}`}
                  </p>
                  <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>
                    Solicitado por {e.solicitadoPor?.nome} · {new Date(e.criadoEm).toLocaleDateString('pt-PT')} {new Date(e.criadoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {e.estado === 'solicitado' && (
                    <button onClick={() => iniciarExame(e.id)} disabled={atualizando === e.id}
                      className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      style={{ padding: '6px 12px' }}>
                      {atualizando === e.id ? '...' : 'Iniciar'}
                    </button>
                  )}
                  <button onClick={() => { setResultadoModal(e); setResultadoTexto(''); }}
                    className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                    style={{ padding: '6px 12px' }}>
                    Resultado
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContainer>

      {/* Link para worklist completa */}
      <div className="flex justify-center" style={{ marginTop: '20px' }}>
        <a href="/worklist"
          className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-800 transition-colors">
          Ver worklist completa com filtros
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* Modal Resultado */}
      {resultadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '460px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Resultado</h2>
              <button aria-label="Fechar" onClick={() => setResultadoModal(null)} className="text-slate-500 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-xl" style={{ padding: '10px 14px', marginBottom: '20px' }}>
              <strong>{TIPO_EXAME_LABELS[resultadoModal.tipo]}</strong> — {resultadoModal.descricao}<br />
              <span className="text-slate-500">{resultadoModal.doente?.nome}</span>
            </p>
            <textarea value={resultadoTexto} onChange={e => setResultadoTexto(e.target.value)}
              rows={5} placeholder="Descreva os achados e resultado..." className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '20px' }} />
            <div className="flex gap-3">
              <button onClick={() => setResultadoModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={() => mutResultado.mutate({ id: resultadoModal.id, resultado: resultadoTexto })} disabled={mutResultado.isPending || !resultadoTexto.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutResultado.isPending ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
