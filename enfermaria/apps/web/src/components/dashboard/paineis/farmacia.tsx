'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard, EmBreve, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardFarmacia({ utilizador }: { utilizador: any }) {
  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-farmacia'],
    queryFn: async () => {
      const [a, p] = await Promise.all([
        api.get('/farmacia/alertas').catch(() => ({ data: { stockMinimo: [], validadeProxima: [] } })),
        api.get('/farmacia/pedidos').catch(() => ({ data: [] })),
      ]);
      return {
        stockMinimo: a.data?.stockMinimo ?? [],
        aExpirar: a.data?.validadeProxima ?? [],
        pedidos: (p.data ?? []).filter((x: any) => x.estado === 'pendente'),
      };
    },
    staleTime: 60_000,
  });

  const stockMinimo: any[] = (data as any).stockMinimo ?? [];
  const aExpirar: any[] = (data as any).aExpirar ?? [];
  const pedidos: any[] = (data as any).pedidos ?? [];

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Alertas de Stock" value={stockMinimo.length} color={stockMinimo.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Pedidos Pendentes" value={pedidos.length} color={pedidos.length > 0 ? 'bg-amber-500' : 'bg-slate-400'} />
        <StatCard label="A Expirar (30 dias)" value={aExpirar.length} color={aExpirar.length > 0 ? 'bg-orange-500' : 'bg-emerald-500'} />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <CardContainer>
          <CardHeader title="Alertas de Stock Mínimo" count={stockMinimo.length} countColor={stockMinimo.length > 0 ? 'bg-red-100 text-red-700' : undefined} />
          {stockMinimo.length === 0 ? <Vazio msg="Sem alertas de stock" /> : (
            <div>
              {stockMinimo.slice(0, 6).map((a: any, i: number) => (
                <div key={a.id ?? i} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < stockMinimo.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.nome}</p>
                    <p className="text-xs text-slate-500">{a.quantidade} {a.unidade} · mín: {a.quantidadeMinima}</p>
                  </div>
                  <span className="text-xs badge-pad py-0.5 rounded-full font-medium bg-red-100 text-red-700 shrink-0">Baixo</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Pedidos de Reposição Pendentes" count={pedidos.length} countColor={pedidos.length > 0 ? 'bg-amber-100 text-amber-700' : undefined} />
            {pedidos.length === 0 ? <Vazio msg="Sem pedidos pendentes" /> : (
              <div>
                {pedidos.slice(0, 4).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < pedidos.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <p className="text-sm text-slate-700 truncate">{p.stockItem?.nome ?? '—'} × {p.quantidade}</p>
                    <span className="text-xs text-slate-500 shrink-0 ml-2">{p.servico}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
          <EmBreve titulo="Validação de Prescrições" descricao="Validar prescrições médicas antes da dispensa" />
        </div>
      </div>
    </>
  );
}
