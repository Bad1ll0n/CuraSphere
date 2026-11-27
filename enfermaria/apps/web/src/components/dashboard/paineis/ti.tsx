'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { roleLabel, StatCard, AtalhoModulo, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardTI({ utilizador }: { utilizador: any }) {
  const { data: utilizadores = [], isLoading } = useQuery<any[]>({
    queryKey: ['dash-ti'],
    queryFn: () => api.get('/utilizadores').catch(() => ({ data: { data: [] } })).then(r => r.data?.data ?? r.data ?? []),
    staleTime: 60_000,
  });

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Utilizadores Ativos" value={utilizadores.filter((u: any) => u.ativo).length} color="bg-cyan-600" />
        <StatCard label="Utilizadores Inativos" value={utilizadores.filter((u: any) => !u.ativo).length} color="bg-slate-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Utilizadores Ativos por Role" count={utilizadores.filter((u: any) => u.ativo).length} />
          {utilizadores.length === 0 ? <Vazio /> : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {Object.entries(
                utilizadores.filter((u: any) => u.ativo).reduce<Record<string, number>>((acc, u: any) => {
                  acc[roleLabel[u.role] ?? u.role] = (acc[roleLabel[u.role] ?? u.role] ?? 0) + 1;
                  return acc;
                }, {})
              ).sort(([, a], [, b]) => b - a).map(([role, count], i) => (
                <div key={role} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: '1px solid #f8fafc' }}>
                  <p className="text-sm text-slate-700">{role}</p>
                  <span className="text-sm font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AtalhoModulo href="/auditoria" titulo="Trilho de Auditoria e Segurança" descricao="Acessos, alterações e eventos de segurança" />
          <AtalhoModulo href="/dashboard-ti" titulo="Dashboard TI" descricao="Incidentes, pedidos e utilizadores por papel" />
        </div>
      </div>
    </>
  );
}
