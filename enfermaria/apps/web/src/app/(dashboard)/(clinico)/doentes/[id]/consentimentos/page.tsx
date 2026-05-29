'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

const TIPOS: Record<string, string> = {
  cirurgia: 'Cirurgia',
  procedimento_invasivo: 'Procedimento Invasivo',
  anestesia: 'Anestesia',
  transfusao: 'Transfusão',
  outro: 'Outro',
};

export default function ConsentimentosPage() {
  const { id: doenteId } = useParams<{ id: string }>();
  const router = useRouter();
  const { utilizador } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [modalCriar, setModalCriar] = useState(false);
  const [modalAssinar, setModalAssinar] = useState<string | null>(null);
  const [modalRecusar, setModalRecusar] = useState<string | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');

  // Form criar consentimento
  const [tipo, setTipo] = useState('cirurgia');
  const [descricao, setDescricao] = useState('');
  const [confirmacaoAssinar, setConfirmacaoAssinar] = useState(false);

  const podeCriar = ['medico', 'chefe_turno', 'direcao'].includes(utilizador?.role ?? '');

  const { data: consentimentos, isLoading } = useQuery({
    queryKey: ['consentimentos', doenteId],
    queryFn: async () => {
      const { data } = await api.get(`/consentimentos/doente/${doenteId}`);
      return data as any[];
    },
  });

  const criarMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/consentimentos', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Consentimento criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['consentimentos', doenteId] });
      setModalCriar(false);
      setTipo('cirurgia');
      setDescricao('');
    },
    onError: () => toast.error('Erro ao criar consentimento'),
  });

  const assinarMutation = useMutation({
    mutationFn: async (consentimentoId: string) => {
      const { data } = await api.post(`/consentimentos/${consentimentoId}/assinar`, {
        testemunhaId: utilizador?.id,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Consentimento assinado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['consentimentos', doenteId] });
      setModalAssinar(null);
      setConfirmacaoAssinar(false);
    },
    onError: () => toast.error('Erro ao assinar consentimento'),
  });

  const recusarMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.post(`/consentimentos/${id}/recusar`, { motivo });
      return data;
    },
    onSuccess: () => {
      toast.success('Recusa registada');
      queryClient.invalidateQueries({ queryKey: ['consentimentos', doenteId] });
      setModalRecusar(null);
      setMotivoRecusa('');
    },
    onError: () => toast.error('Erro ao registar recusa'),
  });

  const getEstadoBadge = (c: any) => {
    if (c.recusado) return { text: 'Recusado', cls: 'bg-red-100 text-red-700' };
    if (c.assinadoDoenteEm) return { text: 'Assinado', cls: 'bg-green-100 text-green-700' };
    return { text: 'Pendente', cls: 'bg-amber-100 text-amber-700' };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Consentimentos Informados</h1>
            <p className="text-slate-500 text-sm">Registo de consentimentos do doente</p>
          </div>
          {podeCriar && (
            <button
              onClick={() => setModalCriar(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Consentimento
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : !consentimentos?.length ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-slate-500 text-sm">Nenhum consentimento registado para este doente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {consentimentos.map((c: any) => {
              const badge = getEstadoBadge(c);
              return (
                <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{TIPOS[c.tipo] ?? c.tipo}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{c.descricao}</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-0.5">
                    <p>Criado por {c.criadoPor?.nome ?? '—'} em {new Date(c.criadoEm).toLocaleString('pt-PT')}</p>
                    {c.assinadoDoenteEm && (
                      <p className="text-green-600">
                        Assinado pelo doente em {new Date(c.assinadoDoenteEm).toLocaleString('pt-PT')}
                      </p>
                    )}
                    {c.assinadoTestemunhaEm && c.testemunha && (
                      <p className="text-green-600">
                        Testemunhado por {c.testemunha.nome} em {new Date(c.assinadoTestemunhaEm).toLocaleString('pt-PT')}
                      </p>
                    )}
                    {c.recusado && c.motivoRecusa && (
                      <p className="text-red-600">Motivo de recusa: {c.motivoRecusa}</p>
                    )}
                  </div>

                  {!c.assinadoDoenteEm && !c.recusado && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setModalAssinar(c.id)}
                        className="flex-1 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Registar Assinatura
                      </button>
                      <button
                        onClick={() => { setModalRecusar(c.id); setMotivoRecusa(''); }}
                        className="flex-1 py-1.5 text-xs font-semibold border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Registar Recusa
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Criar consentimento */}
      {modalCriar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Novo Consentimento Informado</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TIPOS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do procedimento</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                  placeholder="Descreva o procedimento para o qual é solicitado consentimento..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setModalCriar(false)}
                className="flex-1 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => criarMutation.mutate({ doenteId, tipo, descricao })}
                disabled={!descricao.trim() || criarMutation.isPending}
                className="flex-1 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {criarMutation.isPending ? 'A criar...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assinar */}
      {modalAssinar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-2">Registar Assinatura</h3>
            <p className="text-sm text-slate-500 mb-5">
              Confirme que o doente foi devidamente informado e assinou o consentimento na presença de um testemunho.
            </p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmacaoAssinar}
                onChange={(e) => setConfirmacaoAssinar(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-slate-700">
                Confirmo que o doente assinou fisicamente o documento de consentimento informado e que uma cópia foi entregue ao doente.
              </span>
            </label>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setModalAssinar(null); setConfirmacaoAssinar(false); }}
                className="flex-1 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => assinarMutation.mutate(modalAssinar)}
                disabled={!confirmacaoAssinar || assinarMutation.isPending}
                className="flex-1 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assinarMutation.isPending ? 'A registar...' : 'Confirmar Assinatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recusar */}
      {modalRecusar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-800 text-lg mb-2">Registar Recusa</h3>
            <p className="text-sm text-slate-500 mb-4">
              O registo de recusa de consentimento é obrigatório por lei e ficará no processo do doente.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da recusa</label>
              <textarea
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                rows={3}
                placeholder="Indique o motivo declarado pelo doente..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalRecusar(null)}
                className="flex-1 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => recusarMutation.mutate({ id: modalRecusar, motivo: motivoRecusa })}
                disabled={!motivoRecusa.trim() || recusarMutation.isPending}
                className="flex-1 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recusarMutation.isPending ? 'A registar...' : 'Registar Recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
