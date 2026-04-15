'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

interface Ocupacao {
  total: number;
  ocupadas: number;
  livres: number;
  emLimpeza: number;
  reservadas: number;
}

interface Analytics {
  ocupacaoDiaria: Array<{ data: string; total: number; ocupadas: number }>;
  cargaEnfermeiros: Array<{ nome: string; numDoentes: number; tarefasPendentes: number }>;
  tarefasHoje: { total: number; concluidas: number; urgentesAtraso: number };
}

interface Doente {
  id: string;
  nome: string;
  estado: string;
  diagnosticoPrincipal: string;
  dataAltaPrevista?: string;
  cama: { numero: string; quarto: string };
}

const estadoCor: Record<string, { badge: string; dot: string }> = {
  estavel:      { badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  grave:        { badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',   dot: 'bg-orange-500' },
  critico:      { badge: 'bg-red-50 text-red-700 ring-1 ring-red-200',            dot: 'bg-red-500' },
  alta_prevista:{ badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',         dot: 'bg-blue-500' },
};

const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const statCards = [
  { key: 'total',     label: 'Total de Camas',   color: 'bg-slate-800',   text: 'text-slate-800' },
  { key: 'ocupadas',  label: 'Camas Ocupadas',   color: 'bg-red-500',     text: 'text-red-600' },
  { key: 'livres',    label: 'Camas Livres',     color: 'bg-emerald-500', text: 'text-emerald-600' },
  { key: 'emLimpeza', label: 'Em Limpeza',       color: 'bg-amber-500',   text: 'text-amber-600' },
];

const ROLES_ANALYTICS = ['administrativo', 'chefe_enfermeiros', 'chefe_turno', 'chefe_medicos'];

export default function DashboardPage() {
  const { utilizador } = useAuth();
  const [ocupacao, setOcupacao] = useState<Ocupacao | null>(null);
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ocup, doc] = await Promise.all([api.get('/camas/ocupacao'), api.get('/doentes?todos=true')]);
        setOcupacao(ocup.data);
        setDoentes(doc.data);
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!utilizador || !ROLES_ANALYTICS.includes(utilizador.role)) return;
    api.get<Analytics>('/dashboard/analytics').then((r) => setAnalytics(r.data)).catch(() => {});
  }, [utilizador]);

  const altasHoje = doentes.filter((d) =>
    d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString()
  );
  const criticos = doentes.filter((d) => d.estado === 'critico');
  const hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  const ocupacaoMap: Record<string, number> = {
    total: ocupacao?.total ?? 0,
    ocupadas: ocupacao?.ocupadas ?? 0,
    livres: ocupacao?.livres ?? 0,
    emLimpeza: ocupacao?.emLimpeza ?? 0,
  };

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '40px' }} className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 capitalize mb-1">{hoje}</p>
          <h1 className="text-3xl font-bold text-slate-900">
            Bom dia, {utilizador?.nome?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm" style={{ marginTop: '6px' }}>Aqui está o resumo da enfermaria</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl" style={{ padding: '8px 16px' }}>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-700 text-sm font-semibold">Sistema Online</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar dados...</span>
        </div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-4 gap-5" style={{ marginBottom: '40px' }}>
            {statCards.map(({ key, label, color, text }) => (
              <div key={key} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
                <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
                  <span className="text-white font-bold text-lg">{ocupacaoMap[key]}</span>
                </div>
                <p className="text-sm text-slate-500 mb-1" style={{ marginTop: '10px' }}>{label}</p>
                <p className={`text-3xl font-bold ${text}`}>{ocupacaoMap[key]}</p>
                {key === 'ocupadas' && (
                  <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                    {ocupacao?.total ? Math.round((ocupacao.ocupadas / ocupacao.total) * 100) : 0}% de ocupação
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ── Painéis intermédios ── */}
          <div className="grid grid-cols-3 gap-5" style={{ marginBottom: '40px' }}>

            {/* Críticos */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between" style={{ padding: '20px 24px', borderBottom: '1px solid #f8fafc' }}>
                <h2 className="font-semibold text-slate-800 text-sm">Doentes Críticos</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${criticos.length > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                  {criticos.length}
                </span>
              </div>
              {criticos.length === 0 ? (
                <div className="flex flex-col items-center justify-center" style={{ padding: '40px 24px' }}>
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center" style={{ marginBottom: '12px' }}>
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-sm">Sem doentes críticos</p>
                </div>
              ) : criticos.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3" style={{ padding: '14px 24px', borderBottom: '1px solid #f8fafc' }}>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{d.nome}</p>
                    <p className="text-slate-400 text-xs" style={{ marginTop: '2px' }}>Cama {d.cama.quarto}/{d.cama.numero}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${estadoCor[d.estado].badge}`}>
                    {estadoLabel[d.estado]}
                  </span>
                </div>
              ))}
            </div>

            {/* Altas hoje */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between" style={{ padding: '20px 24px', borderBottom: '1px solid #f8fafc' }}>
                <h2 className="font-semibold text-slate-800 text-sm">Altas Previstas Hoje</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${altasHoje.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                  {altasHoje.length}
                </span>
              </div>
              {altasHoje.length === 0 ? (
                <div className="flex flex-col items-center justify-center" style={{ padding: '40px 24px' }}>
                  <p className="text-slate-400 text-sm">Sem altas previstas para hoje</p>
                </div>
              ) : altasHoje.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3" style={{ padding: '14px 24px', borderBottom: '1px solid #f8fafc' }}>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{d.nome}</p>
                    <p className="text-slate-400 text-xs truncate" style={{ marginTop: '2px' }}>{d.diagnosticoPrincipal}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${estadoCor[d.estado].badge}`}>
                    {estadoLabel[d.estado]}
                  </span>
                </div>
              ))}
            </div>

            {/* Resumo global */}
            <div
              className="rounded-2xl shadow-lg flex flex-col justify-between overflow-hidden"
              style={{ padding: '28px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
            >
              <div>
                <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Resumo Global</p>
                <p className="text-5xl font-bold text-white" style={{ marginBottom: '4px' }}>{doentes.length}</p>
                <p className="text-blue-200 text-sm">doentes internados</p>
              </div>
              <div style={{ marginTop: '32px' }} className="space-y-3">
                {(['estavel', 'grave', 'critico', 'alta_prevista'] as const).map((e) => (
                  <div key={e} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${estadoCor[e].dot}`} />
                      <span className="text-blue-100">{estadoLabel[e]}</span>
                    </div>
                    <span className="font-semibold text-white">{doentes.filter((d) => d.estado === e).length}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Analytics (só para gestão) ── */}
          {utilizador && ROLES_ANALYTICS.includes(utilizador.role) && analytics && (
            <div style={{ marginBottom: '40px' }}>
              <h2 className="text-lg font-semibold text-slate-800" style={{ marginBottom: '20px' }}>Análises e Métricas</h2>

              {/* Linha 1: gráficos */}
              <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '20px' }}>

                {/* Ocupação últimas 2 semanas */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
                  <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '20px' }}>Ocupação — Últimas 2 semanas</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analytics.ocupacaoDiaria} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradOcup" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                      />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <Tooltip
                        formatter={(v, name) => [v, name === 'ocupadas' ? 'Ocupadas' : 'Total']}
                        labelFormatter={(l) => new Date(l).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })}
                      />
                      <Legend formatter={(v) => v === 'ocupadas' ? 'Ocupadas' : 'Total'} />
                      <Area type="monotone" dataKey="total" stroke="#e2e8f0" fill="none" strokeDasharray="4 2" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="ocupadas" stroke="#2563eb" fill="url(#gradOcup)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Carga por enfermeiro */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
                  <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '20px' }}>Carga por Enfermeiro — Turno Atual</p>
                  {analytics.cargaEnfermeiros.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Sem atribuições no turno atual</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.cargaEnfermeiros} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          width={100}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickFormatter={(v: string) => v.split(' ')[0]}
                        />
                        <Tooltip formatter={(v, name) => [v, name === 'numDoentes' ? 'Doentes' : 'Tarefas pendentes']} />
                        <Legend formatter={(v) => v === 'numDoentes' ? 'Doentes' : 'Tarefas pendentes'} />
                        <Bar dataKey="numDoentes" fill="#2563eb" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="tarefasPendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Linha 2: tarefas hoje */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                  <p className="text-sm font-semibold text-slate-700">Tarefas de Hoje</p>
                  {analytics.tarefasHoje.urgentesAtraso > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full" style={{ padding: '4px 12px' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {analytics.tarefasHoje.urgentesAtraso} urgente{analytics.tarefasHoje.urgentesAtraso !== 1 ? 's' : ''} em atraso
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${analytics.tarefasHoje.total > 0 ? Math.round((analytics.tarefasHoje.concluidas / analytics.tarefasHoje.total) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 shrink-0">
                    {analytics.tarefasHoje.concluidas}/{analytics.tarefasHoje.total} concluídas
                    {analytics.tarefasHoje.total > 0 && (
                      <span className="text-slate-400 font-normal">
                        {' '}({Math.round((analytics.tarefasHoje.concluidas / analytics.tarefasHoje.total) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Tabela ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between" style={{ padding: '20px 28px', borderBottom: '1px solid #f8fafc' }}>
              <h2 className="font-semibold text-slate-800">Todos os Doentes Internados</h2>
              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">{doentes.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Doente', 'Cama', 'Diagnóstico', 'Estado', 'Alta Prevista'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ padding: '14px 28px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doentes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-400 text-sm" style={{ padding: '56px' }}>
                      Sem doentes internados
                    </td>
                  </tr>
                ) : doentes.map((d, i) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50 transition-colors"
                    style={{ borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}
                  >
                    <td style={{ padding: '16px 28px' }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado].dot}`} />
                        <span className="font-medium text-slate-900">{d.nome}</span>
                      </div>
                    </td>
                    <td className="text-slate-500" style={{ padding: '16px 28px' }}>Quarto {d.cama.quarto} / Cama {d.cama.numero}</td>
                    <td className="text-slate-500 max-w-xs truncate" style={{ padding: '16px 28px' }}>{d.diagnosticoPrincipal}</td>
                    <td style={{ padding: '16px 28px' }}>
                      <span className={`text-xs font-medium rounded-lg ${estadoCor[d.estado].badge}`} style={{ padding: '5px 10px' }}>
                        {estadoLabel[d.estado]}
                      </span>
                    </td>
                    <td className="text-slate-500" style={{ padding: '16px 28px' }}>
                      {d.dataAltaPrevista ? new Date(d.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
