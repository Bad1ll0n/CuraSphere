'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import api from '../../../lib/api';

interface Doente { id: string; nome: string; estado: string; cama: { numero: string; quarto: string } }
interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  criadaEm: string;
  grupoResponsavel?: string;
  doente: Doente;
  criadoPor?: { id: string; nome: string; role: string };
  responsavel?: { id: string; nome: string; role: string };
}

const ORDEM_PRIORIDADE = ['urgente', 'alta', 'media', 'baixa'];

const prioridadeConfig: Record<string, { label: string; cor: string; bg: string; dot: string }> = {
  urgente: { label: 'Urgente', cor: 'text-red-700',    bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500' },
  alta:    { label: 'Alta',    cor: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  media:   { label: 'Média',   cor: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500' },
  baixa:   { label: 'Baixa',   cor: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400' },
};

const estadoDoenteCor: Record<string, string> = {
  estavel:       'bg-green-50 text-green-700',
  grave:         'bg-orange-50 text-orange-700',
  critico:       'bg-red-50 text-red-700',
  alta_prevista: 'bg-blue-50 text-blue-700',
};
const estadoDoenteLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const estadoTarefaCor: Record<string, string> = {
  pendente:     'bg-amber-50 text-amber-700 border-amber-200',
  em_progresso: 'bg-blue-50 text-blue-700 border-blue-200',
};
const estadoTarefaLabel: Record<string, string> = {
  pendente: 'Pendente', em_progresso: 'Em progresso',
};

const ROLES_CRIAR_TAREFA = ['enfermeiro', 'medico', 'chefe_turno', 'chefe_enfermeiros', 'chefe_medicos'];

export default function TarefasPage() {
  const { utilizador } = useAuth();
  const router = useRouter();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  // Modal nova tarefa
  const [modalNovaTarefa, setModalNovaTarefa] = useState(false);
  const [doentes, setDoentes] = useState<{ id: string; nome: string; cama: { quarto: string; numero: string } }[]>([]);
  const [searchDoente, setSearchDoente] = useState('');
  const [doenteSelId, setDoenteSelId] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tTipo, setTTipo] = useState<'clinica' | 'logistica'>('clinica');
  const [tPrioridade, setTPrioridade] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [tGrupo, setTGrupo] = useState<'enfermeiro' | 'medico' | 'auxiliar'>('enfermeiro');
  const [tPrazo, setTPrazo] = useState('');
  const [criando, setCriando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/tarefas/minhas');
      setTarefas(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirModalNovaTarefa = async () => {
    setTDesc(''); setDoenteSelId(''); setSearchDoente('');
    setTTipo('clinica'); setTPrioridade('media'); setTGrupo('enfermeiro'); setTPrazo('');
    setModalNovaTarefa(true);
    try {
      const r = await api.get('/doentes?todos=true');
      setDoentes(r.data);
    } catch { setDoentes([]); }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const criarTarefa = async () => {
    if (!doenteSelId || !tDesc.trim()) return;
    setCriando(true);
    try {
      await api.post(`/doentes/${doenteSelId}/tarefa`, {
        descricao: tDesc,
        tipo: tTipo,
        prioridade: tPrioridade,
        grupoResponsavel: tGrupo,
        prazo: tPrazo ? new Date(tPrazo) : undefined,
      });
      setModalNovaTarefa(false);
      await carregar();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally {
      setCriando(false);
    }
  };

  const marcarProgresso = async (tarefa: Tarefa) => {
    setAtualizando(tarefa.id);
    try {
      const novoEstado = tarefa.estado === 'pendente' ? 'em_progresso' : 'pendente';
      await api.patch(`/tarefas/${tarefa.id}/estado`, { estado: novoEstado });
      await carregar();
    } finally {
      setAtualizando(null);
    }
  };

  const marcarConcluida = async (tarefaId: string) => {
    setAtualizando(tarefaId);
    try {
      await api.patch(`/tarefas/${tarefaId}/estado`, { estado: 'concluida' });
      await carregar();
    } finally {
      setAtualizando(null);
    }
  };

  // Agrupar por prioridade
  const grupos = ORDEM_PRIORIDADE
    .map((p) => ({ prioridade: p, itens: tarefas.filter((t) => t.prioridade === p) }))
    .filter((g) => g.itens.length > 0);

  const totalUrgentes = tarefas.filter((t) => t.prioridade === 'urgente').length;

  return (
    <div style={{ padding: '40px 48px', maxWidth: '860px', margin: '0 auto' }}>

      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <div className="flex items-center gap-3" style={{ marginBottom: '6px' }}>
            <h1 className="text-3xl font-bold text-slate-900">As Minhas Tarefas</h1>
            {totalUrgentes > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {totalUrgentes} urgente{totalUrgentes > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Tarefas pendentes dos teus doentes neste turno</p>
        </div>
        <div className="flex items-center gap-3">
          {ROLES_CRIAR_TAREFA.includes(utilizador?.role ?? '') && (
            <button onClick={abrirModalNovaTarefa}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ padding: '9px 18px' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Tarefa
            </button>
          )}
          <button onClick={carregar}
            className="flex items-center gap-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
            style={{ padding: '9px 16px' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 text-slate-400" style={{ paddingTop: '80px' }}>
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">A carregar tarefas...</span>
        </div>
      ) : tarefas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center" style={{ padding: '80px' }}>
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center" style={{ marginBottom: '16px' }}>
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold" style={{ marginBottom: '6px' }}>Sem tarefas pendentes</p>
          <p className="text-slate-400 text-sm">Sem tarefas pendentes para os teus doentes neste turno</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(({ prioridade, itens }) => {
            const cfg = prioridadeConfig[prioridade];
            return (
              <div key={prioridade}>
                {/* Cabeçalho do grupo */}
                <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className={`text-sm font-bold ${cfg.cor}`}>{cfg.label}</span>
                  <span className="text-xs text-slate-400 font-medium">{itens.length} tarefa{itens.length !== 1 ? 's' : ''}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Cartões */}
                <div className="flex flex-col gap-3">
                  {itens.map((tarefa) => (
                    <TarefaCard
                      key={tarefa.id}
                      tarefa={tarefa}
                      atualizando={atualizando === tarefa.id}
                      onVerDoente={() => router.push(`/doentes/${tarefa.doente.id}`)}
                      onToggleProgresso={() => marcarProgresso(tarefa)}
                      onConcluir={() => marcarConcluida(tarefa.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Tarefa */}
      {modalNovaTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Nova Tarefa</h2>
              <button onClick={() => setModalNovaTarefa(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>

            {/* Doente */}
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Doente *</label>
              <input
                ref={inputRef}
                type="text"
                placeholder="Pesquisar doente..."
                value={searchDoente}
                onChange={(e) => { setSearchDoente(e.target.value); setDoenteSelId(''); }}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }}
              />
              {searchDoente.length >= 2 && !doenteSelId && (
                <div className="border border-slate-200 rounded-xl bg-white shadow-lg" style={{ maxHeight: '160px', overflowY: 'auto', marginTop: '4px' }}>
                  {doentes.filter((d) => d.nome.toLowerCase().includes(searchDoente.toLowerCase())).slice(0, 8).map((d) => (
                    <button key={d.id} onClick={() => { setDoenteSelId(d.id); setSearchDoente(d.nome); }}
                      className="w-full text-left text-sm hover:bg-slate-50 transition-colors"
                      style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <span className="font-medium text-slate-800">{d.nome}</span>
                      <span className="text-slate-400 text-xs" style={{ marginLeft: '8px' }}>Q{d.cama.quarto}/C{d.cama.numero}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Descrição */}
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
              <textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)}
                placeholder="Descrever a tarefa..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ padding: '10px 14px' }} />
            </div>

            {/* Tipo + Prioridade */}
            <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '16px' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</label>
                <div className="flex gap-2">
                  {(['clinica', 'logistica'] as const).map((t) => (
                    <button key={t} onClick={() => setTTipo(t)}
                      className={`flex-1 text-xs font-semibold rounded-lg border py-2 transition-colors ${tTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                      {t === 'clinica' ? 'Clínica' : 'Logística'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Prioridade</label>
                <select value={tPrioridade} onChange={(e) => setTPrioridade(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            {/* Grupo + Prazo */}
            <div className="grid grid-cols-2 gap-4" style={{ marginBottom: '24px' }}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Grupo Responsável</label>
                <select value={tGrupo} onChange={(e) => setTGrupo(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }}>
                  <option value="enfermeiro">Enfermagem</option>
                  <option value="medico">Médico</option>
                  <option value="auxiliar">Auxiliar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Prazo</label>
                <input type="datetime-local" value={tPrazo} onChange={(e) => setTPrazo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '8px 12px' }} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalNovaTarefa(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>
                Cancelar
              </button>
              <button onClick={criarTarefa} disabled={criando || !doenteSelId || !tDesc.trim()}
                className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ padding: '11px 24px', flex: 2 }}>
                {criando ? 'A criar...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TarefaCard({ tarefa, atualizando, onVerDoente, onToggleProgresso, onConcluir }: {
  tarefa: Tarefa;
  atualizando: boolean;
  onVerDoente: () => void;
  onToggleProgresso: () => void;
  onConcluir: () => void;
}) {
  const prazoDate = tarefa.prazo ? new Date(tarefa.prazo) : null;
  const atrasada = prazoDate && prazoDate < new Date();

  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${atrasada ? 'border-red-200' : 'border-slate-100'}`}
      style={{ padding: '20px 24px' }}>
      <div className="flex items-start gap-4">

        {/* Check circle */}
        <button
          onClick={onConcluir}
          disabled={atualizando}
          title="Marcar como concluída"
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
            tarefa.estado === 'em_progresso'
              ? 'border-blue-400 bg-blue-50 hover:bg-blue-100'
              : 'border-slate-300 hover:border-green-400 hover:bg-green-50'
          } disabled:opacity-40`}>
          {tarefa.estado === 'em_progresso' && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
        </button>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800 leading-snug">{tarefa.descricao}</p>
            <span className={`text-xs font-medium rounded-lg border shrink-0 ${estadoTarefaCor[tarefa.estado]}`} style={{ padding: '6px 12px' }}>
              {estadoTarefaLabel[tarefa.estado]}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '8px' }}>
            {/* Doente */}
            <button onClick={onVerDoente}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {tarefa.doente.nome}
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${estadoDoenteCor[tarefa.doente.estado]}`}>
                {estadoDoenteLabel[tarefa.doente.estado]}
              </span>
            </button>

            <span className="text-slate-200 text-xs">·</span>

            {/* Cama */}
            <span className="text-xs text-slate-400">
              Q{tarefa.doente.cama.quarto} · C{tarefa.doente.cama.numero}
            </span>

            <span className="text-slate-200 text-xs">·</span>

            {/* Tipo */}
            <span className="text-xs text-slate-400">
              {tarefa.tipo === 'clinica' ? 'Clínica' : 'Logística'}
            </span>

            {/* Criador */}
            {tarefa.criadoPor && (
              <>
                <span className="text-slate-200 text-xs">·</span>
                <span className="text-xs text-slate-400">
                  Por {tarefa.criadoPor.nome} às {new Date(tarefa.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}

            {/* Prazo */}
            {prazoDate && (
              <>
                <span className="text-slate-200 text-xs">·</span>
                <span className={`text-xs font-medium ${atrasada ? 'text-red-600' : 'text-slate-500'}`}>
                  {atrasada ? '⚠ ' : ''}Prazo: {prazoDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Botão progresso */}
        <button
          onClick={onToggleProgresso}
          disabled={atualizando}
          className={`text-xs font-medium rounded-lg border transition-colors shrink-0 disabled:opacity-40 ${
            tarefa.estado === 'em_progresso'
              ? 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
          style={{ padding: '6px 12px' }}>
          {tarefa.estado === 'em_progresso' ? 'Pausar' : 'Iniciar'}
        </button>
      </div>
    </div>
  );
}
