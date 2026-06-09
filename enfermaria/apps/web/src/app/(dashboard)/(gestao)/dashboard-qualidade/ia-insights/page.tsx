'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface TipoStats {
  total: number;
  aceites: number;
  rejeitados: number;
  semFeedback: number;
  motivos: string[];
}

interface InsightsData {
  total: number;
  totalComFeedback: number;
  taxaAceitacaoGlobal: number | null;
  porTipo: Record<string, TipoStats>;
  topMotivosRejeicao: { motivo: string; count: number }[];
}

const LABELS: Record<string, string> = {
  analise: 'Análise Clínica',
  triagem: 'Triagem',
  protocolo: 'Protocolos',
  turno: 'Passagem Turno',
  los: 'Previsão LOS',
  diagnostico_diferencial: 'Diagnóstico Diferencial',
  nlq: 'NLQ (Pesquisa Natural)',
  readmissao: 'Risco Readmissão',
};

const PERIODOS = [
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
];

function taxaColor(taxa: number | null) {
  if (taxa === null) return 'text-slate-400';
  if (taxa >= 80) return 'text-green-600';
  if (taxa >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export default function IaInsightsPage() {
  const [periodoDias, setPeriodoDias] = useState(30);

  const from = new Date(Date.now() - periodoDias * 86_400_000).toISOString();
  const to = new Date().toISOString();

  const { data, isLoading } = useQuery<InsightsData>({
    queryKey: ['ia-insights', periodoDias],
    queryFn: () => api.get(`/ai-clinico/insights?from=${from}&to=${to}`).then(r => r.data),
    refetchInterval: 60_000,
  });

  const tipoEntries = Object.entries(data?.porTipo ?? {}).sort(
    (a, b) => b[1].total - a[1].total
  );

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">IA Insights — Análise de Decisões</h1>
        <p className="text-sm text-slate-500 mt-1">Taxa de aceitação e padrões de rejeição das recomendações clínicas da IA</p>
      </div>

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {PERIODOS.map(p => (
          <button
            key={p.days}
            onClick={() => setPeriodoDias(p.days)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              periodoDias === p.days
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-slate-400 text-sm">A carregar insights...</div>
      )}

      {data && (
        <>
          {/* Cartões de resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total de Decisões</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{data.total}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Com Feedback Clínico</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{data.totalComFeedback}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.total > 0 ? `${Math.round((data.totalComFeedback / data.total) * 100)}% do total` : '—'}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Taxa de Aceitação Global</p>
              <p className={`text-3xl font-bold mt-1 ${taxaColor(data.taxaAceitacaoGlobal)}`}>
                {data.taxaAceitacaoGlobal !== null ? `${data.taxaAceitacaoGlobal}%` : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">sobre decisões com feedback</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
            {/* Tabela por tipo */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Desempenho por Tipo de Decisão</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left px-5 py-2.5">Tipo</th>
                      <th className="text-right px-4 py-2.5">Total</th>
                      <th className="text-right px-4 py-2.5">Aceites</th>
                      <th className="text-right px-4 py-2.5">Rejeitados</th>
                      <th className="text-right px-4 py-2.5">Taxa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {tipoEntries.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">Sem dados para o período seleccionado</td></tr>
                    )}
                    {tipoEntries.map(([tipo, stats]) => {
                      const comFeedback = stats.aceites + stats.rejeitados;
                      const taxa = comFeedback > 0 ? Math.round((stats.aceites / comFeedback) * 100) : null;
                      return (
                        <tr key={tipo} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                            {LABELS[tipo] ?? tipo}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{stats.total}</td>
                          <td className="px-4 py-3 text-right text-green-600">{stats.aceites}</td>
                          <td className="px-4 py-3 text-right text-red-500">{stats.rejeitados}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${taxaColor(taxa)}`}>
                            {taxa !== null ? `${taxa}%` : <span className="text-slate-400">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top motivos de rejeição */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Top Motivos de Rejeição</h2>
              </div>
              <div className="p-4 space-y-2">
                {data.topMotivosRejeicao.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">Sem motivos registados</p>
                )}
                {data.topMotivosRejeicao.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug break-words">{item.motivo}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.count}× registado</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
