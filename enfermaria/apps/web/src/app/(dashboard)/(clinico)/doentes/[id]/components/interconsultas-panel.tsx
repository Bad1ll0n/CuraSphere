'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id?: string; role: string } | null;
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

const estadoCorMap: Record<string, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  aceite: 'bg-blue-50 text-blue-700',
  respondida: 'bg-green-50 text-green-700',
  cancelada: 'bg-slate-100 text-slate-500',
};

export function InterconsultasPanel({ doenteId, utilizador }: Props) {
  const role = utilizador?.role ?? '';
  const podeCriarInterc = role === 'medico';
  const podeResponder = role === 'medico';
  const toast = useToast();

  const [interconsultas, setInterconsultas] = useState<any[]>([]);
  const [modalInterconsulta, setModalInterconsulta] = useState(false);
  const [modalIntercResposta, setModalIntercResposta] = useState<string | null>(null);
  const [intercEspecialidade, setIntercEspecialidade] = useState('Cardiologia');
  const [intercMotivo, setIntercMotivo] = useState('');
  const [intercUrgente, setIntercUrgente] = useState(false);
  const [salvandoInterc, setSalvandoInterc] = useState(false);
  const [intercResposta, setIntercResposta] = useState('');

  const carregar = useCallback(() => {
    api.get(`/interconsultas/doente/${doenteId}`)
      .then(r => setInterconsultas(r.data))
      .catch(() => setInterconsultas([]));
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const submeterInterconsulta = async () => {
    setSalvandoInterc(true);
    try {
      await api.post(`/interconsultas/doente/${doenteId}`, {
        especialidadeAlvo: intercEspecialidade, motivo: intercMotivo, urgente: intercUrgente,
      });
      toast.success('Guardado com sucesso');
      setModalInterconsulta(false);
      setIntercMotivo(''); setIntercUrgente(false);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoInterc(false); }
  };

  const submeterResposta = async (intercId: string) => {
    if (!intercResposta.trim()) return;
    try {
      await api.patch(`/interconsultas/${intercId}/responder`, { resposta: intercResposta });
      toast.success('Guardado com sucesso');
      setModalIntercResposta(null); setIntercResposta('');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Interconsultas</span>
          {interconsultas.filter((i: any) => i.estado === 'pendente').length > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
              {interconsultas.filter((i: any) => i.estado === 'pendente').length} pendente(s)
            </span>
          )}
          {podeCriarInterc && (
            <BtnAdd label="Solicitar interconsulta" onClick={() => { setIntercMotivo(''); setIntercUrgente(false); setModalInterconsulta(true); }} />
          )}
        </div>
        {interconsultas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem interconsultas registadas</p>
        ) : (
          <div className="flex flex-col gap-3">
            {interconsultas.map((ic: any) => (
              <div key={ic.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{ic.especialidadeAlvo}</span>
                      {ic.urgente && <span className="text-xs font-bold text-red-600 bg-red-50 badge-pad py-0.5 rounded-full">Urgente</span>}
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${estadoCorMap[ic.estado] ?? 'bg-slate-100 text-slate-500'}`}>{ic.estado}</span>
                    </div>
                    <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>{ic.motivo}</p>
                    <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>
                      Por {ic.requisitante?.nome} · {new Date(ic.criadaEm).toLocaleDateString('pt-PT')}
                    </p>
                    {ic.resposta && (
                      <div className="bg-green-50 rounded-lg" style={{ padding: '10px 12px', marginTop: '8px' }}>
                        <p className="text-xs font-semibold text-green-700" style={{ marginBottom: '2px' }}>Resposta de {ic.medicoResposta?.nome}</p>
                        <p className="text-xs text-green-800">{ic.resposta}</p>
                      </div>
                    )}
                  </div>
                  {podeResponder && ic.estado !== 'respondida' && ic.estado !== 'cancelada' && (
                    <button onClick={() => { setModalIntercResposta(ic.id); setIntercResposta(''); }}
                      className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                      style={{ padding: '6px 12px' }}>Responder</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalInterconsulta && (
        <Modal titulo="Solicitar Interconsulta" onClose={() => setModalInterconsulta(false)}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="fintercon-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Especialidade *</label>
            <select id="fintercon-0" value={intercEspecialidade} onChange={(e) => setIntercEspecialidade(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ padding: '10px 14px' }}>
              {['Cardiologia','Neurologia','Nefrologia','Gastrenterologia','Pneumologia','Endocrinologia',
                'Ortopedia','Cirurgia Geral','Anestesiologia','Psiquiatria','Dermatologia','Medicina Interna',
                'Oncologia','Hematologia','Reumatologia','Urologia','Ginecologia','Pediatria','Oftalmologia'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="fintercon-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
            <textarea id="fintercon-1" value={intercMotivo} onChange={(e) => setIntercMotivo(e.target.value)}
              placeholder="Descreva o motivo da interconsulta..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px', marginBottom: '0' }} rows={3} />
          </div>
          <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
            <input type="checkbox" id="interc-urgente" checked={intercUrgente} onChange={(e) => setIntercUrgente(e.target.checked)}
              className="w-4 h-4 rounded accent-red-600" />
            <label htmlFor="interc-urgente" className="text-sm font-medium text-red-600">Urgente</label>
          </div>
          <ModalFooter onCancel={() => setModalInterconsulta(false)} onConfirm={submeterInterconsulta}
            loading={salvandoInterc} disabled={!intercMotivo.trim() || salvandoInterc} labelConfirm="Solicitar" />
        </Modal>
      )}

      {modalIntercResposta && (
        <Modal titulo="Responder Interconsulta" onClose={() => setModalIntercResposta(null)}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="fintercon-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resposta clínica *</label>
            <textarea id="fintercon-2" value={intercResposta} onChange={(e) => setIntercResposta(e.target.value)}
              placeholder="Escreva a sua avaliação e recomendações..."
              className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ padding: '10px 14px' }} rows={5} />
          </div>
          <ModalFooter onCancel={() => setModalIntercResposta(null)}
            onConfirm={() => submeterResposta(modalIntercResposta)}
            loading={false} disabled={!intercResposta.trim()} labelConfirm="Responder" />
        </Modal>
      )}
    </>
  );
}
