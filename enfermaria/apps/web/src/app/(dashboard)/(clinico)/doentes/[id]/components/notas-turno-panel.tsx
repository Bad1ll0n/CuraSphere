'use client';
import { useRef, useState, useEffect } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface NotaTurno {
  id: string;
  texto: string;
  criadaEm: string;
  autor: { id: string; nome: string; role: string };
}

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string } | null;
  notas: NotaTurno[];
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

const roleLabel: Record<string, string> = {
  medico: 'Médico', enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar',
  tecnico_saude: 'Técnico de Saúde', farmaceutico: 'Farmacêutico',
  administrativo: 'Administrativo', operacional: 'Operacional',
  ti: 'TI', qualidade: 'Qualidade', direcao: 'Direção',
};

const grupoMedico = ['medico'];
const grupoEnfermagem = ['enfermeiro', 'auxiliar'];

function getDeadlineEdicao(criadaEm: string): Date {
  const d = new Date(criadaEm);
  const min = d.getHours() * 60 + d.getMinutes();
  const dl = new Date(d);
  if (min >= 8 * 60 && min < 16 * 60) {
    dl.setHours(16, 30, 0, 0);
  } else if (min >= 16 * 60 && min < 23 * 60) {
    dl.setHours(23, 30, 0, 0);
  } else if (min >= 23 * 60) {
    dl.setDate(dl.getDate() + 1);
    dl.setHours(8, 30, 0, 0);
  } else {
    dl.setHours(8, 30, 0, 0);
  }
  return dl;
}

export function NotasTurnoPanel({ doenteId, utilizador, notas, emTurno, onRefresh }: Props) {
  const toast = useToast();
  const podeCriarNota = emTurno && ['enfermeiro', 'medico', 'auxiliar'].includes(utilizador?.role ?? '');

  const [modalNota, setModalNota] = useState(false);
  const [notaTexto, setNotaTexto] = useState('');
  const [notaEditandoId, setNotaEditandoId] = useState<string | null>(null);
  const [notaEditTexto, setNotaEditTexto] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const meuGrupo = grupoMedico.includes(utilizador?.role ?? '') ? grupoMedico : grupoEnfermagem;

  const isNotaEditavel = (nota: NotaTurno) => {
    if (!emTurno) return false;
    if (nota.autor.id !== utilizador?.id) return false;
    const criadaEm = new Date(nota.criadaEm);
    const agora = new Date();
    if (agora.getTime() - criadaEm.getTime() > 10 * 60 * 60 * 1000) return false;
    return agora <= getDeadlineEdicao(nota.criadaEm);
  };

  const submeterNota = async () => {
    if (!notaTexto.trim()) return;
    setSalvandoNota(true); setErroModal('');
    try {
      await api.post(`/doentes/${doenteId}/nota`, { texto: notaTexto });
      toast.success('Nota guardada');
      setModalNota(false); setNotaTexto(''); onRefresh();
    } catch (e: any) {
      setErroModal(e?.response?.data?.message ?? 'Erro ao guardar nota');
    } finally { setSalvandoNota(false); }
  };

  const guardarEdicaoNota = async (notaId: string) => {
    if (!notaEditTexto.trim()) return;
    setSalvandoNota(true);
    try {
      await api.patch(`/doentes/${doenteId}/nota/${notaId}`, { texto: notaEditTexto });
      toast.success('Nota guardada');
      setNotaEditandoId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoNota(false); }
  };

  const apagarNota = async (notaId: string) => {
    try {
      await api.delete(`/doentes/${doenteId}/nota/${notaId}`);
      toast.success('Removido');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    }
  };

  const notasFiltradas = notas.filter((n) => meuGrupo.includes(n.autor.role));

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Notas de Turno</span>
          {podeCriarNota && <BtnAdd label="Adicionar nota de turno" onClick={() => { setNotaTexto(''); setErroModal(''); setModalNota(true); }} />}
        </div>
        {notasFiltradas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
            {podeCriarNota ? 'Sem notas — clica em + para adicionar' : 'Sem notas registadas'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {notasFiltradas.map((n) => (
              <div key={n.id} className="border-l-2 border-indigo-200 bg-indigo-50/40 rounded-r-xl" style={{ padding: '14px 16px' }}>
                {notaEditandoId === n.id ? (
                  <div>
                    <textarea
                      rows={3}
                      value={notaEditTexto}
                      onChange={(e) => setNotaEditTexto(e.target.value)}
                      className="w-full border border-indigo-200 rounded-lg text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      style={{ padding: '10px 12px', marginBottom: '10px' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => guardarEdicaoNota(n.id)} disabled={salvandoNota || !notaEditTexto.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                        style={{ padding: '6px 14px' }}>
                        {salvandoNota ? 'A guardar...' : 'Guardar'}
                      </button>
                      <button onClick={() => setNotaEditandoId(null)}
                        className="border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors"
                        style={{ padding: '6px 14px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-700 leading-relaxed">{n.texto}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
                      <span className="text-xs font-medium text-slate-500">{n.autor.nome}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">{roleLabel[n.autor.role] ?? n.autor.role}</span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-400">
                        {new Date(n.criadaEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isNotaEditavel(n) && (
                        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
                          <button onClick={() => { setNotaEditandoId(n.id); setNotaEditTexto(n.texto); }} title="Editar"
                            className="w-6 h-6 rounded-md hover:bg-indigo-100 flex items-center justify-center transition-colors">
                            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => apagarNota(n.id)} aria-label="Apagar nota de turno"
                            className="w-6 h-6 rounded-md hover:bg-red-100 flex items-center justify-center transition-colors">
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modalNota && (
        <Modal titulo="Adicionar Nota de Turno" onClose={() => setModalNota(false)}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="fnotastur-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nota</label>
            <textarea id="fnotastur-0"
              autoFocus
              rows={5}
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Escreve a nota de turno..."
              className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ padding: '12px 14px' }}
            />
          </div>
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalNota(false)} onConfirm={submeterNota}
            loading={salvandoNota} disabled={!notaTexto.trim()} labelConfirm="Guardar Nota" />
        </Modal>
      )}
    </>
  );
}
