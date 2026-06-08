'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import api from '@/lib/api';

interface DoenteRisco {
  id: string;
  nome: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  dataAltaPrevista?: string;
  cama?: { numero: string; quarto: string; servico?: string };
  news2: number | null;
  ultimoSinalEm: string | null;
  altaPrevistHoje: boolean;
}

interface AlertaGlobal {
  id: string;
  tipo: string;
  mensagem: string;
  lido: boolean;
  urgencia: boolean;
  criadoEm: string;
  acusadoEm?: string;
  acusadoPor?: { id: string; nome: string };
  doente?: { id: string; nome: string; cama?: { numero: string; quarto: string } };
}

function news2Badge(score: number | null) {
  if (score === null) return <span className="text-xs text-slate-400">—</span>;
  if (score < 3)  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">{score}</span>;
  if (score < 5)  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">{score}</span>;
  if (score < 7)  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">{score}</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">{score}</span>;
}

function tempoDecorrido(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const estadoCor: Record<string, string> = {
  estavel:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  grave:         'bg-orange-50 text-orange-700 border-orange-200',
  critico:       'bg-red-50 text-red-700 border-red-200',
  alta_prevista: 'bg-blue-50 text-blue-700 border-blue-200',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const tipoAlertaLabel: Record<string, string> = {
  ia_watchdog: 'IA Watchdog',
  news2_critico: 'NEWS2 Crítico',
  sepsis: 'Sépsis',
  sos: 'SOS',
  escalacao_automatica: 'Escalação',
};

function StatCard({ label, value, sub, cor }: { label: string; value: string | number; sub?: string; cor?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl" style={{ padding: '20px 24px' }}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${cor ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function RiscoClinicoPage() {
  const { utilizador } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [ordenacao, setOrdenacao] = useState<'news2' | 'estado' | 'admissao'>('news2');

  const { data: doentes = [], isLoading: loadingD } = useQuery<DoenteRisco[]>({
    queryKey: ['doentes-risco'],
    queryFn: () => api.get('/doentes/risco-clinico').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: alertas = [], isLoading: loadingA } = useQuery<AlertaGlobal[]>({
    queryKey: ['alertas-globais'],
    queryFn: () => api.get('/alertas', { params: { lido: false, limit: 30 } }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const mutAcusar = useMutation({
    mutationFn: (id: string) => api.patch(`/alertas/${id}/acusar`, { utilizadorId: utilizador?.id }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alertas-globais'] }); toast.success('Alerta acusado'); },
    onError: () => toast.error('Erro ao acusar alerta'),
  });

  const doentesOrdenados = [...doentes].sort((a, b) => {
    if (ordenacao === 'news2') {
      const na = a.news2 ?? -1, nb = b.news2 ?? -1;
      return nb - na;
    }
    if (ordenacao === 'estado') {
      const ordem: Record<string, number> = { critico: 0, grave: 1, alta_prevista: 2, estavel: 3 };
      return (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9);
    }
    return new Date(b.dataAdmissao).getTime() - new Date(a.dataAdmissao).getTime();
  });

  const totalInternados = doentes.length;
  const news2Criticos = doentes.filter(d => d.news2 != null && d.news2 >= 7).length;
  const alertasPendentes = alertas.filter(a => !a.acusadoEm).length;
  const altasHoje = doentes.filter(d => d.altaPrevistHoje).length;

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard de Risco Clínico</h1>
            <p className="text-sm text-slate-500">Monitorização em tempo real · actualizado a cada minuto</p>
          </div>
        </div>
      </div>

      {/* Resumo — 4 cartões */}
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '32px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Total internados" value={totalInternados} sub="doentes activos" />
        <StatCard
          label="NEWS2 crítico (≥7)"
          value={news2Criticos}
          sub={news2Criticos > 0 ? 'resposta imediata' : 'nenhum'}
          cor={news2Criticos > 0 ? 'text-red-600' : 'text-slate-900'}
        />
        <StatCard
          label="Alertas pendentes"
          value={alertasPendentes}
          sub={alertasPendentes > 0 ? 'aguardam acuse' : 'tudo acusado'}
          cor={alertasPendentes > 0 ? 'text-amber-600' : 'text-slate-900'}
        />
        <StatCard label="Alta prevista hoje" value={altasHoje} sub="doentes" />
      </div>

      {/* Grid principal: tabela + alertas */}
      <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: '1fr 400px' }}>
        {/* Tabela doentes por NEWS2 */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100" style={{ padding: '16px 20px' }}>
            <h2 className="font-semibold text-slate-900">Doentes Internados</h2>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(['news2', 'estado', 'admissao'] as const).map(o => (
                <button key={o} onClick={() => setOrdenacao(o)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${ordenacao === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {o === 'news2' ? 'NEWS2' : o === 'estado' ? 'Estado' : 'Admissão'}
                </button>
              ))}
            </div>
          </div>

          {loadingD ? (
            <div className="flex justify-center" style={{ padding: '48px 0' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : doentesOrdenados.length === 0 ? (
            <div className="text-center text-slate-400 text-sm" style={{ padding: '48px 0' }}>Sem doentes internados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="font-medium" style={{ padding: '10px 20px' }}>Doente</th>
                    <th className="font-medium" style={{ padding: '10px 12px' }}>Cama</th>
                    <th className="font-medium text-center" style={{ padding: '10px 12px' }}>NEWS2</th>
                    <th className="font-medium" style={{ padding: '10px 12px' }}>Estado</th>
                    <th className="font-medium" style={{ padding: '10px 12px' }}>Diagnóstico</th>
                    <th className="font-medium" style={{ padding: '10px 12px' }}>Ú. sinal</th>
                    <th style={{ padding: '10px 12px' }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {doentesOrdenados.map(d => (
                    <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${d.news2 != null && d.news2 >= 7 ? 'bg-red-50/40' : ''}`}>
                      <td style={{ padding: '12px 20px' }}>
                        <div className="font-medium text-slate-900">{d.nome}</div>
                        {d.altaPrevistHoje && (
                          <span className="text-xs text-blue-600 font-medium">Alta hoje</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }} className="text-slate-600 whitespace-nowrap">
                        {d.cama ? `Q${d.cama.quarto} C${d.cama.numero}` : '—'}
                      </td>
                      <td style={{ padding: '12px' }} className="text-center">
                        {news2Badge(d.news2)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${estadoCor[d.estado] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {estadoLabel[d.estado] ?? d.estado}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }} className="text-slate-600 max-w-xs truncate">
                        {d.diagnosticoPrincipal ?? '—'}
                      </td>
                      <td style={{ padding: '12px' }} className="text-slate-400 text-xs whitespace-nowrap">
                        {d.ultimoSinalEm ? tempoDecorrido(d.ultimoSinalEm) : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Link href={`/doentes/${d.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas Watchdog pendentes */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ maxHeight: '620px', display: 'flex', flexDirection: 'column' }}>
          <div className="border-b border-slate-100 flex items-center justify-between" style={{ padding: '16px 20px', flexShrink: 0 }}>
            <h2 className="font-semibold text-slate-900">Alertas Pendentes</h2>
            {alertasPendentes > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {alertasPendentes}
              </span>
            )}
          </div>

          {loadingA ? (
            <div className="flex justify-center" style={{ padding: '48px 0' }}>
              <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400" style={{ padding: '48px 20px' }}>
              <svg className="w-10 h-10 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">Sem alertas pendentes</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {alertas.map(a => (
                <div key={a.id}
                  className={`border-b border-slate-50 last:border-0 ${a.acusadoEm ? 'opacity-50' : ''}`}
                  style={{ padding: '14px 20px' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          a.urgencia
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {tipoAlertaLabel[a.tipo] ?? a.tipo}
                        </span>
                        <span className="text-xs text-slate-400">{tempoDecorrido(a.criadoEm)}</span>
                        {a.acusadoPor && (
                          <span className="text-xs text-emerald-600">✓ {a.acusadoPor.nome}</span>
                        )}
                      </div>
                      {a.doente && (
                        <Link href={`/doentes/${a.doente.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-blue-600 truncate block">
                          {a.doente.nome}
                          {a.doente.cama && (
                            <span className="text-slate-400 font-normal text-xs ml-1.5">
                              Q{a.doente.cama.quarto} C{a.doente.cama.numero}
                            </span>
                          )}
                        </Link>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.mensagem}</p>
                    </div>
                    {!a.acusadoEm && (
                      <button
                        onClick={() => mutAcusar.mutate(a.id)}
                        disabled={mutAcusar.isPending}
                        className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                        style={{ padding: '4px 10px', flexShrink: 0 }}>
                        Acusar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
