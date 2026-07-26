'use client';
import { useRef, useState, useEffect } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Tarefa {
  id: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  estado: string;
  prazo?: string;
  criadaEm: string;
  concluidaEm?: string;
  grupoResponsavel?: string;
  responsavel?: { id: string; nome: string; role: string };
  criadoPor?: { id: string; nome: string; role: string };
}

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string } | null;
  tarefas: Tarefa[];
  emTurno: boolean;
  onRefresh: () => void;
}

function BtnAdd({ onClick, label = 'Adicionar' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
      style={{ marginLeft: 'auto' }}>
      <svg aria-hidden="true" className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement;
    const firstFocusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();
    return () => previousFocus?.focus();
  }, []);
  useEffect(() => {
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
         style={{ backdropFilter: 'blur(4px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-titulo"
           className="bg-white rounded-2xl shadow-2xl w-full"
           style={{ maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
          <h2 id="modal-titulo" className="text-xl font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar modal"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg aria-hidden="true" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, disabled, labelConfirm }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean; disabled: boolean; labelConfirm: string;
}) {
  return (
    <div className="flex gap-3">
      <button onClick={onCancel}
        className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        style={{ padding: '11px' }}>Cancelar</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        style={{ padding: '11px' }}>
        {loading ? 'A guardar...' : labelConfirm}
      </button>
    </div>
  );
}

function ErroBox({ texto }: { texto: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" style={{ padding: '12px 16px', marginBottom: '16px' }}>
      {texto}
    </div>
  );
}

const prioridadeCor: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-500',
  media: 'bg-blue-50 text-blue-600',
  alta: 'bg-orange-50 text-orange-600',
  urgente: 'bg-red-50 text-red-600',
};
const prioridadeLabel: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};
const grupoLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
};

