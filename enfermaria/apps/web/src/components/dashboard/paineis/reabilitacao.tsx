'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard, EmBreve, CardContainer, CardHeader, Vazio, DashboardHeader, Spinner } from '../partilhado';

export function DashboardReabilitacao({ utilizador }: { utilizador: any }) {
  const isFisio = ['fisioterapeuta', 'reabilitacao_fisica'].includes(utilizador.subRole ?? utilizador.role);

  const { data: sessoesRaw = [], isLoading } = useQuery<any[]>({
    queryKey: ['dash-reabilitacao'],
    queryFn: () => isFisio
      ? api.get('/fisioterapia/agenda').catch(() => ({ data: [] })).then(r => r.data ?? [])
      : Promise.resolve([]),
    staleTime: 60_000,
  });

  const sessoes = sessoesRaw.filter((s: any) => new Date(s.data).toDateString() === new Date().toDateString());
  const realizadas = sessoes.filter((s: any) => s.estado === 'realizada');
  const agendadas = sessoes.filter((s: any) => s.estado === 'agendada');

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Sessões Hoje" value={sessoes.length} color="bg-lime-600" />
        <StatCard label="Realizadas" value={realizadas.length} color="bg-emerald-500" />
        <StatCard label="Agendadas" value={agendadas.length} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <CardContainer>
          <CardHeader title="Agenda de Hoje" count={sessoes.length} />
          {sessoes.length === 0 ? <Vazio msg="Sem sessões para hoje" /> : (
            <div>
              {sessoes.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center justify-between" style={{ padding: '12px 24px', borderBottom: i < sessoes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.doente?.nome ?? '—'}</p>
                    <p className="text-xs text-slate-500">{new Date(s.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · {s.duracao}min · {s.descricao}</p>
                  </div>
                  <span className={`text-xs badge-pad py-0.5 rounded-full font-medium ${s.estado === 'realizada' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {s.estado === 'realizada' ? 'Realizada' : 'Agendada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <EmBreve titulo="Avaliações Funcionais" descricao="Barthel, FIM, MRC, FOIS, NRS-2002, PHQ-9..." />
          <EmBreve titulo="Objetivos SMART" descricao="Defina e acompanhe objetivos de reabilitação por doente" />
        </div>
      </div>
    </>
  );
}
