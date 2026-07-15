'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { SkeletonCard } from '@/components/skeleton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface DashExec {
  doentes: { internados: number; ambulatorio: number; pendenteCama: number; mediaInternamento: number };
  camas: { total: number; ocupadas: number; livres: number; limpeza: number; reservadas: number; taxaOcupacao: number };
  faturacao: { totalMes: number; pagoMes: number; pendenteMes: number; porCobertura: { sns: number; seguro: number; particular: number } };
  consultasHoje: { total: number; faltaram: number; taxaNoShow: number };
  trocasPendentes: number;
  pessoal: { utilizadoresPorRole: Record<string, number> };
  tendenciaOcupacao: { data: string; ocupadas: number; total: number; taxa: number }[];
  tendenciaFaturacao: { mes: string; total: number }[];
  urgenciaHoje: { total: number; emAtendimento: number; aguardaAlta: number; alta: number };
  cirurgiasMes: { total: number; concluidas: number; emCurso: number; canceladas: number };
  ausenciasAtivas: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function fmtK(v: number) {
  if (v >= 1000) return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 0 }).format(v);
  return fmt(v);
}

function BigStat({ label, value, sub, cor }: { label: string; value: string | number; sub?: string; cor: string }) {
  const cores: Record<string, { bg: string; text: string; subtext: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   subtext: 'text-blue-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  subtext: 'text-green-500' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  subtext: 'text-amber-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    subtext: 'text-red-500' },
    slate:  { bg: 'bg-slate-50',  text: 'text-slate-700',  subtext: 'text-slate-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', subtext: 'text-indigo-400' },
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   subtext: 'text-teal-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', subtext: 'text-purple-500' },
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

function CustomTooltipOcupacao({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md text-xs" style={{ padding: '10px 14px' }}>
      <p className="font-semibold text-slate-700" style={{ marginBottom: '4px' }}>{label}</p>
      <p className="text-indigo-600">Ocupadas: <strong>{payload[0]?.value}</strong></p>
      <p className="text-slate-500">Taxa: <strong>{payload[0]?.payload?.taxa}%</strong></p>
    </div>
  );
}

function CustomTooltipFaturacao({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md text-xs" style={{ padding: '10px 14px' }}>
      <p className="font-semibold text-slate-700" style={{ marginBottom: '4px' }}>{label}</p>
      <p className="text-green-600">Total: <strong>{fmt(payload[0]?.value ?? 0)}</strong></p>
    </div>
  );
}

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
    <div style={{ padding: '32px 40px', maxWidth: '1200px', margin: '0 auto' }}>
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
        <div className="flex items-center gap-3">
          <a
            href="/api/doentes/export"
            download="doentes.csv"
            onClick={(e) => { e.preventDefault(); window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'}/v1/doentes/export`; }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            style={{ padding: '6px 12px' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar CSV
          </a>
          <button onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-executivo'] })} className="text-slate-400 hover:text-slate-700 transition-colors" title="Atualizar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }} aria-busy="true" aria-label="A carregar dashboard">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
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

          {/* ── Tendência Ocupação 14 dias ── */}
          {dados.tendenciaOcupacao?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '20px' }}>Tendência de Ocupação — 14 dias</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dados.tendenciaOcupacao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradOcup" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltipOcupacao />} />
                  <Area type="monotone" dataKey="ocupadas" stroke="#6366f1" strokeWidth={2} fill="url(#gradOcup)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

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

          {/* ── Tendência Faturação 6 meses ── */}
          {dados.tendenciaFaturacao?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '20px' }}>Faturação — 6 Meses</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dados.tendenciaFaturacao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => fmtK(v)} width={72} />
                  <Tooltip content={<CustomTooltipFaturacao />} />
                  <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Consultas & Urgência ── */}
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
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '16px' }}>Urgência Hoje</h2>
              {dados.urgenciaHoje ? (
                <div className="grid grid-cols-2 gap-3">
                  <BigStat label="Total Episódios" value={dados.urgenciaHoje.total} cor="slate" />
                  <BigStat label="Em Atendimento" value={dados.urgenciaHoje.emAtendimento} cor="amber" />
                  <BigStat label="Aguarda Alta" value={dados.urgenciaHoje.aguardaAlta} cor="blue" />
                  <BigStat label="Alta Dada" value={dados.urgenciaHoje.alta} cor="green" />
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sem dados de urgência.</p>
              )}
            </div>
          </div>

          {/* ── Bloco Operatório & Operacional ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '16px' }}>Bloco Operatório — Mês</h2>
              {dados.cirurgiasMes ? (
                <div className="grid grid-cols-2 gap-3">
                  <BigStat label="Total Cirurgias" value={dados.cirurgiasMes.total} cor="slate" />
                  <BigStat label="Concluídas" value={dados.cirurgiasMes.concluidas} cor="green" />
                  <BigStat label="Em Curso" value={dados.cirurgiasMes.emCurso} cor="indigo" />
                  <BigStat label="Canceladas" value={dados.cirurgiasMes.canceladas} cor={dados.cirurgiasMes.canceladas > 0 ? 'red' : 'slate'} />
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sem dados de cirurgias.</p>
              )}
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
                <div className="flex items-center justify-between rounded-xl bg-slate-50" style={{ padding: '12px 16px' }}>
                  <span className="text-sm text-slate-600">Ausências Activas</span>
                  <span className={`text-sm font-bold ${(dados.ausenciasAtivas ?? 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {dados.ausenciasAtivas ?? 0}
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
