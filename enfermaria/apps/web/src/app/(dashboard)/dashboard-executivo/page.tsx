'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';

interface DashExec {
  doentes: { internados: number; ambulatorio: number; pendenteCama: number; mediaInternamento: number };
  camas: { total: number; ocupadas: number; livres: number; limpeza: number; reservadas: number; taxaOcupacao: number };
  faturacao: { totalMes: number; pagoMes: number; pendenteMes: number; porCobertura: { sns: number; seguro: number; particular: number } };
  consultasHoje: { total: number; faltaram: number; taxaNoShow: number };
  trocasPendentes: number;
  pessoal: { utilizadoresPorRole: Record<string, number> };
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function BigStat({ label, value, sub, cor }: { label: string; value: string | number; sub?: string; cor: string }) {
  const cores: Record<string, { bg: string; text: string; subtext: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   subtext: 'text-blue-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  subtext: 'text-green-500' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  subtext: 'text-amber-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    subtext: 'text-red-500' },
    slate:  { bg: 'bg-slate-50',  text: 'text-slate-700',  subtext: 'text-slate-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', subtext: 'text-indigo-400' },
  };
  const c = cores[cor] ?? cores.slate;
  return (
    <div className={`${c.bg} rounded-2xl flex flex-col`} style={{ padding: '20px 24px' }}>
      <span className={`text-2xl font-bold ${c.text}`}>{value}</span>
      <span className={`text-xs font-semibold ${c.text} opacity-80`} style={{ marginTop: '4px' }}>{label}</span>
      {sub && <span className={`text-xs ${c.subtext}`} style={{ marginTop: '2px' }}>{sub}</span>}
    </div>
  );
}

