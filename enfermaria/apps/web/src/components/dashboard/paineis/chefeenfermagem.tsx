'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { estadoCor, estadoLabel, StatCard, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardChefeEnfermagem({ utilizador }: { utilizador: any }) {
  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-chefe-enfermagem'],
    queryFn: async () => {
      const [o, d, a, t] = await Promise.all([
        api.get('/camas/ocupacao').catch(() => ({ data: null })),
        api.get('/doentes?todos=true').catch(() => ({ data: [] })),
        api.get('/dashboard/analytics').catch(() => ({ data: null })),
        api.get('/trocas').catch(() => ({ data: [] })),
      ]);
      return {
        ocupacao: o.data,
        doentes: d.data?.data ?? [],
        analytics: a.data,
        trocas: (t.data ?? []).filter((x: any) => x.estado === 'pendente_chefe'),
      };
    },
    staleTime: 60_000,
  });

  const ocupacao = (data as any).ocupacao ?? null;
  const doentes: any[] = (data as any).doentes ?? [];
  const analytics = (data as any).analytics ?? null;
  const trocas: any[] = (data as any).trocas ?? [];
  const criticos = doentes.filter((d: any) => d.estado === 'critico');
  const altasHoje = doentes.filter((d: any) => d.dataAltaPrevista && new Date(d.dataAltaPrevista).toDateString() === new Date().toDateString());

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Camas Ocupadas" value={ocupacao?.ocupadas ?? 0} sub={`de ${ocupacao?.total ?? 0} total · ${ocupacao?.total ? Math.round((ocupacao.ocupadas / ocupacao.total) * 100) : 0}%`} color="bg-slate-700" />
        <StatCard label="Camas Livres" value={ocupacao?.livres ?? 0} color="bg-emerald-500" />
        <StatCard label="Doentes Críticos" value={criticos.length} color={criticos.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Trocas Pendentes" value={trocas.length} color={trocas.length > 0 ? 'bg-amber-500' : 'bg-slate-400'} />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        {analytics?.cargaEnfermeiros && analytics.cargaEnfermeiros.length > 0 ? (
          <CardContainer>
            <CardHeader title="Carga por Enfermeiro — Turno Atual" />
            <div style={{ padding: '16px 24px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics.cargaEnfermeiros} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" width={90} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v: string) => v.split(' ')[0]} />
                  <Tooltip formatter={(v, name) => [v, name === 'numDoentes' ? 'Doentes' : 'Tarefas']} />
                  <Legend formatter={(v) => v === 'numDoentes' ? 'Doentes' : 'Tarefas'} />
                  <Bar dataKey="numDoentes" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="tarefasPendentes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContainer>
        ) : (
          <CardContainer><CardHeader title="Carga por Enfermeiro" /><Vazio msg="Sem atribuições no turno atual" /></CardContainer>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Trocas de Turno Pendentes" count={trocas.length} countColor={trocas.length > 0 ? 'bg-amber-100 text-amber-700' : undefined} />
            {trocas.length === 0 ? <Vazio msg="Sem trocas para aprovar" /> : (
              <div>
                {trocas.slice(0, 4).map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < trocas.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm text-slate-700 truncate">{t.solicitante?.nome ?? '—'} ↔ {t.destinatario?.nome ?? '—'}</p>
                    <Link href="/trocas" className="text-xs text-blue-600 hover:underline shrink-0 ml-2">Ver</Link>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>

          <CardContainer>
            <CardHeader title="Altas Previstas Hoje" count={altasHoje.length} countColor={altasHoje.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
            {altasHoje.length === 0 ? <Vazio msg="Sem altas previstas" /> : (
              <div>
                {altasHoje.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < altasHoje.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                    <span className={`text-xs badge-pad py-0.5 rounded-full font-medium shrink-0 ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>{estadoLabel[d.estado] ?? d.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
        </div>
      </div>
    </>
  );
}
