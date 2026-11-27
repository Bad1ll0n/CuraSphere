'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { VigilanciaEmAtraso } from '@/components/vigilancia-em-atraso';
import { estadoCor, estadoLabel, prioridadeCor, StatCard, AtalhoModulo, CardContainer, CardHeader, Vazio, DashboardHeader, SOSBannerGlobal, Spinner } from '../partilhado';
import { DistribuicaoNews2 } from '../distribuicao-news2';

export function DashboardEnfermeiro({ utilizador }: { utilizador: any }) {
  const tEnf = useTranslations('dashboard');
  const tv = useTranslations('vazios');
  const tN2 = useTranslations('news2Distribution');
  // auxiliar partilha este dashboard mas não tem acesso a /dashboard/news2 (clínico) — evitar o pedido
  const podeNews2 = utilizador.role === 'enfermeiro';
  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-enfermeiro', podeNews2],
    queryFn: async () => {
      const [d, t, turnoR, msg, wl, news2] = await Promise.all([
        api.get('/doentes').catch(() => ({ data: [] })),
        api.get('/tarefas/minhas').catch(() => ({ data: [] })),
        api.get('/turnos/ativo').catch(() => ({ data: null })),
        api.get('/comunicacao/mensagens/nao-lidas').catch(() => ({ data: { count: 0 } })),
        api.get('/dashboard/workload-turno').catch(() => ({ data: [] })),
        podeNews2 ? api.get('/dashboard/news2').catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      return {
        doentes: d.data?.data ?? [],
        tarefas: (t.data ?? []).filter((x: any) => x.estado !== 'concluida' && x.estado !== 'cancelada'),
        turno: turnoR.data,
        mensagensNaoLidas: msg.data?.count ?? msg.data?.length ?? 0,
        workload: wl.data ?? [],
        news2Data: news2.data,
      };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const doentes: any[] = (data as any).doentes ?? [];
  const tarefas: any[] = (data as any).tarefas ?? [];
  const turno = (data as any).turno ?? null;
  const mensagensNaoLidas: number = (data as any).mensagensNaoLidas ?? 0;
  const workload: any[] = (data as any).workload ?? [];
  const news2Data: any = (data as any).news2Data;
  const urgentes = tarefas.filter((t: any) => t.prioridade === 'urgente' || t.prioridade === 'alta');
  const isUCI = utilizador.subRole === 'enf_uci';

  if (isLoading) return <Spinner />;

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <SOSBannerGlobal />
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-5`} style={{ marginBottom: '32px' }}>
        <StatCard label="Doentes Atribuídos" value={doentes.length} color="bg-teal-600" />
        <StatCard label="Tarefas Pendentes" value={tarefas.length} color="bg-amber-500" />
        <StatCard label="Tarefas Urgentes" value={urgentes.length} color={urgentes.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
        <StatCard label="Mensagens Não Lidas" value={mensagensNaoLidas} color={mensagensNaoLidas > 0 ? 'bg-blue-600' : 'bg-slate-400'} />
      </div>

      {/* PROD-10: observações devidas e não feitas */}
      {podeNews2 && <VigilanciaEmAtraso />}

      {/* Widget NEWS2 clínico — UX-03: cada número leva aos doentes do turno. */}
      {news2Data && <div style={{ marginBottom: '24px' }}><DistribuicaoNews2 dados={news2Data} destino="/meu-turno" titulo={tN2('titleCurrent', { n: news2Data.totalAtivos ?? 0 })} /></div>}

      {turno && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl flex items-center gap-3" style={{ padding: '14px 20px', marginBottom: '24px' }}>
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <p className="text-teal-800 text-sm font-medium">
            Turno {turno.tipo === 'manha' ? 'Manhã' : turno.tipo === 'tarde' ? 'Tarde' : 'Noite'} em curso ·{' '}
            {new Date(turno.dataInicio).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} —{' '}
            {new Date(turno.dataFim).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <CardContainer>
          <CardHeader title={tEnf('myPatients')} count={doentes.length} countColor="bg-teal-100 text-teal-700" />
          {doentes.length === 0 ? (
            // UX-10: o "sem doentes" diz o que fazer a seguir.
            <EmptyState icon="patients" title={tEnf('noPatientsShift')} description={tv('noPatientsBody')}
              acoes={[{ label: tv('openAssignments'), href: '/atribuicoes' }, { label: tv('openPatients'), href: '/doentes' }]} />
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {doentes.map((d: any, i: number) => (
                <Link key={d.id} href={`/doentes/${d.id}`}>
                  <div className="flex items-center justify-between hover:bg-slate-50 transition-colors" style={{ padding: '12px 24px', borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado]?.dot ?? 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                        <p className="text-xs text-slate-500">Cama {d.cama?.numero} · Quarto {d.cama?.quarto}</p>
                      </div>
                    </div>
                    <span className={`text-xs badge-pad py-0.5 rounded-full font-medium shrink-0 ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>{estadoLabel[d.estado] ?? d.estado}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContainer>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CardContainer>
            <CardHeader title="Tarefas Urgentes / Alta Prioridade" count={urgentes.length} countColor={urgentes.length > 0 ? 'bg-red-100 text-red-700' : undefined} />
            {urgentes.length === 0 ? <Vazio msg="Sem tarefas urgentes" /> : (
              <div>
                {urgentes.slice(0, 5).map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < Math.min(urgentes.length, 5) - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">{t.descricao}</p>
                      <p className="text-xs text-slate-500">{t.doente?.nome ?? ''}</p>
                    </div>
                    <span className={`text-xs badge-pad py-0.5 rounded-full font-medium shrink-0 ml-2 ${prioridadeCor[t.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{t.prioridade}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContainer>
          <CardContainer>
            <CardHeader title={tEnf('workloadMyShift')} count={workload.length} countColor="bg-teal-100 text-teal-700" />
            {workload.length === 0 ? <Vazio msg={tEnf('noPatientsCurrentShift')} /> : (
              <div>
                {workload.map((w: any, i: number) => {
                  const temAlerta = w.medicacoesPendentes > 0 || w.tarefasAtrasadas > 0 || w.alertasNaoLidos > 0;
                  const ultimoSV = w.ultimoSinalVital ? new Date(w.ultimoSinalVital) : null;
                  const horasSD = ultimoSV ? Math.round((Date.now() - ultimoSV.getTime()) / 3600000) : null;
                  return (
                    <Link key={w.doente.id} href={`/doentes/${w.doente.id}`}>
                      <div className={`flex items-center justify-between hover:bg-slate-50 transition-colors ${temAlerta ? 'border-l-2 border-red-400' : ''}`} style={{ padding: '10px 16px', borderBottom: i < workload.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{w.doente.nome}</p>
                          <p className="text-xs text-slate-500">Cama {w.doente.cama ?? '—'} · {w.doente.quarto ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {w.medicacoesPendentes > 0 && <span className="text-xs bg-red-100 text-red-700 badge-pad py-0.5 rounded-full font-medium">💊 {w.medicacoesPendentes}</span>}
                          {w.tarefasAtrasadas > 0 && <span className="text-xs bg-orange-100 text-orange-700 badge-pad py-0.5 rounded-full font-medium">⚠️ {w.tarefasAtrasadas}</span>}
                          {w.alertasNaoLidos > 0 && <span className="text-xs bg-red-100 text-red-700 badge-pad py-0.5 rounded-full font-medium">🔔 {w.alertasNaoLidos}</span>}
                          {horasSD !== null && <span className={`text-xs badge-pad py-0.5 rounded-full font-medium ${horasSD > 8 ? 'bg-red-100 text-red-700' : horasSD > 4 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>🕐 {horasSD}h</span>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContainer>
          {isUCI && <AtalhoModulo href="/doentes" titulo="Dispositivos Invasivos" descricao="Cateteres, ventiladores e drenos — na ficha de cada doente, separador «Vitais e escalas»" />}
        </div>
      </div>
    </>
  );
}
