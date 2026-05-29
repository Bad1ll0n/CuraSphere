'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

const RELATORIOS = [
  {
    key: 'internamento',
    label: 'Demora Média de Internamento',
    desc: 'Tempo médio de internamento por serviço',
    icon: '🏥',
    color: 'blue',
  },
  {
    key: 'ocupacao',
    label: 'Taxa de Ocupação de Camas',
    desc: 'Ocupação actual e por período',
    icon: '🛏️',
    color: 'indigo',
  },
  {
    key: 'diagnosticos',
    label: 'Top 20 Diagnósticos',
    desc: 'Diagnósticos mais frequentes no período',
    icon: '🩺',
    color: 'violet',
  },
  {
    key: 'medicamentos',
    label: 'Consumo de Medicamentos',
    desc: 'Top 20 medicamentos administrados',
    icon: '💊',
    color: 'emerald',
  },
  {
    key: 'urgencia',
    label: 'Episódios de Urgência',
    desc: 'Episódios e distribuição por triagem',
    icon: '🚨',
    color: 'red',
  },
];

export default function RelatoriosPage() {
  const { utilizador } = useAuth();
  const toast = useToast();
  const [relatorioAtivo, setRelatorioAtivo] = useState<string | null>(null);
  const [inicio, setInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [fim, setFim] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['relatorio', relatorioAtivo, inicio, fim],
    queryFn: async () => {
      if (!relatorioAtivo) return null;
      const { data } = await api.get(`/relatorios/${relatorioAtivo}?inicio=${inicio}&fim=${fim}`);
      return data;
    },
    enabled: !!relatorioAtivo,
  });

  const permitido = ['direcao', 'administrativo', 'ti'].includes(utilizador?.role ?? '');
  if (!permitido) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Acesso não autorizado</p>
          <p className="text-sm text-slate-500 mt-1">Apenas direção, administrativo e TI podem aceder aos relatórios.</p>
        </div>
      </div>
    );
  }

  const downloadCSV = async (key: string) => {
    try {
      const resp = await api.get(`/relatorios/${key}?inicio=${inicio}&fim=${fim}`, {
        headers: { Accept: 'text/csv' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${key}-${inicio}-${fim}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao exportar CSV');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Relatórios DGS / SNS</h1>
          <p className="text-slate-500 text-sm mt-1">Estatísticas para reporte às autoridades de saúde</p>
        </div>

        {/* Filtro de período */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">De</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Até</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {relatorioAtivo && (
            <button
              onClick={() => refetch()}
              className="ml-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Atualizar
            </button>
          )}
        </div>

        {/* Grid de relatórios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {RELATORIOS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRelatorioAtivo(r.key)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                relatorioAtivo === r.key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <div className="text-2xl mb-2">{r.icon}</div>
              <div className="font-semibold text-slate-800 text-sm">{r.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>

        {/* Resultados */}
        {relatorioAtivo && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">
                {RELATORIOS.find((r) => r.key === relatorioAtivo)?.label}
              </h2>
              <button
                onClick={() => downloadCSV(relatorioAtivo)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar CSV
              </button>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            )}

            {data && !isLoading && (
              <div>
                {/* Cabeçalho de período */}
                <p className="text-xs text-slate-500 mb-4">
                  Período: {new Date(data.periodo?.inicio).toLocaleDateString('pt-PT')} — {new Date(data.periodo?.fim).toLocaleDateString('pt-PT')}
                </p>

                {/* Internamento */}
                {relatorioAtivo === 'internamento' && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-700">{data.totalInternamentos}</div>
                        <div className="text-xs text-blue-600">Total internamentos</div>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 text-slate-600">Serviço</th>
                          <th className="text-right py-2 text-slate-600">Total</th>
                          <th className="text-right py-2 text-slate-600">Demora Média (dias)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.resumoPorServico ?? []).map((s: any) => (
                          <tr key={s.servico} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 font-medium">{s.servico}</td>
                            <td className="py-2 text-right">{s.totalInternamentos}</td>
                            <td className="py-2 text-right font-semibold text-blue-700">{s.demoraMediaDias}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Ocupação */}
                {relatorioAtivo === 'ocupacao' && (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-slate-700">{data.totalCamas}</div>
                        <div className="text-xs text-slate-500">Total camas</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-700">{data.internamentosAtivos}</div>
                        <div className="text-xs text-red-500">Ocupadas agora</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-700">{data.taxaOcupacaoAtual}%</div>
                        <div className="text-xs text-blue-500">Taxa ocupação</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(data.estadoAtualCamas ?? []).map((e: any) => (
                        <div key={e.estado} className="bg-slate-100 rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium">{e.estado}</span>: {e.count}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diagnósticos e Medicamentos */}
                {(relatorioAtivo === 'diagnosticos' || relatorioAtivo === 'medicamentos') && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 text-slate-600">#</th>
                        <th className="text-left py-2 text-slate-600">
                          {relatorioAtivo === 'diagnosticos' ? 'Diagnóstico' : 'Medicamento'}
                        </th>
                        <th className="text-right py-2 text-slate-600">
                          {relatorioAtivo === 'diagnosticos' ? 'Casos' : 'Administrações'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.top20 ?? []).map((item: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 text-slate-400 text-xs">{i + 1}</td>
                          <td className="py-2">{item.diagnostico ?? item.medicamento}</td>
                          <td className="py-2 text-right font-semibold">{item.total ?? item.administracoes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Urgência */}
                {relatorioAtivo === 'urgencia' && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-700">{data.totalEpisodios}</div>
                        <div className="text-xs text-red-500">Total episódios</div>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 text-slate-600">Nível de Triagem</th>
                          <th className="text-right py-2 text-slate-600">Episódios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.distribuicaoPorTriagem ?? []).map((t: any) => (
                          <tr key={t.triagem} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 font-medium">{t.triagem}</td>
                            <td className="py-2 text-right">{t.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
