'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DraggableDashboard, WidgetDef } from '@/components/draggable-dashboard';
import { estadoCor, estadoLabel, prioridadeCor, StatCard, CardContainer, CardHeader, Vazio, DashboardHeader, SOSBannerGlobal, Spinner } from '../partilhado';
import { DistribuicaoNews2 } from '../distribuicao-news2';
import { useTranslations } from 'next-intl';

function MedicoStatsWidget({ totalDoentes, criticos, tarefas, urgentes }: { totalDoentes: number; criticos: any[]; tarefas: any[]; urgentes: any[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 h-full content-start">
      {/* UX-20: a API devolve ao médico só os doentes atribuídos (e paginados); o NEWS2 e a
          acuidade contam o serviço inteiro. Antes o cartão dizia "Doentes Internados 0" ao lado
          de "3 doentes" na acuidade. */}
      <StatCard label="Os Meus Doentes" value={totalDoentes} sub="internados e atribuídos a si" color="bg-violet-600" />
      <StatCard label="Críticos/Graves (meus)" value={criticos.length} color={criticos.length > 0 ? 'bg-red-500' : 'bg-emerald-500'} />
      <StatCard label="Tarefas Pendentes" value={tarefas.length} color="bg-amber-500" />
      <StatCard label="Urgentes" value={urgentes.length} color={urgentes.length > 0 ? 'bg-orange-500' : 'bg-slate-400'} />
    </div>
  );
}

function MedicoNEWS2Widget({ news2Data }: { news2Data: any }) {
  const t = useTranslations('news2Distribution');
  if (!news2Data) return <Vazio msg={t('unavailable')} />;
  return <DistribuicaoNews2 dados={news2Data} destino="/risco-clinico" titulo={t('titleNow')} />;
}

function MedicoAcuidadeWidget({ news2Data }: { news2Data: any }) {
  if (!news2Data) return <Vazio msg="Dados indisponíveis" />;
  const acuidadePieData = [
    { name: 'Estável', value: news2Data.acuidade?.estavel ?? 0, color: '#10b981' },
    { name: 'Grave', value: news2Data.acuidade?.grave ?? 0, color: '#f97316' },
    { name: 'Crítico', value: news2Data.acuidade?.critico ?? 0, color: '#ef4444' },
  ].filter(d => d.value > 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm h-full" style={{ padding: '20px 24px' }}>
      <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>Acuidade — todo o serviço</p>
      {acuidadePieData.length === 0 ? (
        <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height: '120px' }}>Sem dados</div>
      ) : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={acuidadePieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={2}>
                {acuidadePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2">
            {acuidadePieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-sm text-slate-700 font-medium">{d.value}</span>
                <span className="text-xs text-slate-500">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MedicoDoentesWidget({ doentes }: { doentes: any[] }) {
  return (
    <CardContainer className="h-full flex flex-col">
      <CardHeader title="Os Meus Doentes" count={doentes.length} />
      {doentes.length === 0 ? <Vazio msg="Sem doentes internados" /> : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {doentes.map((d: any, i: number) => (
            <Link key={d.id} href={`/doentes/${d.id}`}>
              <div className="flex items-center justify-between hover:bg-slate-50 transition-colors" style={{ padding: '12px 24px', borderBottom: i < doentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${estadoCor[d.estado]?.dot ?? 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{d.diagnosticoPrincipal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">Cama {d.cama?.numero}</span>
                  <span className={`text-xs badge-pad py-0.5 rounded-full font-medium ${estadoCor[d.estado]?.badge ?? 'bg-slate-100 text-slate-600'}`}>{estadoLabel[d.estado] ?? d.estado}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CardContainer>
  );
}

function MedicoTarefasWidget({ urgentes }: { urgentes: any[] }) {
  return (
    <CardContainer className="h-full flex flex-col">
      <CardHeader title="Tarefas Clínicas Urgentes" count={urgentes.length} countColor={urgentes.length > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'} />
      {urgentes.length === 0 ? <Vazio msg="Sem tarefas urgentes" /> : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {urgentes.map((t: any, i: number) => (
            <div key={t.id} className="flex items-center justify-between" style={{ padding: '10px 24px', borderBottom: i < urgentes.length - 1 ? '1px solid #f8fafc' : 'none' }}>
              <p className="text-sm text-slate-700 truncate">{t.descricao}</p>
              <span className={`text-xs badge-pad py-0.5 rounded-full font-medium shrink-0 ml-2 ${prioridadeCor[t.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{t.prioridade}</span>
            </div>
          ))}
        </div>
      )}
    </CardContainer>
  );
}

function MedicoInterconsultasWidget({ interconsultas }: { interconsultas: any[] }) {
  return (
    <CardContainer className="h-full flex flex-col">
      <CardHeader title="Interconsultas Pendentes" count={interconsultas.length} countColor={interconsultas.length > 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'} />
      {interconsultas.length === 0 ? <Vazio msg="Sem interconsultas pendentes" /> : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {interconsultas.slice(0, 6).map((ic: any, i: number) => (
            <Link key={ic.id} href="/interconsultas">
              <div className="flex items-center justify-between hover:bg-slate-50 transition-colors" style={{ padding: '10px 24px', borderBottom: i < Math.min(interconsultas.length, 6) - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{ic.doente?.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{ic.motivo}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {ic.urgente && <span className="text-xs badge-pad py-0.5 rounded-full font-medium bg-red-100 text-red-700">Urgente</span>}
                  <span className="text-xs text-slate-500">Cama {ic.doente?.cama?.numero}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CardContainer>
  );
}

function MedicoExamesWidget({ exames }: { exames: any[] }) {
  return (
    <CardContainer className="h-full flex flex-col">
      <CardHeader title="Exames com Resultado" count={exames.length} countColor={exames.length > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'} />
      {exames.length === 0 ? <Vazio msg="Sem resultados pendentes de revisão" /> : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {exames.slice(0, 6).map((ex: any, i: number) => (
            <Link key={ex.id} href={`/doentes/${ex.doente?.id}`}>
              <div className="flex items-center justify-between hover:bg-slate-50 transition-colors" style={{ padding: '10px 24px', borderBottom: i < Math.min(exames.length, 6) - 1 ? '1px solid #f8fafc' : 'none' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{ex.doente?.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{ex.tipo}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {ex.urgente && <span className="text-xs badge-pad py-0.5 rounded-full font-medium bg-red-100 text-red-700">Urgente</span>}
                  <span className="text-xs badge-pad py-0.5 rounded-full font-medium bg-sky-100 text-sky-700">Resultado</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CardContainer>
  );
}

export function DashboardMedico({ utilizador }: { utilizador: any }) {
  const { data = {}, isLoading } = useQuery({
    queryKey: ['dash-medico'],
    queryFn: async () => {
      const [d, t, ic, ex, news2] = await Promise.all([
        api.get('/doentes?todos=true').catch(() => ({ data: [] })),
        api.get('/tarefas/minhas').catch(() => ({ data: [] })),
        api.get(`/interconsultas/pendentes?especialidade=${utilizador.subRole ?? ''}`).catch(() => ({ data: [] })),
        api.get('/exames/worklist?estado=resultado_disponivel').catch(() => ({ data: [] })),
        api.get('/dashboard/news2').catch(() => ({ data: null })),
      ]);
      return {
        doentes: d.data?.data ?? [],
        totalDoentes: d.data?.total ?? (d.data?.data ?? []).length,
        tarefas: (t.data ?? []).filter((x: any) => x.estado !== 'concluida' && x.estado !== 'cancelada'),
        interconsultas: ic.data ?? [],
        exames: ex.data ?? [],
        news2Data: news2.data,
      };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const doentes: any[] = (data as any).doentes ?? [];
  const totalDoentes: number = (data as any).totalDoentes ?? doentes.length;
  const tarefas: any[] = (data as any).tarefas ?? [];
  const interconsultas: any[] = (data as any).interconsultas ?? [];
  const exames: any[] = (data as any).exames ?? [];
  const news2Data: any = (data as any).news2Data;
  const criticos = doentes.filter((d: any) => d.estado === 'critico' || d.estado === 'grave');
  const urgentes = tarefas.filter((t: any) => t.prioridade === 'urgente' || t.prioridade === 'alta');

  if (isLoading) return <Spinner />;

  const widgets: WidgetDef[] = [
    { id: 'stats', label: 'Estatísticas', defaultX: 0, defaultY: 0, defaultW: 12, defaultH: 1, component: <MedicoStatsWidget totalDoentes={totalDoentes} criticos={criticos} tarefas={tarefas} urgentes={urgentes} /> },
    { id: 'news2', label: 'NEWS2', defaultX: 0, defaultY: 1, defaultW: 6, defaultH: 2, component: <MedicoNEWS2Widget news2Data={news2Data} /> },
    { id: 'acuidade', label: 'Acuidade', defaultX: 6, defaultY: 1, defaultW: 6, defaultH: 2, component: <MedicoAcuidadeWidget news2Data={news2Data} /> },
    { id: 'doentes', label: 'Doentes', defaultX: 0, defaultY: 3, defaultW: 6, defaultH: 4, component: <MedicoDoentesWidget doentes={doentes} /> },
    { id: 'tarefas', label: 'Tarefas Urgentes', defaultX: 6, defaultY: 3, defaultW: 6, defaultH: 2, component: <MedicoTarefasWidget urgentes={urgentes} /> },
    { id: 'interconsultas', label: 'Interconsultas', defaultX: 6, defaultY: 5, defaultW: 6, defaultH: 2, component: <MedicoInterconsultasWidget interconsultas={interconsultas} /> },
    { id: 'exames', label: 'Exames', defaultX: 6, defaultY: 7, defaultW: 6, defaultH: 2, component: <MedicoExamesWidget exames={exames} /> },
  ];

  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <SOSBannerGlobal />
      <DraggableDashboard widgets={widgets} rowHeight={130} />
    </>
  );
}
