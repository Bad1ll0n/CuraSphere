'use client';

import { useTranslations } from 'next-intl';
import { StatCard, EmBreve, DashboardHeader } from '../partilhado';

export function DashboardQualidade({ utilizador }: { utilizador: any }) {
  const tCommon = useTranslations('common');
  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: '32px' }}>
        <StatCard label="Não Conformidades" value="—" color="bg-slate-400" sub={tCommon('comingSoon')} />
        <StatCard label="Auditorias Pendentes" value="—" color="bg-slate-400" sub={tCommon('comingSoon')} />
        <StatCard label="IACS Ativos" value="—" color="bg-slate-400" sub={tCommon('comingSoon')} />
      </div>

      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <EmBreve titulo="Gestão de Não Conformidades" descricao="Registo, análise e planos de ação corretiva (CAPA)" />
        <EmBreve titulo="Controlo de Infeção (IACS)" descricao="Doentes em isolamento, alertas de surto, relatórios epidemiológicos" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <EmBreve titulo="Indicadores de Qualidade" descricao="KPIs: taxa de infeção, quedas, úlceras por pressão, reinternamentos" />
        <EmBreve titulo="Auditorias Internas" descricao="Planeamento e seguimento de auditorias por área" />
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl" style={{ padding: '24px', marginTop: '24px' }}>
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-500 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-indigo-800">Módulo de Qualidade em desenvolvimento</p>
            <p className="text-sm text-indigo-600" style={{ marginTop: '4px' }}>
              Não conformidades, controlo de infeção e indicadores de qualidade estarão disponíveis na próxima fase de desenvolvimento.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
