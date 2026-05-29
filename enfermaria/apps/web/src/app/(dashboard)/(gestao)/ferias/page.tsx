'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  estado: string;
  observacoes?: string;
  utilizador?: { id: string; nome: string; role: string; servico?: string };
  aprovadoPor?: { id: string; nome: string };
}

interface SaldoFerias {
  direitoAnual: number;
  diasUsados: number;
  diasRestantes: number;
  anoAtual: number;
}

const ESTADO_COR: Record<string, string> = {
  pendente:  'bg-amber-50 text-amber-700 border-amber-200',
  aprovada:  'bg-green-50 text-green-700 border-green-200',
  rejeitada: 'bg-red-50 text-red-700 border-red-200',
};
const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Pendente', aprovada: 'Aprovada', rejeitada: 'Rejeitada',
};

function calcularDiasUteis(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  let count = 0;
  const d = new Date(inicio);
  const f = new Date(fim);
  while (d <= f) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export default function FeriasPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'ferias', dataInicio: '', dataFim: '', observacoes: '' });

  const TIPOS_AUSENCIA = [
    { value: 'ferias', label: 'Férias' },
    { value: 'baixa_medica', label: 'Baixa Médica' },
    { value: 'formacao', label: 'Formação' },
    { value: 'servico_externo', label: 'Serviço Externo' },
    { value: 'licenca', label: 'Licença' },
    { value: 'outro', label: 'Outro' },
  ];

  const { data: saldo } = useQuery<SaldoFerias>({
    queryKey: ['saldo-ferias'],
    queryFn: () => api.get('/rh/saldo-ferias').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: minhasFerias = [] } = useQuery<Ausencia[]>({
    queryKey: ['minhas-ferias'],
    queryFn: () => api.get('/rh/ausencias/minhas').then(r => r.data),
    staleTime: 30_000,
  });

  const { data: paraAprovar = [] } = useQuery<Ausencia[]>({
    queryKey: ['ferias-para-aprovar'],
    queryFn: () => api.get('/rh/ausencias/para-aprovar').then(r => r.data),
    staleTime: 30_000,
  });

  const mutPedir = useMutation({
    mutationFn: (dto: typeof form) => api.post('/rh/ausencias', dto),
    onSuccess: () => {
      toast.success('Pedido enviado com sucesso');
      qc.invalidateQueries({ queryKey: ['minhas-ferias'] });
      qc.invalidateQueries({ queryKey: ['saldo-ferias'] });
      setModal(false);
      setForm({ tipo: 'ferias', dataInicio: '', dataFim: '', observacoes: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao enviar pedido'),
  });

  const mutAprovar = useMutation({
    mutationFn: (id: string) => api.patch(`/rh/ausencias/${id}/aprovar`),
    onSuccess: () => { toast.success('Pedido aprovado'); qc.invalidateQueries({ queryKey: ['ferias-para-aprovar'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao aprovar pedido'),
  });

  const mutRejeitar = useMutation({
    mutationFn: (id: string) => api.patch(`/rh/ausencias/${id}/rejeitar`),
    onSuccess: () => { toast.success('Pedido rejeitado'); qc.invalidateQueries({ queryKey: ['ferias-para-aprovar'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao rejeitar pedido'),
  });

  const mutCancelar = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/ausencias/${id}`),
    onSuccess: () => {
      toast.success('Pedido cancelado');
      qc.invalidateQueries({ queryKey: ['minhas-ferias'] });
      qc.invalidateQueries({ queryKey: ['saldo-ferias'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao cancelar pedido'),
  });

  const diasSolicitados = calcularDiasUteis(form.dataInicio, form.dataFim);
  const pctUsado = saldo ? Math.min(100, (saldo.diasUsados / saldo.direitoAnual) * 100) : 0;
  const temPendentes = paraAprovar.length > 0;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">As Minhas Férias</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>Pedidos de férias e saldo disponível</p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          style={{ padding: '10px 18px' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Pedir Ausência
        </button>
      </div>

      {/* Saldo */}
      {saldo && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
            <div>
              <p className="text-sm font-semibold text-slate-700">Saldo de Férias {saldo.anoAtual}</p>
              <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{saldo.diasRestantes} dias disponíveis de {saldo.direitoAnual}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-700">{saldo.diasRestantes}</p>
              <p className="text-xs text-slate-400">dias restantes</p>
            </div>
          </div>
          <div className="bg-slate-100 rounded-full" style={{ height: '10px' }}>
            <div className="bg-blue-500 rounded-full transition-all" style={{ width: `${pctUsado}%`, height: '10px' }} />
          </div>
          <div className="flex justify-between" style={{ marginTop: '6px' }}>
            <span className="text-xs text-slate-400">{saldo.diasUsados} usados</span>
            <span className="text-xs text-slate-400">{saldo.direitoAnual} direito anual</span>
          </div>
        </div>
      )}

      {/* Pendentes para aprovar (só para chefes) */}
      {temPendentes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl" style={{ padding: '20px 24px', marginBottom: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{paraAprovar.length}</span>
            <p className="text-sm font-semibold text-amber-800">Pedidos de Férias a Aprovar</p>
          </div>
          <div className="flex flex-col gap-3">
            {paraAprovar.map(a => {
              const dias = calcularDiasUteis(a.dataInicio, a.dataFim);
              return (
                <div key={a.id} className="bg-white rounded-xl border border-amber-100 flex items-center justify-between gap-4" style={{ padding: '14px 18px' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{a.utilizador?.nome}</p>
                    <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>
                      {new Date(a.dataInicio).toLocaleDateString('pt-PT')} → {new Date(a.dataFim).toLocaleDateString('pt-PT')} · {dias} dias úteis
                    </p>
                    {a.observacoes && <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{a.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => mutAprovar.mutate(a.id)}
                      className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      style={{ padding: '7px 14px' }}>Aprovar</button>
                    <button onClick={() => mutRejeitar.mutate(a.id)}
                      className="text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors"
                      style={{ padding: '7px 12px' }}>Rejeitar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Minhas férias */}
      <h2 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>Os Meus Pedidos</h2>
      {minhasFerias.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '48px' }}>
          <p className="text-sm text-slate-400">Sem pedidos de férias registados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {minhasFerias.map(a => {
            const dias = calcularDiasUteis(a.dataInicio, a.dataFim);
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4" style={{ padding: '16px 20px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '4px' }}>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(a.dataInicio).toLocaleDateString('pt-PT')} → {new Date(a.dataFim).toLocaleDateString('pt-PT')}
                    </p>
                    <span className="text-xs text-slate-400">{dias} dias úteis</span>
                    <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${ESTADO_COR[a.estado]}`}>
                      {ESTADO_LABEL[a.estado]}
                    </span>
                  </div>
                  {a.aprovadoPor && (
                    <p className="text-xs text-slate-400">
                      {a.estado === 'aprovada' ? 'Aprovado' : 'Processado'} por {a.aprovadoPor.nome}
                    </p>
                  )}
                  {a.observacoes && <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{a.observacoes}</p>}
                </div>
                {a.estado === 'pendente' && (
                  <button onClick={() => mutCancelar.mutate(a.id)}
                    className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    style={{ padding: '4px 8px' }}>
                    Cancelar pedido
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Pedir Férias */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ padding: '24px' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full" style={{ maxWidth: '440px', padding: '28px' }}>
            <h2 className="text-lg font-bold text-slate-900" style={{ marginBottom: '20px' }}>Pedir Ausência</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px', marginTop: '6px' }}>
                  {TIPOS_AUSENCIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Início</label>
                  <input type="date" value={form.dataInicio}
                    onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Data Fim</label>
                  <input type="date" value={form.dataFim}
                    onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ padding: '10px 12px' }} />
                </div>
              </div>

              {diasSolicitados > 0 && (
                <div className={`rounded-xl border text-sm font-medium text-center ${diasSolicitados > (saldo?.diasRestantes ?? 22) ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}
                  style={{ padding: '12px' }}>
                  {diasSolicitados} dias úteis solicitados
                  {saldo && ` · ${saldo.diasRestantes} disponíveis`}
                  {diasSolicitados > (saldo?.diasRestantes ?? 22) && ' ⚠ Excede saldo disponível'}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Observações (opcional)</label>
                <textarea value={form.observacoes} rows={2}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ padding: '10px 12px' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2" style={{ marginTop: '24px' }}>
              <button onClick={() => setModal(false)}
                className="text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '9px 18px' }}>Cancelar</button>
              <button
                onClick={() => mutPedir.mutate(form)}
                disabled={!form.dataInicio || !form.dataFim || mutPedir.isPending}
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '9px 20px' }}>
                {mutPedir.isPending ? 'A enviar...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
