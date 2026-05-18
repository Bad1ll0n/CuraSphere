'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';
import { useToast } from '../../../components/toast';

interface Tarefa {
  id: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  doente?: { nome: string; cama?: { numero: string; quarto: string } };
  criadoPor?: { nome: string };
}

interface PedidoInterno {
  id: string;
  tipo: string;
  descricao: string;
  prioridade: string;
  estado: string;
  servico: string;
  criadoEm: string;
  criadoPor?: { nome: string };
}

interface Equipamento {
  id: string;
  nome: string;
  tipo: string;
  estado: string;
  localizacao?: string;
}

const SUBROLE_TITULO: Record<string, string> = {
  transporte_interno: 'Transporte Interno',
  cssd: 'Esterilização (CSSD)',
  higiene_hospitalar: 'Higiene Hospitalar',
  gestao_textil: 'Gestão Têxtil',
  equipamentos_medicos: 'Engenharia Biomédica',
  facilities: 'Instalações e Manutenção',
  vigilancia: 'Segurança / Vigilância',
  seguranca_trabalho: 'Segurança no Trabalho',
};

const SUBROLE_TIPO_PEDIDO: Record<string, string> = {
  transporte_interno: 'transporte',
  cssd: 'esterilizacao',
  higiene_hospitalar: 'limpeza',
  gestao_textil: 'outro',
  equipamentos_medicos: 'equipamento',
  facilities: 'equipamento',
  vigilancia: 'outro',
  seguranca_trabalho: 'outro',
};

const PRIORIDADE_COR: Record<string, string> = {
  urgente: 'bg-red-50 text-red-700 border-red-200',
  alta:    'bg-orange-50 text-orange-700 border-orange-200',
  media:   'bg-amber-50 text-amber-700 border-amber-200',
  baixa:   'bg-slate-50 text-slate-600 border-slate-200',
};

const ESTADO_COR: Record<string, string> = {
  pendente:     'bg-amber-50 text-amber-700 border-amber-200',
  em_progresso: 'bg-blue-50 text-blue-700 border-blue-200',
  concluido:    'bg-green-50 text-green-700 border-green-200',
  em_curso:     'bg-blue-50 text-blue-700 border-blue-200',
  cancelado:    'bg-slate-100 text-slate-500 border-slate-200',
};

const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Pendente', em_progresso: 'Em Progresso', concluido: 'Concluído',
  em_curso: 'Em Curso', cancelado: 'Cancelado',
};

const TIPO_PEDIDO_LABEL: Record<string, string> = {
  transporte: 'Transporte', limpeza: 'Limpeza', esterilizacao: 'Esterilização',
  equipamento: 'Equipamento', outro: 'Outro',
};

