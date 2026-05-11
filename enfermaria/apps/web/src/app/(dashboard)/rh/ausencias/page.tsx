'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../lib/auth-context';
import api from '../../../../lib/api';

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  estado: 'pendente' | 'aprovada' | 'rejeitada';
  observacoes?: string;
  criadoEm: string;
  utilizador?: { id: string; nome: string; role: string; servico: string };
  aprovadoPor?: { id: string; nome: string };
}

const TIPO_LABEL: Record<string, string> = {
  ferias: 'Férias', baixa_medica: 'Baixa Médica', licenca_maternidade: 'Lic. Maternidade',
  falta_justificada: 'Falta Justificada', outro: 'Outro',
};

const ESTADO_COR: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  aprovada: 'bg-green-50 text-green-700 border-green-200',
  rejeitada: 'bg-red-50 text-red-600 border-red-200',
};

const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada',
};

function diasEntre(ini: string, fim: string) {
  return Math.ceil((new Date(fim).getTime() - new Date(ini).getTime()) / 86400000) + 1;
}

export default function AusenciasPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<'todas' | 'minhas'>('todas');
  const [filtroEstado, setFiltroEstado] = useState(searchParams.get('estado') ?? '');
  const [modalNova, setModalNova] = useState(false);
  const [novaTipo, setNovaTipo] = useState('ferias');
  const [novaInicio, setNovaInicio] = useState('');
  const [novaFim, setNovaFim] = useState('');
  const [novaObs, setNovaObs] = useState('');
  const [erroNova, setErroNova] = useState('');

  const role = utilizador?.role ?? '';
  const isGestor = ['administrativo', 'direcao'].includes(role);

  const { data: ausencias = [], isLoading: loading } = useQuery<Ausencia[]>({
    queryKey: ['ausencias', aba, filtroEstado],
    queryFn: () => {
      const url = aba === 'todas'
        ? `/rh/ausencias${filtroEstado ? `?estado=${filtroEstado}` : ''}`
        : '/rh/ausencias/minhas';
      return api.get(url).then(r => r.data).catch(() => []);
    },
    staleTime: 30_000,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['ausencias'] });

  const mutAprovar = useMutation({ mutationFn: (id: string) => api.patch(`/rh/ausencias/${id}/aprovar`), onSuccess: invalidar });
  const mutRejeitar = useMutation({ mutationFn: (id: string) => api.patch(`/rh/ausencias/${id}/rejeitar`), onSuccess: invalidar });
  const mutCancelar = useMutation({ mutationFn: (id: string) => api.delete(`/rh/ausencias/${id}`), onSuccess: invalidar });
  const mutNova = useMutation({
    mutationFn: (body: object) => api.post('/rh/ausencias', body),
    onSuccess: () => { setModalNova(false); setNovaInicio(''); setNovaFim(''); setNovaObs(''); setAba('minhas'); invalidar(); },
    onError: () => setErroNova('Erro ao submeter pedido.'),
  });

  const criarAusencia = () => {
    setErroNova('');
    if (!novaInicio || !novaFim) { setErroNova('Preencha as datas.'); return; }
    if (new Date(novaFim) < new Date(novaInicio)) { setErroNova('Data de fim antes do início.'); return; }
    mutNova.mutate({ tipo: novaTipo, dataInicio: novaInicio, dataFim: novaFim, observacoes: novaObs || undefined });
  };

  const pendentesCount = ausencias.filter(a => a.estado === 'pendente').length;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div className="flex items-center gap-3">
          <Link href="/rh" className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Ausências e Férias</h1>
            <p className="text-sm text-slate-500" style={{ marginTop: '2px' }}>Gestão de pedidos de ausência</p>
          </div>
        </div>
        <button onClick={() => setModalNova(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Pedir Ausência
        </button>
      </div>

      {/* Tabs + filtro */}
      <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
        {isGestor ? (
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ width: 'fit-content' }}>
            {([
              { key: 'todas', label: 'Todas', badge: aba === 'todas' ? pendentesCount : 0 },
              { key: 'minhas', label: 'As Minhas', badge: 0 },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setAba(t.key)}
                className={`flex items-center gap-2 text-sm font-medium rounded-lg transition-all ${aba === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                style={{ padding: '8px 18px' }}>
                {t.label}
                {t.badge > 0 && <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none">{t.badge}</span>}
              </button>
            ))}
          </div>
        ) : <div />}

        {isGestor && aba === 'todas' && (
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ padding: '8px 12px' }}>
            <option value="">Todos os estados</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovada">Aprovadas</option>
            <option value="rejeitada">Rejeitadas</option>
          </select>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : ausencias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '60px 24px' }}>
          <p className="text-sm text-slate-400">Sem ausências registadas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ausencias.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '6px' }}>
                    <span className="text-sm font-bold text-slate-800">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ESTADO_COR[a.estado]}`}>
                      {ESTADO_LABEL[a.estado]}
                    </span>
                  </div>
                  {a.utilizador && aba === 'todas' && (
                    <p className="text-sm text-slate-600" style={{ marginBottom: '4px' }}>
                      {a.utilizador.nome}
                      <span className="text-xs text-slate-400"> · {a.utilizador.role} · {a.utilizador.servico}</span>
                    </p>
                  )}
                  <p className="text-sm text-slate-700">
                    {new Date(a.dataInicio).toLocaleDateString('pt-PT')} → {new Date(a.dataFim).toLocaleDateString('pt-PT')}
                    <span className="text-xs text-slate-400" style={{ marginLeft: '8px' }}>
                      ({diasEntre(a.dataInicio, a.dataFim)} dia{diasEntre(a.dataInicio, a.dataFim) !== 1 ? 's' : ''})
                    </span>
                  </p>
                  {a.observacoes && <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{a.observacoes}</p>}
                  {a.aprovadoPor && (
                    <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                      {a.estado === 'aprovada' ? 'Aprovado' : 'Rejeitado'} por {a.aprovadoPor.nome}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {isGestor && a.estado === 'pendente' && (
                    <>
                      <button onClick={() => mutAprovar.mutate(a.id)}
                        className="text-xs font-medium text-green-600 hover:text-green-800 border border-green-200 hover:bg-green-50 rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>
                        Aprovar
                      </button>
                      <button onClick={() => mutRejeitar.mutate(a.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>
                        Rejeitar
                      </button>
                    </>
                  )}
                  {aba === 'minhas' && a.estado === 'pendente' && (
                    <button onClick={() => mutCancelar.mutate(a.id)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                      style={{ padding: '6px 14px' }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Pedir Ausência */}
      {modalNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalNova(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '480px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Pedir Ausência</h2>
              <button onClick={() => setModalNova(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
              <select value={novaTipo} onChange={e => setNovaTipo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Início</label>
                <input type="date" value={novaInicio} onChange={e => setNovaInicio(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Fim</label>
                <input type="date" value={novaFim} onChange={e => setNovaFim(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações (opcional)</label>
              <textarea value={novaObs} onChange={e => setNovaObs(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>

            {erroNova && <p className="text-xs text-red-500" style={{ marginBottom: '12px' }}>{erroNova}</p>}

            <div className="flex gap-3">
              <button onClick={() => setModalNova(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={criarAusencia} disabled={mutNova.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutNova.isPending ? 'A enviar...' : 'Submeter Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
