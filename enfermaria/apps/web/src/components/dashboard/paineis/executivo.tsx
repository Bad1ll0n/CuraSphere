'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StatCard, SecaoTitulo, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardExecutivo({ utilizador }: { utilizador: any }) {
  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-executivo'],
    queryFn: async () => {
      const [kp, ps, u, a, oc, corr] = await Promise.all([
        api.get('/dashboard/executivo').catch(() => ({ data: null })),
        api.get('/dashboard/pessoal').catch(() => ({ data: null })),
        api.get('/urgencia/dashboard').catch(() => ({ data: null })),
        api.get('/dashboard/analytics').catch(() => ({ data: null })),
        api.get('/outcomes/dashboard').catch(() => ({ data: null })),
        api.get('/ai-clinico/outcomes-correlation').catch(() => ({ data: null })),
      ]);
      return { kpis: kp.data, pessoal: ps.data, urgencia: u.data, analytics: a.data, outcomes: oc.data, correlacaoAI: corr.data };
    },
    staleTime: 60_000,
  });

  const kpis = (data as any).kpis ?? null;
  const pessoal = (data as any).pessoal ?? null;
  const urgencia = (data as any).urgencia ?? null;
  const analytics = (data as any).analytics ?? null;
  const outcomes = (data as any).outcomes ?? null;
  const correlacaoAI = (data as any).correlacaoAI ?? null;
  const pct = kpis?.camas?.taxaOcupacao ?? 0;

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />

      {/* KPI Cards — Linha 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4" style={{ marginBottom: '28px' }}>
        <StatCard label="Ocupação de Camas" value={`${pct}%`} sub={`${kpis?.camas?.ocupadas ?? 0}/${kpis?.camas?.total ?? 0} camas`} color={pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'} />
        <StatCard label="Internados" value={kpis?.doentes?.internados ?? 0} sub={`Avg ${kpis?.doentes?.mediaInternamento ?? 0}d internamento`} color="bg-slate-700" />
        <StatCard label="Faturação Mês (Paga)" value={`€${((kpis?.faturacao?.pagoMes ?? 0) / 1000).toFixed(1)}k`} sub={`Pendente: €${((kpis?.faturacao?.pendenteMes ?? 0) / 1000).toFixed(1)}k`} color="bg-emerald-600" />
        <StatCard label="No-Show Consultas" value={`${kpis?.consultasHoje?.taxaNoShow ?? 0}%`} sub={`${kpis?.consultasHoje?.faltaram ?? 0} de ${kpis?.consultasHoje?.total ?? 0} hoje`} color={(kpis?.consultasHoje?.taxaNoShow ?? 0) > 20 ? 'bg-red-500' : 'bg-blue-600'} />
        <StatCard label="Trocas Turno Pendentes" value={kpis?.trocasPendentes ?? 0} color={(kpis?.trocasPendentes ?? 0) > 5 ? 'bg-amber-500' : 'bg-slate-500'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: '24px' }}>

        {/* Faturação por cobertura */}
        <CardContainer>
          <CardHeader title="Faturação Mês — Por Cobertura" />
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'sns', label: 'SNS', cor: '#3b82f6' },
              { key: 'seguro', label: 'Seguro', cor: '#10b981' },
              { key: 'particular', label: 'Particular', cor: '#8b5cf6' },
            ].map(({ key, label, cor }) => {
              const val = kpis?.faturacao?.porCobertura?.[key] ?? 0;
              const total = kpis?.faturacao?.totalMes ?? 1;
              const pctCob = total > 0 ? Math.round((val / total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                    <span className="text-slate-600 font-medium">{label}</span>
                    <span className="font-semibold text-slate-800">€{(val / 1000).toFixed(1)}k ({pctCob}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pctCob}%`, background: cor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContainer>

        {/* Pessoal */}
        <CardContainer>
          <CardHeader title="Pessoal — Resumo" />
          <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
              <span className="text-slate-500">Turnos cobertos (7d)</span>
              <span className="font-semibold text-slate-800">{pessoal?.turnosCobertos7d ?? '—'} / {((pessoal?.turnosCobertos7d ?? 0) + (pessoal?.turnosSemCobertura7d ?? 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Trocas aprovadas (30d)</span>
              <span className="font-semibold text-emerald-700">{pessoal?.trocas30d?.aprovado ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Trocas recusadas (30d)</span>
              <span className="font-semibold text-red-600">{pessoal?.trocas30d?.recusado ?? 0}</span>
            </div>
            <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold" style={{ marginBottom: '6px' }}>Por Role</p>
              {pessoal?.utilizadoresPorRole && Object.entries(pessoal.utilizadoresPorRole).slice(0, 6).map(([role, total]: [string, any]) => (
                <div key={role} className="flex justify-between text-xs" style={{ padding: '2px 0' }}>
                  <span className="text-slate-500 capitalize">{role}</span>
                  <span className="font-semibold text-slate-700">{total}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContainer>

        {/* Urgência + Doentes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CardContainer>
            <CardHeader title="Urgência — Últimas 24h" />
            <div style={{ padding: '12px 24px' }}>
              {urgencia ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total episódios</span>
                    <span className="font-bold text-slate-800">{urgencia.total ?? '—'}</span>
                  </div>
                  {urgencia.porTriagem && Object.entries(urgencia.porTriagem).slice(0, 3).map(([cor, n]: [string, any]) => (
                    <div key={cor} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cor === 'vermelho' ? 'bg-red-500' : cor === 'laranja' ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                        <span className="text-slate-500 capitalize">{cor}</span>
                      </div>
                      <span className="font-semibold text-slate-700">{n}</span>
                    </div>
                  ))}
                </div>
              ) : <Vazio msg="Sem dados" />}
            </div>
          </CardContainer>
          <CardContainer>
            <CardHeader title="Doentes" />
            <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Internados</span><span className="font-semibold text-slate-800">{kpis?.doentes?.internados ?? 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Ambulatório</span><span className="font-semibold text-slate-800">{kpis?.doentes?.ambulatorio ?? 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Aguarda Cama</span><span className="font-semibold text-amber-600">{kpis?.doentes?.pendenteCama ?? 0}</span></div>
            </div>
          </CardContainer>
        </div>
      </div>

      {/* Tendência de ocupação */}
      {analytics?.ocupacaoDiaria && (
        <CardContainer>
          <CardHeader title="Tendência de Ocupação — Últimas 2 semanas" />
          <div style={{ padding: '20px 24px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analytics.ocupacaoDiaria} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradExec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip labelFormatter={(l) => new Date(String(l)).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })} formatter={(v, name) => [v, name === 'ocupadas' ? 'Ocupadas' : 'Total']} />
                <Area type="monotone" dataKey="total" stroke="#e2e8f0" fill="none" strokeDasharray="4 2" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="ocupadas" stroke="#2563eb" fill="url(#gradExec)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContainer>
      )}

      {/* Patient Outcomes Tracking */}
      <div style={{ marginTop: '24px' }}>
        <SecaoTitulo>Outcomes Clínicos — Inteligência IA</SecaoTitulo>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <CardContainer>
            <CardHeader title="Readmissões 30 dias" />
            <div style={{ padding: '24px' }}>
              <p className="text-4xl font-bold" style={{ color: (outcomes?.taxaReadmissao30d ?? 0) > 15 ? '#ef4444' : '#10b981' }}>
                {outcomes?.taxaReadmissao30d ?? '—'}%
              </p>
              <p className="text-sm text-slate-500" style={{ marginTop: '6px' }}>
                {outcomes?.readmissoes30d ?? 0} readmissões registadas
              </p>
              <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>
                Benchmark: &lt;15% (WHO)
              </p>
            </div>
          </CardContainer>

          <CardContainer>
            <CardHeader title="Outcomes por Tipo" />
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {outcomes?.porTipo?.length ? outcomes.porTipo.map((t: any) => {
                const tipoLabel: Record<string, string> = {
                  readmissao_30d: 'Readmissão 30d', obito_intra: 'Óbito intra-hospitalar',
                  complicacao: 'Complicação', melhoria: 'Melhoria registada',
                };
                const corMap: Record<string, string> = {
                  readmissao_30d: '#f59e0b', obito_intra: '#ef4444', complicacao: '#f97316', melhoria: '#10b981',
                };
                return (
                  <div key={t.tipo} className="flex justify-between text-sm">
                    <span style={{ color: corMap[t.tipo] ?? '#64748b' }} className="font-medium">{tipoLabel[t.tipo] ?? t.tipo}</span>
                    <span className="font-semibold text-slate-800">{t.total}</span>
                  </div>
                );
              }) : <Vazio msg="Sem outcomes registados" />}
            </div>
          </CardContainer>

          <CardContainer>
            <CardHeader title="Correlação Decisões IA" />
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <p className="text-xs text-slate-500">Outcomes com decisão IA associada</p>
                <p className="text-2xl font-bold text-slate-800">{outcomes?.correlacaoIA?.outcomesComDecisaoIA ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Dessas decisões IA foram aceites</p>
                <p className="text-2xl font-bold text-blue-600">{outcomes?.correlacaoIA?.decisoesIAAceites ?? 0}</p>
              </div>
              {correlacaoAI && (
                <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <p className="text-xs text-slate-500">Decisões IA aceites → outcome negativo (30d)</p>
                  <p className="text-2xl font-bold" style={{ color: (correlacaoAI.taxaOutcomeNegativoAceite ?? 0) > 20 ? '#ef4444' : '#10b981' }}>
                    {correlacaoAI.taxaOutcomeNegativoAceite ?? 0}%
                  </p>
                  <p className="text-xs text-slate-500">{correlacaoAI.aceitesComOutcomeNegativo ?? 0} casos nos últimos 30 dias</p>
                </div>
              )}
              <p className="text-xs text-slate-500">Permite avaliar impacto clínico das sugestões IA aceites vs rejeitadas</p>
            </div>
          </CardContainer>
        </div>
      </div>
    </>
  );
}
