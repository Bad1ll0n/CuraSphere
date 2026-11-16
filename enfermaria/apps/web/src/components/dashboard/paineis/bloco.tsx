'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { hojeISO, StatCard, EmBreve, SecaoTitulo, CardContainer, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardBloco({ utilizador }: { utilizador: any }) {
  const { data: cirurgias = [], isLoading } = useQuery<any[]>({
    queryKey: ['dash-bloco', hojeISO],
    queryFn: () => api.get(`/bloco/agenda?data=${hojeISO}`).catch(() => ({ data: [] })).then(r => r.data ?? []),
    staleTime: 60_000,
  });

  const estadosCirurgia: Record<string, { badge: string; label: string }> = {
    agendada:  { badge: 'bg-blue-100 text-blue-700',    label: 'Agendada' },
    em_curso:  { badge: 'bg-orange-100 text-orange-700',label: 'Em Curso' },
    concluida: { badge: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
    cancelada: { badge: 'bg-red-100 text-red-700',      label: 'Cancelada' },
    adiada:    { badge: 'bg-slate-100 text-slate-600',  label: 'Adiada' },
  };

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Cirurgias Hoje" value={cirurgias.length} color="bg-red-600" />
        <StatCard label="Em Curso" value={cirurgias.filter((c: any) => c.estado === 'em_curso').length} color="bg-orange-500" />
        <StatCard label="Concluídas" value={cirurgias.filter((c: any) => c.estado === 'concluida').length} color="bg-emerald-500" />
        <StatCard label="Canceladas" value={cirurgias.filter((c: any) => c.estado === 'cancelada').length} color="bg-slate-400" />
      </div>

      <SecaoTitulo>Agenda de Hoje</SecaoTitulo>
      {cirurgias.length === 0 ? (
        <CardContainer><Vazio msg="Sem cirurgias agendadas para hoje" /></CardContainer>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {cirurgias.map((c: any) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '20px 24px' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{c.designacao}</p>
                  <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>{c.doente?.nome ?? 'Doente'} · Sala {c.sala}</p>
                  <p className="text-sm text-slate-500" style={{ marginTop: '2px' }}>
                    {new Date(c.dataHora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {c.duracaoPrevista}min previstos
                  </p>
                </div>
                <span className={`text-xs font-medium badge-pad py-1 rounded-full ${estadosCirurgia[c.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>
                  {estadosCirurgia[c.estado]?.label ?? c.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <EmBreve titulo="WHO Surgical Safety Checklist" descricao="Fase 7.4 — Verificação pré/intra/pós cirúrgica" />
        <EmBreve titulo="Registo Intra-operatório" descricao="Tempo real, intercorrências, consumo de material" />
      </div>
    </>
  );
}
