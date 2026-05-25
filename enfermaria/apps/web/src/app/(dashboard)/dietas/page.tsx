'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';
import { useToast } from '../../../components/toast';

const TIPOS_DIETA: Record<string, { label: string; cor: string }> = {
  normal: { label: 'Normal', cor: 'bg-slate-100 text-slate-700' },
  hipocalorica: { label: 'Hipocalórica', cor: 'bg-amber-100 text-amber-700' },
  diabetica: { label: 'Diabética', cor: 'bg-orange-100 text-orange-700' },
  renal: { label: 'Renal', cor: 'bg-purple-100 text-purple-700' },
  hepatica: { label: 'Hepática', cor: 'bg-yellow-100 text-yellow-700' },
  liquida: { label: 'Líquida', cor: 'bg-blue-100 text-blue-700' },
  jejum: { label: 'Jejum', cor: 'bg-red-100 text-red-700' },
};

const RESTRICOES_LABELS: Record<string, string> = {
  gluten: 'Glúten',
  lactose: 'Lactose',
  sal: 'Sal',
  potassio: 'Potássio',
  fosforo: 'Fósforo',
  proteina: 'Proteína',
  gordura: 'Gordura',
  acucar: 'Açúcar',
};

export default function DietasPage() {
  const { utilizador } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [abaAtiva, setAbaAtiva] = useState<'hoje' | 'prescrever'>('hoje');
  const [pesquisa, setPesquisa] = useState('');

  // Form para prescrever
  const [doenteId, setDoenteId] = useState('');
  const [tipo, setTipo] = useState('normal');
  const [restricoes, setRestricoes] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  const podePrescrever = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno'].includes(utilizador?.role ?? '');
  const podeCozinha = ['cozinha', 'nutricao', 'direcao', 'ti', 'administrativo'].includes(utilizador?.role ?? '') || podePrescrever;

  const { data: dietasHoje, isLoading } = useQuery({
    queryKey: ['dietas-hoje'],
    queryFn: async () => {
      const { data } = await api.get('/dietas/hoje');
      return data as any[];
    },
    refetchInterval: 60000,
  });

  const prescreverMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/dietas', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Dieta prescrita com sucesso');
      queryClient.invalidateQueries({ queryKey: ['dietas-hoje'] });
      setDoenteId('');
      setTipo('normal');
      setRestricoes([]);
      setObservacoes('');
    },
    onError: () => toast.error('Erro ao prescrever dieta'),
  });

  const toggleRestricao = (r: string) => {
    setRestricoes((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  const dietasFiltradas = (dietasHoje ?? []).filter((d: any) => {
    if (!pesquisa) return true;
    const q = pesquisa.toLowerCase();
    return (
      d.doente?.nome?.toLowerCase().includes(q) ||
      d.doente?.quarto?.toLowerCase().includes(q) ||
      TIPOS_DIETA[d.tipo]?.label.toLowerCase().includes(q)
    );
  });

  if (!podeCozinha) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Acesso não autorizado</p>
          <p className="text-sm text-slate-500 mt-1">Não tem permissão para aceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dietética</h1>
          <p className="text-slate-500 text-sm mt-1">Gestão de dietas dos doentes internados</p>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-200 p-1 w-fit">
          <button
            onClick={() => setAbaAtiva('hoje')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              abaAtiva === 'hoje' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Dietas de Hoje
          </button>
          {podePrescrever && (
            <button
              onClick={() => setAbaAtiva('prescrever')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                abaAtiva === 'prescrever' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Prescrever Dieta
            </button>
          )}
        </div>

        {/* Aba: Dietas de Hoje */}
        {abaAtiva === 'hoje' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Pesquisar por doente, quarto ou tipo..."
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-sm text-slate-500 font-medium whitespace-nowrap">
                {dietasFiltradas.length} doentes
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : dietasFiltradas.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <div className="text-3xl mb-2">🥗</div>
                <p className="text-slate-500 text-sm">Nenhum doente internado com dieta prescrita</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dietasFiltradas.map((d: any) => (
                  <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{d.doente?.nome}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {d.doente?.internamentoAtual?.cama
                            ? `Quarto ${d.doente.internamentoAtual.cama.quarto} · Cama ${d.doente.internamentoAtual.cama.numero}`
                            : 'Localização desconhecida'}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TIPOS_DIETA[d.tipo]?.cor ?? 'bg-slate-100 text-slate-600'}`}>
                        {TIPOS_DIETA[d.tipo]?.label ?? d.tipo}
                      </span>
                    </div>

                    {d.restricoes && d.restricoes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {d.restricoes.map((r: string) => (
                          <span key={r} className="text-xs bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5">
                            Sem {RESTRICOES_LABELS[r] ?? r}
                          </span>
                        ))}
                      </div>
                    )}

                    {d.observacoes && (
                      <p className="text-xs text-slate-500 italic">"{d.observacoes}"</p>
                    )}

                    <p className="text-xs text-slate-400 mt-2">
                      Prescrita por {d.criadaPor?.nome ?? '—'} · {new Date(d.criadaEm).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba: Prescrever */}
        {abaAtiva === 'prescrever' && podePrescrever && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
            <h2 className="font-semibold text-slate-800 mb-5">Nova Prescrição de Dieta</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ID do Doente</label>
                <input
                  type="text"
                  value={doenteId}
                  onChange={(e) => setDoenteId(e.target.value)}
                  placeholder="UUID do doente"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Dieta</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TIPOS_DIETA).map(([key, { label, cor }]) => (
                    <button
                      key={key}
                      onClick={() => setTipo(key)}
                      className={`text-xs font-medium px-2 py-2 rounded-lg border-2 transition-all ${
                        tipo === key
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-blue-300 ' + cor
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Restrições Alimentares</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(RESTRICOES_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleRestricao(key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        restricoes.includes(key)
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-red-300'
                      }`}
                    >
                      {restricoes.includes(key) ? '✓ ' : ''}Sem {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Indicações adicionais para a cozinha..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <button
                onClick={() => prescreverMutation.mutate({ doenteId, tipo, restricoes, observacoes })}
                disabled={!doenteId || prescreverMutation.isPending}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {prescreverMutation.isPending ? 'A prescrever...' : 'Prescrever Dieta'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