function OcupacaoBar({ ocupadas, livres, limpeza, reservadas, total }: {
  ocupadas: number; livres: number; limpeza: number; reservadas: number; total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3" style={{ marginBottom: '10px' }}>
        <div className="bg-indigo-500 transition-all" style={{ width: pct(ocupadas) }} title={`Ocupadas: ${ocupadas}`} />
        <div className="bg-amber-400 transition-all" style={{ width: pct(limpeza) }} title={`Em limpeza: ${limpeza}`} />
        <div className="bg-blue-300 transition-all" style={{ width: pct(reservadas) }} title={`Reservadas: ${reservadas}`} />
        <div className="bg-slate-100 transition-all flex-1" title={`Livres: ${livres}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[
          { cor: 'bg-indigo-500', label: 'Ocupadas', n: ocupadas },
          { cor: 'bg-amber-400', label: 'Em Limpeza', n: limpeza },
          { cor: 'bg-blue-300', label: 'Reservadas', n: reservadas },
          { cor: 'bg-slate-200', label: 'Livres', n: livres },
        ].map(i => (
          <div key={i.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${i.cor}`} />
            <span className="text-xs text-slate-600">{i.label}: <strong>{i.n}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  medico: 'Médicos', enfermeiro: 'Enfermeiros', auxiliar: 'Auxiliares',
  administrativo: 'Administrativos', farmaceutico: 'Farmacêuticos',
  tecnico_saude: 'Técnicos de Saúde', operacional: 'Operacionais',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

export default function DashboardExecutivo() {
  const qc = useQueryClient();
  const { data: dados, isLoading: loading, dataUpdatedAt } = useQuery<DashExec>({
    queryKey: ['dashboard-executivo'],
    queryFn: () => api.get('/dashboard/executivo').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
          <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>
            Visão integrada do hospital em tempo real
            {lastUpdate && (
              <span className="text-slate-400"> · Atualizado às {lastUpdate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-executivo'] })} className="text-slate-400 hover:text-slate-700 transition-colors" title="Atualizar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <svg className="animate-spin w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : !dados ? (
        <p className="text-sm text-slate-400">Erro ao carregar dados.</p>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Doentes & Camas ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '20px' }}>Internamento & Ocupação</h2>
            <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
              <BigStat label="Internados" value={dados.doentes.internados} cor="indigo" />
              <BigStat label="Ambulatório" value={dados.doentes.ambulatorio} cor="blue" />
              <BigStat label="Aguardam Cama" value={dados.doentes.pendenteCama} cor="amber" />
              <BigStat label="Internamento Médio" value={`${dados.doentes.mediaInternamento}d`} sub="dias de permanência" cor="slate" />
            </div>
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <span className="text-sm font-semibold text-slate-700">Camas ({dados.camas.total} total)</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  dados.camas.taxaOcupacao >= 90 ? 'bg-red-50 text-red-600' :
                  dados.camas.taxaOcupacao >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                }`}>
                  {dados.camas.taxaOcupacao}% ocupação
                </span>
              </div>
              <OcupacaoBar
                ocupadas={dados.camas.ocupadas}
                livres={dados.camas.livres}
                limpeza={dados.camas.limpeza}
                reservadas={dados.camas.reservadas}
                total={dados.camas.total}
              />
            </div>
          </div>

          {/* ── Faturação ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '20px' }}>Faturação — Mês Atual</h2>
            <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '20px' }}>
              <BigStat label="Total Faturado" value={fmt(dados.faturacao.totalMes)} cor="indigo" />
              <BigStat label="Recebido" value={fmt(dados.faturacao.pagoMes)} cor="green" />
              <BigStat label="Pendente de Cobrança" value={fmt(dados.faturacao.pendenteMes)} cor={dados.faturacao.pendenteMes > 0 ? 'amber' : 'slate'} />
            </div>
            <div className="flex gap-6">
              {[
                { key: 'sns', label: 'SNS', cor: 'text-blue-600 bg-blue-50' },
                { key: 'seguro', label: 'Seguro', cor: 'text-purple-600 bg-purple-50' },
                { key: 'particular', label: 'Particular', cor: 'text-green-600 bg-green-50' },
              ].map(c => (
                <div key={c.key} className={`flex-1 rounded-xl ${c.cor.split(' ')[1]} flex flex-col items-center`} style={{ padding: '14px' }}>
                  <span className={`text-lg font-bold ${c.cor.split(' ')[0]}`}>
                    {fmt(dados.faturacao.porCobertura[c.key as keyof typeof dados.faturacao.porCobertura])}
                  </span>
                  <span className={`text-xs font-medium ${c.cor.split(' ')[0]} opacity-80`}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Consultas & Operacional ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '16px' }}>Consultas Hoje</h2>
              <div className="grid grid-cols-3 gap-3">
                <BigStat label="Agendadas" value={dados.consultasHoje.total} cor="slate" />
                <BigStat label="Faltas" value={dados.consultasHoje.faltaram} cor={dados.consultasHoje.faltaram > 3 ? 'red' : 'slate'} />
                <BigStat label="Taxa No-show" value={`${dados.consultasHoje.taxaNoShow}%`} cor={dados.consultasHoje.taxaNoShow > 20 ? 'amber' : 'green'} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '16px' }}>Operacional</h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50" style={{ padding: '12px 16px' }}>
                  <span className="text-sm text-slate-600">Trocas de Turno Pendentes</span>
                  <span className={`text-sm font-bold ${dados.trocasPendentes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {dados.trocasPendentes}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Pessoal ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '16px' }}>Pessoal Ativo</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(dados.pessoal.utilizadoresPorRole)
                .sort((a, b) => b[1] - a[1])
                .map(([role, total]) => (
                  <div key={role} className="bg-slate-50 rounded-xl flex items-center gap-3" style={{ padding: '10px 16px' }}>
                    <span className="text-lg font-bold text-slate-800">{total}</span>
                    <span className="text-xs font-medium text-slate-500">{ROLE_LABEL[role] ?? role}</span>
                  </div>
                ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
