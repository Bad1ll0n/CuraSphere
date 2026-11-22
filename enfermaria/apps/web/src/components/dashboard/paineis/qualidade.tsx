'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AtalhoModulo, DashboardHeader } from '../partilhado';

export function DashboardQualidade({ utilizador }: { utilizador: any }) {
  const t = useTranslations('qualityDashboard');
  return (
    <>
      <DashboardHeader utilizador={utilizador} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ marginBottom: '24px' }}>
        <AtalhoModulo href="/eventos-adversos" titulo="Eventos Adversos" descricao="Notificação, análise e seguimento de incidentes e eventos adversos" />
        <AtalhoModulo href="/iacs" titulo="Controlo de Infeção (IACS)" descricao="Doentes em isolamento, alertas de surto e vigilância epidemiológica" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* PROD-18: os indicadores de enfermagem já existem. */}
        <Link href="/dashboard-qualidade/indicadores" className="bg-white rounded-2xl border border-blue-200 shadow-sm hover:bg-blue-50/40 block" style={{ padding: '24px' }}>
          <p className="text-sm font-semibold text-slate-800">{t('indicatorsTitle')}</p>
          <p className="text-sm text-slate-500" style={{ marginTop: '6px' }}>{t('indicatorsBody')}</p>
          <span className="inline-block text-xs font-semibold text-blue-700" style={{ marginTop: '12px' }}>{t('open')} →</span>
        </Link>
        <AtalhoModulo href="/auditoria" titulo="Trilho de Auditoria" descricao="Quem acedeu e alterou o quê, com pesquisa por doente e por utilizador" />
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