export default function OperacionalPage() {
  const { utilizador } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const subRole = utilizador?.subRole ?? '';
  const tipoPedido = SUBROLE_TIPO_PEDIDO[subRole];

  const { data: tarefas = [], isLoading: loadTarefas } = useQuery<Tarefa[]>({
    queryKey: ['tarefas-operacional'],
    queryFn: () => api.get('/tarefas').then(r => (Array.isArray(r.data) ? r.data : r.data.tarefas ?? [])).catch(() => []),
    staleTime: 30_000,
  });

  const { data: pedidos = [], isLoading: loadPedidos } = useQuery<PedidoInterno[]>({
    queryKey: ['pedidos-operacional', tipoPedido],
    queryFn: () => {
      const url = tipoPedido ? `/pedidos-internos?tipo=${tipoPedido}` : '/pedidos-internos';
      return api.get(url).then(r => r.data).catch(() => []);
    },
    staleTime: 30_000,
  });

  const { data: equipamentos = [] } = useQuery<Equipamento[]>({
    queryKey: ['equipamentos-manutencao'],
    queryFn: () => api.get('/equipamentos?estado=em_manutencao').then(r => r.data).catch(() => []),
    enabled: ['equipamentos_medicos', 'facilities'].includes(subRole),
    staleTime: 60_000,
  });

  const mutConcluirTarefa = useMutation({
    mutationFn: (id: string) => api.patch(`/tarefas/${id}/concluir`),
    onSuccess: () => { toast.success('Tarefa concluída'); qc.invalidateQueries({ queryKey: ['tarefas-operacional'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao concluir tarefa'),
  });

  const mutConcluirPedido = useMutation({
    mutationFn: (id: string) => api.patch(`/pedidos-internos/${id}/concluir`),
    onSuccess: () => { toast.success('Pedido concluído'); qc.invalidateQueries({ queryKey: ['pedidos-operacional'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao concluir pedido'),
  });

  const tarefasAtivas = tarefas.filter(t => t.estado === 'pendente' || t.estado === 'em_progresso');
  const pedidosPendentes = pedidos.filter(p => p.estado === 'pendente' || p.estado === 'em_curso');

  const loading = loadTarefas || loadPedidos;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="text-2xl font-bold text-slate-900">
          {SUBROLE_TITULO[subRole] ?? 'Operacional'}
        </h1>
        <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>
          Resumo das tarefas e pedidos do dia
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '60px 0' }}>
          <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Cards de resumo */}
          <div className={`grid gap-4 ${['equipamentos_medicos', 'facilities'].includes(subRole) ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl" style={{ padding: '20px 24px' }}>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Tarefas Activas</p>
              <p className="text-3xl font-bold text-amber-700" style={{ marginTop: '6px' }}>{tarefasAtivas.length}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl" style={{ padding: '20px 24px' }}>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Pedidos {tipoPedido ? TIPO_PEDIDO_LABEL[tipoPedido] : 'Internos'} Pendentes
              </p>
              <p className="text-3xl font-bold text-blue-700" style={{ marginTop: '6px' }}>{pedidosPendentes.length}</p>
            </div>
            {['equipamentos_medicos', 'facilities'].includes(subRole) && (
              <div className="bg-red-50 border border-red-100 rounded-2xl" style={{ padding: '20px 24px' }}>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Equipamentos em Manutenção</p>
                <p className="text-3xl font-bold text-red-700" style={{ marginTop: '6px' }}>{equipamentos.length}</p>
              </div>
            )}
          </div>

          {/* Pedidos internos */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>
              Pedidos {tipoPedido ? TIPO_PEDIDO_LABEL[tipoPedido] : 'Internos'} — Pendentes
            </h2>
            {pedidosPendentes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '40px' }}>
                <p className="text-sm text-slate-400">Sem pedidos pendentes</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pedidosPendentes.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4" style={{ padding: '16px 20px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                        <span className="text-sm font-semibold text-slate-800">{p.descricao}</span>
                        <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${PRIORIDADE_COR[p.prioridade] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {p.prioridade}
                        </span>
                        <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${ESTADO_COR[p.estado] ?? ''}`}>
                          {ESTADO_LABEL[p.estado] ?? p.estado}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {p.servico}{p.criadoPor ? ` · ${p.criadoPor.nome}` : ''} · {new Date(p.criadoEm).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                    <button
                      onClick={() => mutConcluirPedido.mutate(p.id)}
                      className="shrink-0 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      style={{ padding: '7px 14px' }}>
                      Concluído
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tarefas activas */}
          <section>
            <h2 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>Tarefas Activas</h2>
            {tarefasAtivas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center" style={{ padding: '40px' }}>
                <p className="text-sm text-slate-400">Sem tarefas activas</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tarefasAtivas.map(t => (
                  <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4" style={{ padding: '16px 20px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
                        <span className="text-sm font-semibold text-slate-800">{t.titulo}</span>
                        <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${PRIORIDADE_COR[t.prioridade] ?? ''}`}>{t.prioridade}</span>
                        <span className={`text-xs font-medium badge-pad py-0.5 rounded-full border ${ESTADO_COR[t.estado] ?? ''}`}>{ESTADO_LABEL[t.estado] ?? t.estado}</span>
                      </div>
                      {t.doente && (
                        <p className="text-xs text-slate-500">
                          {t.doente.nome}{t.doente.cama ? ` · Cama ${t.doente.cama.numero} (${t.doente.cama.quarto})` : ''}
                        </p>
                      )}
                      {t.prazo && (
                        <p className="text-xs text-slate-400">Prazo: {new Date(t.prazo).toLocaleDateString('pt-PT')}</p>
                      )}
                    </div>
                    <button
                      onClick={() => mutConcluirTarefa.mutate(t.id)}
                      className="shrink-0 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      style={{ padding: '7px 14px' }}>
                      Concluída
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Equipamentos em manutenção (só para sub-roles relevantes) */}
          {['equipamentos_medicos', 'facilities'].includes(subRole) && equipamentos.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '12px' }}>Equipamentos em Manutenção</h2>
              <div className="flex flex-col gap-3">
                {equipamentos.map(e => (
                  <div key={e.id} className="bg-white rounded-2xl border border-red-100 shadow-sm" style={{ padding: '16px 20px' }}>
                    <p className="text-sm font-semibold text-slate-800">{e.nome}</p>
                    <p className="text-xs text-slate-500" style={{ marginTop: '2px' }}>
                      {e.tipo}{e.localizacao ? ` · ${e.localizacao}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
