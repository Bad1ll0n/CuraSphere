'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { prioridadeCor, StatCard, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardTransporte({ utilizador }: { utilizador: any }) {
  const { data: pedidos = [], isLoading } = useQuery<any[]>({
    queryKey: ['dash-transporte'],
    queryFn: () => api.get('/pedidos-internos').catch(() => ({ data: [] })).then(r => (r.data ?? []).filter((p: any) => p.tipo === 'transporte')),
    staleTime: 60_000,
  });

  const pendentes = pedidos.filter((p: any) => p.estado === 'pendente');
  const emCurso = pedidos.filter((p: any) => p.estado === 'em_curso');
  const concluidosHoje = pedidos.filter((p: any) => p.estado === 'concluido' && new Date(p.concluidoEm ?? p.criadoEm).toDateString() === new Date().toDateString());

  const prioridadeCirurgia: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  const pendentesOrdenados = [...pendentes].sort((a, b) => (prioridadeCirurgia[a.prioridade] ?? 3) - (prioridadeCirurgia[b.prioridade] ?? 3));

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Pedidos Pendentes" value={pendentes.length} color={pendentes.length > 0 ? 'bg-amber-500' : 'bg-slate-400'} />
        <StatCard label="Em Curso" value={emCurso.length} color={emCurso.length > 0 ? 'bg-blue-600' : 'bg-slate-400'} />
        <StatCard label="Concluídos Hoje" value={concluidosHoje.length} color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Pedidos de Transporte Pendentes" count={pendentes.length} countColor={pendentes.length > 0 ? 'bg-amber-100 text-amber-700' : undefined} />
          {pendentesOrdenados.length === 0 ? <Vazio msg="Sem pedidos pendentes" /> : (
            <div>
              {pendentesOrdenados.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < pendentesOrdenados.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800 truncate">{p.descricao}</p>
                    <p className="text-xs text-slate-500">{p.localOrigem ?? '—'} → {p.localDestino ?? '—'}</p>
                  </div>
                  <span className={`text-xs badge-pad py-0.5 rounded-full font-medium shrink-0 ml-2 ${prioridadeCor[p.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{p.prioridade}</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <CardContainer>
          <CardHeader title="Em Curso" count={emCurso.length} countColor={emCurso.length > 0 ? 'bg-blue-100 text-blue-700' : undefined} />
          {emCurso.length === 0 ? <Vazio msg="Nenhum transporte em curso" /> : (
            <div>
              {emCurso.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < emCurso.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.descricao}</p>
                    <p className="text-xs text-slate-500">{p.localOrigem ?? '—'} → {p.localDestino ?? '—'}</p>
                  </div>
                  <span className="text-xs badge-pad py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Em curso</span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>
      </div>
    </>
  );
}
