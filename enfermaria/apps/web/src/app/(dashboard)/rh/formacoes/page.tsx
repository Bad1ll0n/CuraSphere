'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../lib/auth-context';
import api from '../../../../lib/api';
import { useToast } from '../../../../components/toast';

interface Formacao {
  id: string;
  nome: string;
  dataRealizacao: string;
  dataExpiracao?: string;
  entidade?: string;
  obrigatoria: boolean;
  criadoEm: string;
  utilizador?: { id: string; nome: string; role: string; servico: string };
}

export default function FormacoesPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [aba, setAba] = useState<'todas' | 'minhas'>('minhas');
  const [modalNova, setModalNova] = useState(false);
  const [novaUtilizadorId, setNovaUtilizadorId] = useState('');
  const [novaNome, setNovaNome] = useState('');
  const [novaData, setNovaData] = useState('');
  const [novaExpiracao, setNovaExpiracao] = useState('');
  const [novaEntidade, setNovaEntidade] = useState('');
  const [novaObrigatoria, setNovaObrigatoria] = useState(false);

  const role = utilizador?.role ?? '';
  const isGestor = ['administrativo', 'direcao'].includes(role);

  const { data: formacoes = [], isLoading: loading } = useQuery<Formacao[]>({
    queryKey: ['formacoes', aba],
    queryFn: () => {
      const url = aba === 'todas' ? '/rh/formacoes' : '/rh/formacoes/minhas';
      return api.get(url).then(r => r.data).catch(() => []);
    },
    staleTime: 30_000,
  });

  const { data: utilizadoresLista = [] } = useQuery<{ id: string; nome: string; role: string }[]>({
    queryKey: ['utilizadores-lista'],
    queryFn: () => api.get('/utilizadores').then(r => r.data?.data ?? r.data ?? []).catch(() => []),
    enabled: modalNova && isGestor,
    staleTime: 300_000,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ['formacoes'] });

  const mutApagar = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/formacoes/${id}`),
    onSuccess: () => { toast.success('Formação removida'); invalidar(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao remover formação'),
  });
  const mutNova = useMutation({
    mutationFn: (body: object) => api.post('/rh/formacoes', body),
    onSuccess: () => {
      toast.success('Formação registada com sucesso');
      setModalNova(false);
      setNovaNome(''); setNovaData(''); setNovaExpiracao(''); setNovaEntidade(''); setNovaObrigatoria(false);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao registar formação'),
  });

  const criarFormacao = () => {
    if (!novaNome.trim() || !novaData) return;
    mutNova.mutate({
      utilizadorId: novaUtilizadorId || utilizador?.id,
      nome: novaNome, dataRealizacao: novaData,
      dataExpiracao: novaExpiracao || undefined,
      entidade: novaEntidade || undefined,
      obrigatoria: novaObrigatoria,
    });
  };

  const hoje = new Date();
  const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  function statusExpiracao(dataExp?: string): { label: string; cor: string } | null {
    if (!dataExp) return null;
    const d = new Date(dataExp);
    if (d < hoje) return { label: 'Expirado', cor: 'bg-red-50 text-red-600 border-red-200' };
    if (d <= em30dias) return { label: 'Expira em breve', cor: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: `Válido até ${d.toLocaleDateString('pt-PT')}`, cor: 'bg-green-50 text-green-700 border-green-200' };
  }

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
            <h1 className="text-2xl font-bold text-slate-900">Formações</h1>
            <p className="text-sm text-slate-500" style={{ marginTop: '2px' }}>Registo de formações e certificações</p>
          </div>
        </div>
        {isGestor && (
          <button onClick={() => setModalNova(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            style={{ padding: '10px 18px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registar Formação
          </button>
        )}
      </div>

      {/* Tabs */}
      {isGestor && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1" style={{ marginBottom: '20px', width: 'fit-content' }}>
          {([{ key: 'minhas', label: 'As Minhas' }, { key: 'todas', label: 'Toda a Equipa' }] as const).map(t => (
            <button key={t.key} onClick={() => setAba(t.key)}
              className={`text-sm font-medium rounded-lg transition-all ${aba === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              style={{ padding: '8px 18px' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : formacoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center" style={{ padding: '60px 24px' }}>
          <p className="text-sm text-slate-400">Sem formações registadas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {formacoes.map(f => {
            const exp = statusExpiracao(f.dataExpiracao);
            return (
              <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '5px' }}>
                      <span className="text-sm font-bold text-slate-800">{f.nome}</span>
                      {f.obrigatoria && (
                        <span className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">Obrigatória</span>
                      )}
                      {exp && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${exp.cor}`}>{exp.label}</span>
                      )}
                    </div>
                    {f.utilizador && aba === 'todas' && (
                      <p className="text-xs text-slate-500" style={{ marginBottom: '3px' }}>
                        {f.utilizador.nome} · {f.utilizador.role}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      Realizada em {new Date(f.dataRealizacao).toLocaleDateString('pt-PT')}
                      {f.entidade && ` · ${f.entidade}`}
                    </p>
                  </div>
                  {isGestor && (
                    <button onClick={() => mutApagar.mutate(f.id)}
                      className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 rounded-lg transition-colors"
                      style={{ padding: '5px 10px' }}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Registar Formação */}
      {modalNova && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalNova(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Formação</h2>
              <button onClick={() => setModalNova(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Colaborador</label>
              <select value={novaUtilizadorId} onChange={e => setNovaUtilizadorId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar...</option>
                {utilizadoresLista.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.role})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome da Formação</label>
              <input type="text" value={novaNome} onChange={e => setNovaNome(e.target.value)}
                placeholder="Ex: BLS, Higiene das Mãos, ACLS..."
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }} />
            </div>

            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data de Realização</label>
                <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Data de Expiração</label>
                <input type="date" value={novaExpiracao} onChange={e => setNovaExpiracao(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ padding: '10px 14px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Entidade Formadora (opcional)</label>
              <input type="text" value={novaEntidade} onChange={e => setNovaEntidade(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ padding: '10px 14px' }} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer" style={{ marginBottom: '20px' }}>
              <input type="checkbox" checked={novaObrigatoria} onChange={e => setNovaObrigatoria(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-sm font-medium text-slate-700">Formação obrigatória</span>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setModalNova(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={criarFormacao} disabled={mutNova.isPending || !novaNome.trim() || !novaData}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {mutNova.isPending ? 'A guardar...' : 'Registar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
