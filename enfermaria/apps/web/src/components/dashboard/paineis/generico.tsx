'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { estadoCor, estadoLabel, StatCard, SecaoTitulo, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardGenerico({ utilizador }: { utilizador: any }) {
  const ROLES_ANALYTICS = ['administrativo', 'enfermeiro', 'medico', 'direcao'];
  const podeAnalytics = ROLES_ANALYTICS.includes(utilizador?.role ?? '');

  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-generico', podeAnalytics],
    queryFn: async () => {
      const requests: Promise<any>[] = [
        api.get('/camas/ocupacao').catch(() => ({ data: null })),
        api.get('/doentes?todos=true').catch(() => ({ data: [] })),
      ];
      if (podeAnalytics) requests.push(api.get('/dashboard/analytics').catch(() => ({ data: null })));
      const [o, d, a] = await Promise.all(requests);
      return { ocupacao: o.data, doentes: d.data?.data ?? [], analytics: a?.data ?? null };
    },
    staleTime: 60_000,
  });

  const ocupacao = (data as any).ocupacao ?? null;
  const doentes: any[] = (data as any).doentes ?? [];
  const analytics = (data as any).analytics ?? null;
  const criticos = doentes.filter((d: any) => d.estado === 'critico');
  const altasHoje = doentes.filter((d: any) => d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString());

  if (isLoading) return <Spinner />;

  const ocupacaoMap: Record<string, number> = { total: ocupacao?.total ?? 0, ocupadas: ocupacao?.ocupadas ?? 0, livres: ocupacao?.livres ?? 0, emLimpeza: ocupacao?.emLimpeza ?? 0 };
  const statCards = [
    { key: 'total', label: 'Total de Camas', color: 'bg-slate-800' },
    { key: 'ocupadas', label: 'Camas Ocupadas', color: 'bg-red-500' },
    { key: 'livres', label: 'Camas Livres', color: 'bg-emerald-500' },
    { key: 'emLimpeza', label: 'Em Limpeza', color: 'bg-amber-500' },
  ];

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        {statCards.map(({ key, label, color }) => (
          <StatCard key={key} label={label} value={ocupacaoMap[key]} color={color} sub={key === 'ocupadas' && ocupacao?.total ? `${Math.round((ocupacao.ocupadas / ocupacao.total) * 100)}% de ocupação` : undefined} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <CardContainer>
          <CardHeader title="Doentes Críticos" count={criticos.length} countColor={criticos.length > 0 ? 'bg-red-100 text-red-700' : undefined} />
          {criticos.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ padding: '36px 24px' }}>
              <svg className="w-8 h-8 text-emerald-400" style={{ marginBottom: '10px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <p className="text-slate-500 text-sm">Sem doentes críticos</p>
            </div>
          ) : criticos.map((d: any, i: number) => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < criticos.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <div className="min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate">{d.nome}</p>
                <p className="text-slate-500 text-xs">Cama {d.cama?.numero}</p>
              </div>
              <span className={`shrink-0 text-xs badge-pad py-0.5 rounded-full font-medium ${estadoCor[d.estado]?.badge}`}>{estadoLabel[d.estado]}</span>
            </div>
          ))}
        </CardContainer>

        <CardContainer>
          <CardHeader title="Altas Previstas Hoje" count={altasHoje.length} countColor={altasHoje.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
          {altasHoje.length === 0 ? <Vazio msg="Sem altas previstas para hoje" /> : altasHoje.map((d: any, i: number) => (
            <div key={d.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < altasHoje.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <div className="min-w-0">
                <p className="font-medium text-slate-800 text-sm truncate">{d.nome}</p>
                <p className="text-slate-500 text-xs truncate">{d.diagnosticoPrincipal}</p>
              </div>
              <span className={`shrink-0 text-xs badge-pad py-0.5 rounded-full font-medium ${estadoCor[d.estado]?.badge}`}>{estadoLabel[d.estado]}</span>
            </div>
          ))}
        </CardContainer>

        <div className="rounded-2xl shadow-lg flex flex-col justify-between" style={{ padding: '28px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}>
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Resumo Global</p>
            <p className="text-5xl font-bold text-white" style={{ marginBottom: '4px' }}>{doentes.length}</p>
            <p className="text-blue-200 text-sm">doentes internados</p>
          </div>
          <div style={{ marginTop: '24px' }} className="space-y-2">
            {(['estavel', 'grave', 'critico', 'alta_prevista'] as const).map((e) => (
              <div key={e} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${estadoCor[e].dot}`} /><span className="text-blue-100">{estadoLabel[e]}</span></div>
                <span className="font-semibold text-white">{doentes.filter((d) => d.estado === e).length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {analytics && (
        <div style={{ marginBottom: '32px' }}>
          <SecaoTitulo>Análises e Métricas</SecaoTitulo>
          <div className="grid grid-cols-2 gap-5">
            <CardContainer>
              <CardHeader title="Ocupação — Últimas 2 semanas" />
              <div style={{ padding: '16px 24px' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={analytics.ocupacaoDiaria} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="gradG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => new Date(v).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip formatter={(v, n) => [v, n === 'ocupadas' ? 'Ocupadas' : 'Total']} labelFormatter={(l) => new Date(String(l)).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })} />
                    <Area type="monotone" dataKey="total" stroke="#e2e8f0" fill="none" strokeDasharray="4 2" strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="ocupadas" stroke="#2563eb" fill="url(#gradG)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContainer>
            <CardContainer>
              <CardHeader title="Carga por Enfermeiro — Turno Atual" />
              <div style={{ padding: '16px 24px' }}>
                {analytics.cargaEnfermeiros?.length === 0 ? <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Sem atribuições no turno atual</div> : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.cargaEnfermeiros} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: string) => v.split(' ')[0]} />
                      <Tooltip formatter={(v, n) => [v, n === 'numDoentes' ? 'Doentes' : 'Tarefas']} />
                      <Bar dataKey="numDoentes" fill="#2563eb" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="tarefasPendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContainer>
          </div>
        </div>
      )}

      <CardContainer>
        <CardHeader title="Todos os Doentes Internados" count={doentes.length} />
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Doente', 'Cama', 'Diagnóstico', 'Estado', 'Alta Prevista'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ padding: '12px 24px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doentes.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-500 text-sm" style={{ padding: '48px' }}>Sem doentes internados</td></tr>
            ) : doentes.map((d: any, i: number) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <td style={{ padding: '14px 24px' }}><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado]?.dot ?? 'bg-slate-300'}`} /><span className="font-medium text-slate-900">{d.nome}</span></div></td>
                <td className="text-slate-500" style={{ padding: '14px 24px' }}>Q{d.cama?.quarto} / {d.cama?.numero}</td>
                <td className="text-slate-500 max-w-xs truncate" style={{ padding: '14px 24px' }}>{d.diagnosticoPrincipal}</td>
                <td style={{ padding: '14px 24px' }}><span className={`text-xs font-medium rounded-lg ${estadoCor[d.estado]?.badge}`} style={{ padding: '4px 10px' }}>{estadoLabel[d.estado] ?? d.estado}</span></td>
                <td className="text-slate-500" style={{ padding: '14px 24px' }}>{d.dataAltaPrevista ? new Date(d.dataAltaPrevista).toLocaleDateString('pt-PT') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContainer>
    </>
  );
}