export function TarefasPanel({ doenteId, utilizador, tarefas, emTurno, onRefresh }: Props) {
  const toast = useToast();
  const role = utilizador?.role ?? '';
  const podeCriarTarefa = emTurno && ['enfermeiro', 'medico'].includes(role);

  const meuGrupoChave = (() => {
    if (role === 'medico') return 'medico';
    if (role === 'auxiliar') return 'auxiliar';
    return 'enfermeiro';
  })();

  const gruposDisponiveis = (() => {
    if (role === 'medico') return ['medico', 'enfermeiro'];
    if (role === 'auxiliar') return ['auxiliar'];
    return ['enfermeiro', 'auxiliar'];
  })();

  const [modalTarefa, setModalTarefa] = useState(false);
  const [tarefaDesc, setTarefaDesc] = useState('');
  const [tarefaTipo, setTarefaTipo] = useState('clinica');
  const [tarefaPrioridade, setTarefaPrioridade] = useState('media');
  const [tarefaGrupo, setTarefaGrupo] = useState('');
  const [tarefaPrazo, setTarefaPrazo] = useState('');
  const [erroModal, setErroModal] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [modalHistorico, setModalHistorico] = useState(false);
  const [tarefasHistorico, setTarefasHistorico] = useState<Tarefa[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const abrirModalTarefa = () => {
    setTarefaDesc(''); setTarefaTipo('clinica'); setTarefaPrioridade('media');
    setTarefaGrupo(gruposDisponiveis[0] ?? ''); setTarefaPrazo(''); setErroModal('');
    setModalTarefa(true);
  };

  const submeterTarefa = async () => {
    if (!tarefaDesc.trim() || !tarefaGrupo) return;
    setSalvando(true); setErroModal('');
    try {
      await api.post(`/doentes/${doenteId}/tarefa`, {
        descricao: tarefaDesc, tipo: tarefaTipo,
        prioridade: tarefaPrioridade, grupoResponsavel: tarefaGrupo,
        prazo: tarefaPrazo || undefined,
      });
      toast.success('Tarefa criada');
      setModalTarefa(false); onRefresh();
    } catch (e: any) {
      setErroModal(e?.response?.data?.message ?? 'Erro ao criar tarefa');
    } finally { setSalvando(false); }
  };

  const abrirHistorico = async () => {
    setLoadingHistorico(true);
    setModalHistorico(true);
    try {
      const r = await api.get(`/tarefas/doente/${doenteId}`);
      const concluidas = r.data.filter((t: Tarefa) => t.estado === 'concluida');
      setTarefasHistorico(concluidas);
    } catch { setTarefasHistorico([]); }
    finally { setLoadingHistorico(false); }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Tarefas Pendentes</span>
          {tarefas.length > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
              {tarefas.length}
            </span>
          )}
          <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
            <button onClick={abrirHistorico}
              title="Histórico de tarefas"
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {podeCriarTarefa && <BtnAdd label="Adicionar tarefa" onClick={abrirModalTarefa} />}
          </div>
        </div>
        {tarefas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
            {podeCriarTarefa ? 'Sem tarefas — clica em + para criar' : 'Sem tarefas pendentes'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {tarefas.map((t) => {
              const podeConcluir = emTurno && (
                t.responsavel?.id === utilizador?.id ||
                (t.grupoResponsavel === meuGrupoChave && !t.responsavel)
              );
              return (
                <div key={t.id} className="flex items-start gap-3 bg-slate-50 rounded-xl" style={{ padding: '12px 14px' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{t.descricao}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                      <span className="text-xs text-slate-400">{t.tipo === 'clinica' ? 'Clínica' : 'Logística'}</span>
                      {t.responsavel ? (
                        <>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-xs text-slate-500 font-medium">A cargo: {t.responsavel.nome}</span>
                        </>
                      ) : t.grupoResponsavel ? (
                        <>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-xs text-slate-500 font-medium">Para: {grupoLabel[t.grupoResponsavel] ?? t.grupoResponsavel}</span>
                        </>
                      ) : null}
                      {t.criadoPor && (
                        <>
                          <span className="text-slate-300 text-xs">·</span>
                          <span className="text-xs text-slate-400">
                            Por {t.criadoPor.nome} às {new Date(t.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium badge-pad py-0.5 rounded-md ${prioridadeCor[t.prioridade]}`}>
                      {prioridadeLabel[t.prioridade]}
                    </span>
                    {podeConcluir && (
                      <button
                        onClick={async () => {
                          try {
                            await api.patch(`/tarefas/${t.id}/estado`, { estado: 'concluida' });
                            toast.success('Guardado com sucesso');
                            onRefresh();
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
                          }
                        }}
                        title="Concluir tarefa"
                        className="w-6 h-6 rounded-full border-2 border-slate-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-all"
                      >
                        <svg className="w-3 h-3 text-slate-400 hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Criar Tarefa */}
      {modalTarefa && (
        <Modal titulo="Criar Tarefa" onClose={() => setModalTarefa(false)}>
          <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
            <div>
              <label htmlFor="ftarefasp-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Descrição *</label>
              <input id="ftarefasp-0" autoFocus type="text" value={tarefaDesc} onChange={(e) => setTarefaDesc(e.target.value)}
                placeholder="Descrição da tarefa..."
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ padding: '10px 14px' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ftarefasp-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Tipo</label>
                <select id="ftarefasp-1" value={tarefaTipo} onChange={(e) => setTarefaTipo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="clinica">Clínica</option>
                  <option value="logistica">Logística</option>
                </select>
              </div>
              <div>
                <label htmlFor="ftarefasp-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prioridade</label>
                <select id="ftarefasp-2" value={tarefaPrioridade} onChange={(e) => setTarefaPrioridade(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ftarefasp-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Para</label>
              <select id="ftarefasp-3" value={tarefaGrupo} onChange={(e) => setTarefaGrupo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }}>
                {gruposDisponiveis.map((g) => (
                  <option key={g} value={g}>{grupoLabel[g]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ftarefasp-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Prazo (opcional)</label>
              <input id="ftarefasp-4" type="datetime-local" value={tarefaPrazo} onChange={(e) => setTarefaPrazo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }} />
            </div>
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalTarefa(false)} onConfirm={submeterTarefa}
            loading={salvando} disabled={!tarefaDesc.trim() || !tarefaGrupo} labelConfirm="Criar Tarefa" />
        </Modal>
      )}

      {/* Modal Histórico de Tarefas */}
      {modalHistorico && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '560px', padding: '32px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Histórico de Tarefas</h2>
              </div>
              <button onClick={() => setModalHistorico(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistorico ? (
                <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '40px 0' }}>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">A carregar...</span>
                </div>
              ) : tarefasHistorico.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px 0' }}>Sem tarefas concluídas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {tarefasHistorico.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
                      <svg className="w-4 h-4 text-green-500 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{t.descricao}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                          {t.concluidaEm && (
                            <span className="text-xs text-slate-400">
                              Concluída {new Date(t.concluidaEm).toLocaleDateString('pt-PT')} às {new Date(t.concluidaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {t.responsavel && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-500">{t.responsavel.nome}</span>
                            </>
                          )}
                          {t.criadoPor && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Por {t.criadoPor.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-md shrink-0 ${prioridadeCor[t.prioridade]}`}>
                        {prioridadeLabel[t.prioridade]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
