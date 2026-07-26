'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';

interface Props {
  doenteId: string;
  utilizador: { role: string } | null;
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

export function AlergiasContactosPanel({ doenteId, utilizador: _utilizador }: Props) {
  const toast = useToast();

  // Alergias state
  const [alergias, setAlergias] = useState<any[]>([]);
  const [modalAlergia, setModalAlergia] = useState(false);
  const [alergenio, setAlergenio] = useState('');
  const [alergiaTipo, setAlergiaTipo] = useState('medicamento');
  const [alergiaSev, setAlergiaSev] = useState('moderada');
  const [alergiaNotas, setAlergiaNotas] = useState('');
  const [salvandoAlergia, setSalvandoAlergia] = useState(false);

  // Contactos state
  const [contactos, setContactos] = useState<any[]>([]);
  const [modalContacto, setModalContacto] = useState(false);
  const [ctNome, setCtNome] = useState('');
  const [ctRelacao, setCtRelacao] = useState('cônjuge');
  const [ctTel, setCtTel] = useState('');
  const [ctPrincipal, setCtPrincipal] = useState(false);
  const [salvandoContacto, setSalvandoContacto] = useState(false);

  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);

  const carregarAlergias = useCallback(() => {
    api.get(`/alergias/${doenteId}`).then(r => setAlergias(r.data)).catch(() => setAlergias([]));
  }, [doenteId]);

  const carregarContactos = useCallback(() => {
    api.get(`/contactos/${doenteId}`).then(r => setContactos(r.data)).catch(() => setContactos([]));
  }, [doenteId]);

  useEffect(() => {
    carregarAlergias();
    carregarContactos();
  }, [carregarAlergias, carregarContactos]);

  const submeterAlergia = async () => {
    if (!alergenio.trim()) return;
    setSalvandoAlergia(true);
    try {
      await api.post(`/alergias/${doenteId}`, { alergenio, tipo: alergiaTipo, severidade: alergiaSev, notas: alergiaNotas || undefined });
      toast.success('Guardado com sucesso');
      setModalAlergia(false); setAlergenio(''); setAlergiaNotas('');
      carregarAlergias();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoAlergia(false); }
  };

