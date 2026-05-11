'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';

interface DashboardRH {
  ausenciasPendentes: number;
  ausenciasAtivas: number;
  formacoesAExpirar: number;
  totalStaff: number;
  contratosAExpirar: number;
  avaliacoesPendentes: number;
}

function StatCard({ label, value, cor, href }: { label: string; value: number; cor: string; href: string }) {
  const cores: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  return (
    <Link href={href}
      className={`flex flex-col rounded-2xl border shadow-sm hover:shadow-md transition-shadow ${cores[cor]}`}
      style={{ padding: '24px' }}>
      <span className="text-3xl font-bold" style={{ marginBottom: '6px' }}>{value}</span>
      <span className="text-sm font-medium opacity-80">{label}</span>
    </Link>
  );
}

export default function RhDashboard() {
  const { data: dados, isLoading: loading } = useQuery<DashboardRH>({
    queryKey: ['rh-dashboard'],
    queryFn: () => api.get('/rh/dashboard').then(r => r.data),
    staleTime: 60_000,
  });

  return (
    <div style={{ padding: '32px 40px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="text-2xl font-bold text-slate-900">Recursos Humanos</h1>
        <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>
          Gestão de ausências, férias e formações do staff
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : dados ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '32px' }}>
            <StatCard label="Total de Staff Ativo" value={dados.totalStaff} cor="slate" href="/rh/pessoal" />
            <StatCard label="Ausências a Aprovar" value={dados.ausenciasPendentes} cor="amber" href="/rh/ausencias?estado=pendente" />
            <StatCard label="Em Ausência Hoje" value={dados.ausenciasAtivas} cor="blue" href="/rh/ausencias?estado=aprovada" />
            <StatCard label="Formações a Expirar (30d)" value={dados.formacoesAExpirar} cor="red" href="/rh/formacoes" />
            <StatCard label="Contratos a Expirar (60d)" value={dados.contratosAExpirar ?? 0} cor="red" href="/rh/pessoal" />
            <StatCard label="Avaliações Pendentes" value={dados.avaliacoesPendentes ?? 0} cor="amber" href="/rh/avaliacoes" />
          </div>

          {/* Quick links */}
          <div className="flex flex-col gap-3">
            {[
              { href: '/rh/ausencias', label: 'Gerir Ausências e Férias', desc: 'Aprovar pedidos, ver calendário de ausências', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { href: '/rh/formacoes', label: 'Registo de Formações', desc: 'Formações obrigatórias e certificações por colaborador', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { href: '/rh/pessoal', label: 'Gestão de Pessoal', desc: 'Dados contratuais, vínculos e saldo de férias por colaborador', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { href: '/rh/avaliacoes', label: 'Avaliações de Desempenho', desc: 'Criar e acompanhar avaliações anuais por colaborador', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md flex items-center gap-4 transition-shadow"
                style={{ padding: '20px 24px' }}>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={l.icon} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{l.label}</p>
                  <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>{l.desc}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">Erro ao carregar dados.</p>
      )}
    </div>
  );
}
