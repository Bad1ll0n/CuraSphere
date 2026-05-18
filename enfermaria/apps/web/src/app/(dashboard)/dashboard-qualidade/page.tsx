'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface DadosQualidade {
  iacs: {
    totalIsolados: number;
    porMotivo: { motivo: string; total: number }[];
    tendencia: { data: string; total: number }[];
  };
  alertas: {
    naoLidos: number;
    porTipo: { tipo: string; total: number }[];
    recentes: {
      id: string; tipo: string; mensagem: string; criadoEm: string; lido: boolean;
      doente: { id: string; nome: string; numeroProcesso: string };
    }[];
  };
  riscos: {
    altoRisco7Dias: number;
    porTipo: { tipo: string; total: number }[];
  };
  doentes: {
    criticos: number;
    instaveis: number;
    ocupacao: { total: number; ocupadas: number; taxa: number };
  };
  alta: {
    altas30Dias: number;
    comSumario: number;
    taxaComplitude: number;
  };
  medicacao: {
    pendentes: number;
    administradasHoje: number;
  };
}

const motivoCor: Record<string, string> = {
  MRSA: 'bg-red-100 text-red-700 border border-red-200',
  VRE: 'bg-orange-100 text-orange-700 border border-orange-200',
  ESBL: 'bg-amber-100 text-amber-700 border border-amber-200',
  KPC: 'bg-purple-100 text-purple-700 border border-purple-200',
  'C.diff': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  CPE: 'bg-pink-100 text-pink-700 border border-pink-200',
  Desconhecido: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const alertaTipoCor: Record<string, string> = {
  alergia: 'text-red-600',
  queda: 'text-orange-600',
  medicacao: 'text-amber-600',
  infeção: 'text-purple-600',
  deterioracao: 'text-rose-600',
};

function KpiCard({ titulo, valor, sub, cor, icone }: { titulo: string; valor: string | number; sub?: string; cor: string; icone: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cor}`}>{icone}</div>
      </div>
      <p className="text-3xl font-bold text-slate-900" style={{ marginBottom: '4px' }}>{valor}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function DashboardQualidade() {
  const { utilizador } = useAuth();
  const podeVer = ['qualidade', 'direcao', 'medico', 'enfermeiro'].includes(utilizador?.role ?? '');

  const { data: dados, isLoading: loading, isError: erro } = useQuery<DadosQualidade>({
    queryKey: ['dashboard-qualidade'],
    queryFn: () => api.get('/dashboard/qualidade').then(r => r.data),
    enabled: podeVer,
    staleTime: 60_000,
  });

  const { data: eventosIndicadores = null } = useQuery({
    queryKey: ['eventos-adversos-indicadores'],
    queryFn: () => api.get('/eventos-adversos/indicadores').then(r => r.data).catch(() => null),
    enabled: podeVer,
    staleTime: 60_000,
  });

  if (!podeVer) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3" style={{ padding: '20px 24px' }}>
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-amber-700 text-sm font-medium">Sem permissão para aceder ao Dashboard de Qualidade.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 48px' }}>
        <div className="flex items-center gap-3 text-slate-400" style={{ paddingTop: '60px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar dados de qualidade...</span>
        </div>
      </div>
    );
  }

  if (erro || !dados) return (
    <div style={{ padding: '40px 48px' }}>
      <div className="bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3" style={{ padding: '20px 24px' }}>
        <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-red-700 text-sm font-medium">Erro ao carregar dados de qualidade. Tenta recarregar a página.</p>
      </div>
    </div>
  );

  const maxTendencia = Math.max(...dados.iacs.tendencia.map(t => t.total), 1);

  return (
    <div style={{ padding: '40px 48px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '8px' }}>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Qualidade</h1>
        </div>
        <p className="text-slate-500 text-sm" style={{ marginLeft: '52px' }}>Indicadores de segurança do doente e qualidade assistencial</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '28px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard
          titulo="Doentes em Isolamento"
          valor={dados.iacs.totalIsolados}
          sub="IACS activos"
          cor="bg-red-50"
          icone={<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <KpiCard
          titulo="Alertas Clínicos Activos"
          valor={dados.alertas.naoLidos}
          sub="não lidos"
          cor="bg-amber-50"
          icone={<svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
        />
        <KpiCard
          titulo="Alto Risco (7 dias)"
          valor={dados.riscos.altoRisco7Dias}
          sub="avaliações críticas/alto"
          cor="bg-orange-50"
          icone={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
        />
        <KpiCard
          titulo="Taxa Sumário Alta"
          valor={`${dados.alta.taxaComplitude}%`}
          sub={`${dados.alta.comSumario} de ${dados.alta.altas30Dias} altas (30d)`}
          cor={dados.alta.taxaComplitude >= 80 ? 'bg-emerald-50' : 'bg-rose-50'}
          icone={<svg className={`w-5 h-5 ${dados.alta.taxaComplitude >= 80 ? 'text-emerald-500' : 'text-rose-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-3 gap-6" style={{ marginBottom: '28px' }}>

        {/* IACS por Motivo */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <h2 className="text-base font-semibold text-slate-800" style={{ marginBottom: '4px' }}>IACS — Por Agente</h2>
          <p className="text-xs text-slate-400" style={{ marginBottom: '20px' }}>Doentes em isolamento activo</p>
          {dados.iacs.porMotivo.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ paddingTop: '20px' }}>Sem isolamentos activos</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dados.iacs.porMotivo.map(({ motivo, total }) => (
                <div key={motivo} className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${motivoCor[motivo] ?? motivoCor['Desconhecido']}`}>{motivo}</span>
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-100 rounded-full overflow-hidden" style={{ width: '80px', height: '6px' }}>
                      <div className="bg-red-400 rounded-full h-full" style={{ width: `${(total / dados.iacs.totalIsolados) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-4 text-right">{total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tendência IACS 7 dias */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <h2 className="text-base font-semibold text-slate-800" style={{ marginBottom: '4px' }}>Tendência IACS</h2>
          <p className="text-xs text-slate-400" style={{ marginBottom: '20px' }}>Isolamentos activos por dia (7 dias)</p>
          <div className="flex items-end gap-2" style={{ height: '80px' }}>
            {dados.iacs.tendencia.map(({ data, total }) => (
              <div key={data} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400 font-medium">{total}</span>
                <div className="w-full rounded-t-sm bg-red-200 transition-all" style={{ height: `${Math.max(4, (total / maxTendencia) * 64)}px` }} />
                <span className="text-xs text-slate-300">{new Date(data).getDate()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ocupação + Estado clínico */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <h2 className="text-base font-semibold text-slate-800" style={{ marginBottom: '4px' }}>Ocupação & Estado</h2>
          <p className="text-xs text-slate-400" style={{ marginBottom: '20px' }}>Capacidade e doentes críticos</p>

          {/* Barra de ocupação */}
          <div style={{ marginBottom: '20px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <span className="text-sm text-slate-600">Ocupação</span>
              <span className="text-sm font-bold text-slate-800">{dados.doentes.ocupacao.taxa}%</span>
            </div>
            <div className="bg-slate-100 rounded-full overflow-hidden" style={{ height: '8px' }}>
              <div
                className={`h-full rounded-full transition-all ${dados.doentes.ocupacao.taxa >= 90 ? 'bg-red-500' : dados.doentes.ocupacao.taxa >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${dados.doentes.ocupacao.taxa}%` }}
              />
            </div>
            <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>{dados.doentes.ocupacao.ocupadas} de {dados.doentes.ocupacao.total} camas</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="flex items-center justify-between bg-red-50 rounded-xl" style={{ padding: '10px 14px' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm text-slate-700">Críticos</span>
              </div>
              <span className="text-sm font-bold text-red-600">{dados.doentes.criticos}</span>
            </div>
            <div className="flex items-center justify-between bg-orange-50 rounded-xl" style={{ padding: '10px 14px' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-sm text-slate-700">Graves</span>
              </div>
              <span className="text-sm font-bold text-orange-600">{dados.doentes.instaveis}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl" style={{ padding: '10px 14px' }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-sm text-slate-700">Medicação pendente</span>
              </div>
              <span className="text-sm font-bold text-slate-700">{dados.medicacao.pendentes}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas recentes + Avaliações risco */}
      <div className="grid grid-cols-2 gap-6">

        {/* Alertas Clínicos recentes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Alertas Clínicos Não Lidos</h2>
              <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Ordenados por mais recentes</p>
            </div>
            {dados.alertas.naoLidos > 0 && (
              <span className="text-xs font-bold text-white bg-red-500 rounded-full badge-pad py-0.5">{dados.alertas.naoLidos}</span>
            )}
          </div>
          {dados.alertas.recentes.length === 0 ? (
            <div className="text-center text-slate-400 text-sm" style={{ padding: '24px 0' }}>
              Sem alertas activos
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {dados.alertas.recentes.slice(0, 8).map((alerta) => (
                <div key={alerta.id} className="flex items-start gap-3 hover:bg-slate-50 rounded-xl transition-colors" style={{ padding: '10px 12px' }}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${alertaTipoCor[alerta.tipo] ? 'bg-current' : 'bg-amber-400'}`}
                    style={{ color: alertaTipoCor[alerta.tipo] ? undefined : undefined }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
                      <span className="text-xs font-semibold text-slate-600 capitalize">{alerta.tipo}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400 truncate">{alerta.doente.nome}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{alerta.mensagem}</p>
                  </div>
                  <span className="text-xs text-slate-300 shrink-0" style={{ marginTop: '2px' }}>
                    {new Date(alerta.criadoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Avaliações de Risco + Alta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Avaliações por tipo */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
            <h2 className="text-base font-semibold text-slate-800" style={{ marginBottom: '4px' }}>Avaliações de Risco</h2>
            <p className="text-xs text-slate-400" style={{ marginBottom: '16px' }}>Últimos 7 dias · {dados.riscos.altoRisco7Dias} de alto/crítico</p>
            {dados.riscos.porTipo.length === 0 ? (
              <p className="text-sm text-slate-400">Sem avaliações recentes</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dados.riscos.porTipo.map(({ tipo, total }) => (
                  <div key={tipo} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 capitalize">{tipo.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-100 rounded-full" style={{ width: '60px', height: '6px', overflow: 'hidden' }}>
                        <div className="bg-violet-400 rounded-full h-full" style={{ width: `${Math.min(100, total * 20)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 w-4 text-right">{total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Taxa de completitude da alta */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
            <h2 className="text-base font-semibold text-slate-800" style={{ marginBottom: '4px' }}>Completitude de Alta</h2>
            <p className="text-xs text-slate-400" style={{ marginBottom: '16px' }}>Sumários de alta registados nos últimos 30 dias</p>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9155" fill="none"
                    stroke={dados.alta.taxaComplitude >= 80 ? '#10b981' : '#f43f5e'}
                    strokeWidth="3"
                    strokeDasharray={`${dados.alta.taxaComplitude} ${100 - dados.alta.taxaComplitude}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-800">{dados.alta.taxaComplitude}%</span>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{dados.alta.comSumario}<span className="text-base font-normal text-slate-400"> / {dados.alta.altas30Dias}</span></p>
                <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>altas com sumário completo</p>
                {dados.alta.taxaComplitude < 80 && (
                  <p className="text-xs text-rose-500 font-medium" style={{ marginTop: '6px' }}>Abaixo do objectivo (80%)</p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── Eventos Adversos ── */}
        {eventosIndicadores && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '28px', marginTop: '24px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Eventos Adversos</h2>
                  <p className="text-xs text-slate-400">Últimos 30 dias</p>
                </div>
              </div>
              <a href="/eventos-adversos" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Ver todos →</a>
            </div>

            <div className="grid grid-cols-4 gap-4" style={{ marginBottom: '20px' }}>
              {[
                { label: 'Registados (30d)', value: eventosIndicadores.total30d, cor: 'text-slate-800' },
                { label: 'Em Aberto', value: eventosIndicadores.abertos, cor: eventosIndicadores.abertos > 0 ? 'text-amber-600' : 'text-slate-800' },
                { label: 'Este Mês', value: eventosIndicadores.totalMes, cor: 'text-slate-800' },
                { label: 'Mês Anterior', value: eventosIndicadores.totalMesPassado, cor: 'text-slate-400' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-xl" style={{ padding: '14px 16px' }}>
                  <p className={`text-2xl font-bold ${s.cor}`}>{s.value}</p>
                  <p className="text-xs text-slate-500" style={{ marginTop: '3px' }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>Por Tipo</p>
                <div className="flex flex-col gap-2">
                  {eventosIndicadores.porTipo.slice(0, 5).map(t => {
                    const TIPO_LABEL: Record<string, string> = { queda: 'Queda', erro_medicacao: 'Erro Medicação', near_miss: 'Near Miss', infecao: 'Infeção', lesao_pressao: 'Lesão Pressão', outro: 'Outro' };
                    const max = Math.max(...eventosIndicadores.porTipo.map(x => x.total), 1);
                    return (
                      <div key={t.tipo} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-28 shrink-0">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${Math.round((t.total / max) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-4 text-right">{t.total}</span>
                      </div>
                    );
                  })}
                  {eventosIndicadores.porTipo.length === 0 && <p className="text-xs text-slate-400">Sem dados</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>Por Gravidade</p>
                <div className="flex flex-col gap-2">
                  {(['obito', 'dano_grave', 'dano_moderado', 'dano_leve', 'sem_dano'] as const).map(g => {
                    const item = eventosIndicadores.porGravidade.find(x => x.gravidade === g);
                    if (!item) return null;
                    const LABEL: Record<string, string> = { sem_dano: 'Sem Dano', dano_leve: 'Dano Leve', dano_moderado: 'Moderado', dano_grave: 'Grave', obito: 'Óbito' };
                    const COR: Record<string, string> = { sem_dano: 'bg-green-400', dano_leve: 'bg-yellow-400', dano_moderado: 'bg-orange-400', dano_grave: 'bg-red-500', obito: 'bg-slate-700' };
                    const max = Math.max(...eventosIndicadores.porGravidade.map(x => x.total), 1);
                    return (
                      <div key={g} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 w-28 shrink-0">{LABEL[g]}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className={`${COR[g]} h-2 rounded-full transition-all`} style={{ width: `${Math.round((item.total / max) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 w-4 text-right">{item.total}</span>
                      </div>
                    );
                  })}
                  {eventosIndicadores.porGravidade.length === 0 && <p className="text-xs text-slate-400">Sem dados</p>}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