  const removerAlergia = (alergiaId: string, nomeAlergenio: string) => {
    setConfirmarAcao({
      titulo: 'Remover Alergia',
      mensagem: `Remover alergia a "${nomeAlergenio}"? Esta acção não pode ser revertida.`,
      variant: 'danger',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.delete(`/alergias/${alergiaId}`);
          toast.success('Removido');
          carregarAlergias();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  const submeterContacto = async () => {
    if (!ctNome.trim() || !ctTel.trim()) return;
    setSalvandoContacto(true);
    try {
      await api.post(`/contactos/${doenteId}`, { nome: ctNome, relacao: ctRelacao, telefone: ctTel, principal: ctPrincipal });
      toast.success('Guardado com sucesso');
      setModalContacto(false); setCtNome(''); setCtTel(''); setCtPrincipal(false);
      carregarContactos();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoContacto(false); }
  };

  const removerContacto = (ctId: string, nomeContacto: string) => {
    setConfirmarAcao({
      titulo: 'Remover Contacto',
      mensagem: `Remover contacto "${nomeContacto}"? Esta acção não pode ser revertida.`,
      variant: 'danger',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.delete(`/contactos/${ctId}`);
          toast.success('Removido');
          carregarContactos();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  const sevCor: Record<string, string> = { anafilaxia: 'bg-red-100 text-red-700', grave: 'bg-orange-100 text-orange-700', moderada: 'bg-yellow-100 text-yellow-700', ligeira: 'bg-slate-100 text-slate-600' };

  return (
    <>
      <div className="grid grid-cols-2 gap-5" style={{ marginBottom: '24px', marginTop: '24px' }}>
        {/* Alergias */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Alergias</span>
            <BtnAdd label="Registar alergia" onClick={() => { setAlergenio(''); setAlergiaNotas(''); setModalAlergia(true); }} />
          </div>
          {alergias.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem alergias registadas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alergias.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
                  <span className={`text-xs font-bold badge-pad py-0.5 rounded-full ${sevCor[a.severidade] ?? 'bg-slate-100 text-slate-600'}`}>{a.severidade}</span>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-800">{a.alergenio}</span>
                    <span className="text-xs text-slate-400 ml-2">{a.tipo}</span>
                  </div>
                  <button onClick={() => removerAlergia(a.id, a.alergenio)} aria-label={`Remover alergia ${a.alergenio}`} className="text-red-400 hover:text-red-600 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contactos de Emergência */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Contactos de Emergência</span>
            <BtnAdd label="Adicionar contacto de emergência" onClick={() => { setCtNome(''); setCtTel(''); setCtRelacao('cônjuge'); setCtPrincipal(false); setModalContacto(true); }} />
          </div>
          {contactos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem contactos registados</p>
          ) : (
            <div className="flex flex-col gap-2">
              {contactos.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{c.nome}</span>
                      {c.principal && <span className="text-xs bg-blue-100 text-blue-700 font-bold badge-pad py-0.5 rounded">Principal</span>}
                    </div>
                    <span className="text-xs text-slate-400">{c.relacao} · {c.telefone}</span>
                  </div>
                  <button onClick={() => removerContacto(c.id, c.nome)} aria-label={`Remover contacto ${c.nome}`} className="text-red-400 hover:text-red-600 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Alergia */}
      {modalAlergia && (
        <Modal titulo="Registar Alergia" onClose={() => setModalAlergia(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="alergia-alergenio" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Agente alérgeno *</label>
            <input id="alergia-alergenio" type="text" value={alergenio} onChange={(e) => setAlergenio(e.target.value)} placeholder="Ex: Penicilina, Ibuprofeno..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo</span>
            <div className="flex gap-2 flex-wrap">
              {['medicamento', 'alimento', 'ambiental', 'outro'].map((t) => (
                <button key={t} onClick={() => setAlergiaTipo(t)} className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${alergiaTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="alergia-notas" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Severidade</label>
            <div className="flex gap-2 flex-wrap">
              {['ligeira', 'moderada', 'grave', 'anafilaxia'].map((s) => (
                <button key={s} onClick={() => setAlergiaSev(s)} className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${alergiaSev === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="alergia-notas" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Notas</label>
            <input id="alergia-notas" type="text" value={alergiaNotas} onChange={(e) => setAlergiaNotas(e.target.value)} placeholder="Observações..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <ModalFooter onCancel={() => setModalAlergia(false)} onConfirm={submeterAlergia} loading={salvandoAlergia} disabled={!alergenio.trim() || salvandoAlergia} labelConfirm="Registar" />
        </Modal>
      )}

      {/* Modal Contacto */}
      {modalContacto && (
        <Modal titulo="Contacto de Emergência" onClose={() => setModalContacto(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="falergias-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Nome *</label>
            <input id="falergias-2" type="text" value={ctNome} onChange={(e) => setCtNome(e.target.value)} placeholder="Nome completo" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Relação</span>
            <div className="flex gap-2 flex-wrap">
              {['cônjuge', 'filho/a', 'pai/mãe', 'outro'].map((r) => (
                <button key={r} onClick={() => setCtRelacao(r)} className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${ctRelacao === r ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="falergias-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Telefone *</label>
            <input id="falergias-4" type="tel" value={ctTel} onChange={(e) => setCtTel(e.target.value)} placeholder="9xx xxx xxx" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '10px 14px' }} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer" style={{ marginBottom: '16px' }}>
            <input type="checkbox" checked={ctPrincipal} onChange={(e) => setCtPrincipal(e.target.checked)} className="w-4 h-4 rounded" />
            Contacto principal
          </label>
          <ModalFooter onCancel={() => setModalContacto(false)} onConfirm={submeterContacto} loading={salvandoContacto} disabled={!ctNome.trim() || !ctTel.trim() || salvandoContacto} labelConfirm="Guardar" />
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!confirmarAcao}
        titulo={confirmarAcao?.titulo ?? ''}
        mensagem={confirmarAcao?.mensagem ?? ''}
        variant={confirmarAcao?.variant ?? 'danger'}
        onConfirmar={confirmarAcao?.onConfirmar ?? (() => { /* vazio */ })}
        onCancelar={() => setConfirmarAcao(null)}
      />
    </>
  );
}
