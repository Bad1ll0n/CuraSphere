'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';

interface Medicacao {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: string;
  terminadoEm?: string;
  ativo: boolean;
  prescritoPor?: { id: string; nome: string };
}

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string } | null;
  medicacoes: Medicacao[];
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

export function MedicacaoPanel({ doenteId, utilizador, medicacoes, onRefresh }: Props) {
  const toast = useToast();
  const role = utilizador?.role ?? '';
  const podePrescreveMed = role === 'medico';
  const podeProporMed = role === 'enfermeiro';

  // QR 5 Certos
  const [qrMed, setQrMed] = useState<{ id: string; nome: string; dose: string; via: string } | null>(null);

  // Prescrever medicação state
  const [modalMed, setModalMed] = useState(false);
  const [medNome, setMedNome] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medVia, setMedVia] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [erroModal, setErroModal] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [interacoes, setInteracoes] = useState<{ med1: string; med2: string; severidade: string; descricao: string }[]>([]);
  const [justificativaInteracao, setJustificativaInteracao] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ajusteRenal, setAjusteRenal] = useState<any | null>(null);
  const [loadingAjusteRenal, setLoadingAjusteRenal] = useState(false);

  // Proposta state
  const [modalPropor, setModalPropor] = useState(false);
  const [propostaMedNome, setPropostaMedNome] = useState('');
  const [propostaMedDose, setPropostaMedDose] = useState('');
  const [propostaMedVia, setPropostaMedVia] = useState('');
  const [propostaMedFreq, setPropostaMedFreq] = useState('');
  const [propostaObs, setPropostaObs] = useState('');
  const [salvandoProposta, setSalvandoProposta] = useState('');

  // Rejeitar proposta
  const [modalRejeitarProposta, setModalRejeitarProposta] = useState<string | null>(null);
  const [motivoRejProposta, setMotivoRejProposta] = useState('');

  // Propostas pendentes
  const [propostasPendentes, setPropostasPendentes] = useState<any[]>([]);

  // Histórico
  const [modalHistoricoMed, setModalHistoricoMed] = useState(false);
  const [medHistorico, setMedHistorico] = useState<Medicacao[]>([]);
  const [loadingHistoricoMed, setLoadingHistoricoMed] = useState(false);

  // Confirm modal
  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);

  // Stewardship antibiótico
  const [stewardship, setStewardship] = useState<any[]>([]);
  const [sugestaoExpandida, setSugestaoExpandida] = useState<string | null>(null);
  const [aprovandoStewardship, setAprovandoStewardship] = useState<string | null>(null);

  const carregarPropostas = useCallback(async () => {
    if (role !== 'medico' && role !== 'direcao') return;
    try {
      const { data } = await api.get(`/medicacao/pendentes-aprovacao-medico`);
      setPropostasPendentes((data ?? []).filter((p: any) => p.doenteId === doenteId));
    } catch { /* vazio */ }
  }, [doenteId, role]);

  useEffect(() => { carregarPropostas(); }, [carregarPropostas]);

  useEffect(() => {
    api.get(`/stewardship/${doenteId}`)
      .then(r => setStewardship(r.data ?? []))
      .catch(() => { /* vazio */ });
  }, [doenteId]);

  useEffect(() => {
    if (!modalMed || medNome.trim().length < 3) { setInteracoes([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/medicacao/interacoes?doenteId=${doenteId}&nome=${encodeURIComponent(medNome.trim())}`);
        setInteracoes(data ?? []);
      } catch {
        setInteracoes([]);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [medNome, modalMed, doenteId]);

  const temInteracaoGrave = interacoes.some(i => i.severidade === 'grave');

  const submeterMed = async () => {
    if (!medNome.trim() || !medDose.trim() || !medVia.trim() || !medFreq.trim()) return;
    if (temInteracaoGrave && !justificativaInteracao.trim()) {
      setErroModal('Interacção grave detectada — é obrigatório registar a justificação clínica.');
      return;
    }
    setSalvando(true); setErroModal('');
    try {
      await api.post('/medicacao/prescrever', {
        doenteId, nome: medNome, dose: medDose, via: medVia, frequencia: medFreq,
        ...(temInteracaoGrave && justificativaInteracao ? { justificativaOverride: justificativaInteracao } : {}),
      });
      toast.success('Prescrição guardada');
      setModalMed(false); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq('');
      setInteracoes([]); setJustificativaInteracao('');
      onRefresh();
    } catch (e: any) {
      setErroModal(e?.response?.data?.message ?? 'Erro ao prescrever medicação');
    } finally { setSalvando(false); }
  };

  const concluirMedicacao = (medId: string) => {
    setConfirmarAcao({
      titulo: 'Descontinuar Medicação',
      mensagem: 'Confirmar conclusão desta medicação? Esta acção não pode ser revertida.',
      variant: 'warning',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.patch(`/medicacao/${medId}/descontinuar`);
          toast.success('Medicação descontinuada');
          onRefresh();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  const submeterProposta = async () => {
    if (!propostaMedNome.trim() || !propostaMedDose.trim() || !propostaMedVia.trim() || !propostaMedFreq.trim()) return;
    setSalvandoProposta('propor');
    try {
      await api.post('/medicacao/propor', { doenteId, nome: propostaMedNome, dose: propostaMedDose, via: propostaMedVia, frequencia: propostaMedFreq, observacoes: propostaObs || undefined });
      toast.success('Proposta de prescrição enviada ao médico');
      setModalPropor(false);
      setPropostaMedNome(''); setPropostaMedDose(''); setPropostaMedVia(''); setPropostaMedFreq(''); setPropostaObs('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao propor prescrição');
    } finally { setSalvandoProposta(''); }
  };

  const aprovarProposta = async (medicacaoId: string) => {
    setSalvandoProposta('aprovar');
    try {
      await api.patch(`/medicacao/${medicacaoId}/aprovar-medico`);
      toast.success('Prescrição aprovada e activada');
      onRefresh(); carregarPropostas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao aprovar');
    } finally { setSalvandoProposta(''); }
  };

  const rejeitarProposta = async () => {
    if (!modalRejeitarProposta || !motivoRejProposta.trim()) return;
    setSalvandoProposta('rejeitar');
    try {
      await api.patch(`/medicacao/${modalRejeitarProposta}/rejeitar-medico`, { motivoRejeicao: motivoRejProposta });
      toast.success('Proposta rejeitada');
      setModalRejeitarProposta(null); setMotivoRejProposta('');
      carregarPropostas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao rejeitar');
    } finally { setSalvandoProposta(''); }
  };

  const abrirHistoricoMed = async () => {
    setLoadingHistoricoMed(true);
    setModalHistoricoMed(true);
    try {
      const r = await api.get(`/medicacao/doente/${doenteId}`);
      setMedHistorico(r.data.filter((m: Medicacao) => !m.ativo));
    } catch { setMedHistorico([]); }
    finally { setLoadingHistoricoMed(false); }
  };

  const aprovarDeescalacao = async (stewardshipId: string) => {
    setAprovandoStewardship(stewardshipId);
    try {
      await api.patch(`/stewardship/${stewardshipId}/aprovar`);
      toast.success('De-escalação aprovada');
      setStewardship(prev => prev.map(s => s.id === stewardshipId ? { ...s, aprovadoPor: utilizador?.id } : s));
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao aprovar de-escalação');
    } finally { setAprovandoStewardship(null); }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Medicação Ativa</span>
          {medicacoes.length > 0 && (
            <span className="text-xs font-medium text-pink-600 bg-pink-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
              {medicacoes.length}
            </span>
          )}
          <div className="flex items-center gap-1.5" style={{ marginLeft: 'auto' }}>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'}/v1/medicacao/doente/${doenteId}/mar/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Descarregar MAR PDF"
              title="Descarregar MAR do dia"
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </a>
            <button onClick={abrirHistoricoMed} aria-label="Histórico de medicação"
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {podePrescreveMed && <BtnAdd label="Prescrever medicação" onClick={() => { setErroModal(''); setMedNome(''); setMedDose(''); setMedVia(''); setMedFreq(''); setInteracoes([]); setJustificativaInteracao(''); setModalMed(true); }} />}
            {podeProporMed && (
              <button onClick={() => { setPropostaMedNome(''); setPropostaMedDose(''); setPropostaMedVia(''); setPropostaMedFreq(''); setPropostaObs(''); setModalPropor(true); }}
                aria-label="Propor prescrição"
                className="w-7 h-7 rounded-lg bg-violet-100 hover:bg-violet-200 flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {medicacoes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>
            {podePrescreveMed ? 'Sem medicação ativa — clica em + para prescrever' : 'Sem medicação ativa'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {medicacoes.map((m) => {
              const sw = stewardship.find(s => s.medicacaoId === m.id);
              return (
                <div key={m.id} className="bg-slate-50 rounded-xl overflow-hidden">
                  <div className="flex items-start justify-between" style={{ padding: '12px 14px' }}>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{m.nome}</p>
                      <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                      {m.prescritoPor && (
                        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Prescrito por {m.prescritoPor.nome}</p>
                      )}
                      {sw && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full" style={{ padding: '2px 8px', marginTop: '6px' }}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Dia {sw.diasTerapia} de antibioterapia
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" style={{ marginLeft: '8px' }}>
                      <button
                        onClick={() => setQrMed({ id: m.id, nome: m.nome, dose: m.dose, via: m.via })}
                        title="Gerar QR para verificação 5 Certos"
                        className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-violet-50 hover:border-violet-300 flex items-center justify-center transition-colors">
                        <svg className="w-3 h-3 text-slate-400 hover:text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                      {podePrescreveMed && (
                        <button onClick={() => concluirMedicacao(m.id)} title="Concluir medicação"
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors">
                          <svg className="w-3 h-3 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {sw?.alertaEmitido && !sw?.aprovadoPor && (
                    <div style={{ borderTop: '1px solid #fde68a', padding: '10px 14px' }} className="bg-amber-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-amber-800" style={{ marginBottom: '4px' }}>
                            Considerar de-escalação (Dia {sw.diasTerapia}+)
                          </p>
                          {sw.sugestaoIA && (
                            <button onClick={() => setSugestaoExpandida(sugestaoExpandida === sw.id ? null : sw.id)}
                              className="text-xs text-amber-700 underline hover:text-amber-900">
                              {sugestaoExpandida === sw.id ? 'Ocultar sugestão IA' : 'Ver sugestão IA'}
                            </button>
                          )}
                          {sugestaoExpandida === sw.id && sw.sugestaoIA && (
                            <p className="text-xs text-amber-700 bg-amber-100 rounded-lg" style={{ padding: '8px 10px', marginTop: '6px', lineHeight: '1.5' }}>
                              {sw.sugestaoIA}
                            </p>
                          )}
                        </div>
                        {podePrescreveMed && (
                          <button onClick={() => aprovarDeescalacao(sw.id)} disabled={aprovandoStewardship === sw.id}
                            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 shrink-0"
                            style={{ padding: '5px 10px' }}>
                            {aprovandoStewardship === sw.id ? '...' : 'Aprovar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Propostas pendentes de aprovação médica */}
        {podePrescreveMed && propostasPendentes.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide" style={{ marginBottom: '10px' }}>
              Propostas de enfermagem aguardam aprovação ({propostasPendentes.length})
            </p>
            <div className="flex flex-col gap-2">
              {propostasPendentes.map((p) => (
                <div key={p.id} className="flex items-start justify-between bg-violet-50 border border-violet-100 rounded-xl" style={{ padding: '10px 12px' }}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.nome}</p>
                    <p className="text-xs text-slate-400">{p.dose} · {p.via} · {p.frequencia}</p>
                    {p.prescritoPor && <p className="text-xs text-violet-600" style={{ marginTop: '2px' }}>Proposto por {p.prescritoPor.nome}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0" style={{ marginLeft: '8px' }}>
                    <button onClick={() => { setModalRejeitarProposta(p.id); setMotivoRejProposta(''); }}
                      className="text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      style={{ padding: '5px 10px' }}>Rejeitar</button>
                    <button onClick={() => aprovarProposta(p.id)} disabled={salvandoProposta === 'aprovar'}
                      className="text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      style={{ padding: '5px 10px' }}>Aprovar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Prescrever */}
      {modalMed && (
        <Modal titulo="Prescrever Medicação" onClose={() => setModalMed(false)}>
          <div className="flex flex-col gap-4" style={{ marginBottom: '20px' }}>
            <div>
              <label htmlFor="fmedicaca-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Nome do medicamento *</label>
              <input id="fmedicaca-0" autoFocus type="text" value={medNome} onChange={(e) => { setMedNome(e.target.value); setAjusteRenal(null); }}
                placeholder="Ex: Paracetamol"
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ padding: '10px 14px' }} />
              {medNome.trim().length >= 3 && (
                <button type="button" onClick={async () => {
                  setLoadingAjusteRenal(true);
                  try {
                    const r = await api.get('/medicacao/ajuste-renal', { params: { doenteId, medicamento: medNome.trim() } });
                    setAjusteRenal(r.data);
                  } catch { setAjusteRenal(null); }
                  finally { setLoadingAjusteRenal(false); }
                }} disabled={loadingAjusteRenal}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  style={{ marginTop: '4px' }}>
                  {loadingAjusteRenal ? '⌛ A calcular GFR...' : '💊 Verificar dose renal'}
                </button>
              )}
              {ajusteRenal && (
                <div className={`rounded-xl text-xs border mt-2 ${ajusteRenal.classificacao === 'normal' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`} style={{ padding: '8px 12px' }}>
                  <div className="font-semibold text-slate-800">
                    GFR: {ajusteRenal.gfr != null ? `${ajusteRenal.gfr} mL/min` : 'Indisponível'}
                    {ajusteRenal.classificacao && <span className="ml-2 capitalize text-slate-600">— {ajusteRenal.classificacao}</span>}
                  </div>
                  {ajusteRenal.aviso && <p className="text-amber-700 mt-0.5">{ajusteRenal.aviso}</p>}
                  {ajusteRenal.doseRecomendada && <p className="text-slate-700 mt-0.5"><strong>Dose:</strong> {ajusteRenal.doseRecomendada} · <strong>Intervalo:</strong> {ajusteRenal.intervalo}</p>}
                  {ajusteRenal.observacoes && <p className="text-slate-500 italic mt-0.5">{ajusteRenal.observacoes}</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fmedicaca-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Dose *</label>
                <input id="fmedicaca-1" type="text" value={medDose} onChange={(e) => setMedDose(e.target.value)}
                  placeholder="Ex: 500mg"
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ padding: '10px 14px' }} />
              </div>
              <div>
                <label htmlFor="fmedicaca-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Via *</label>
                <select id="fmedicaca-2" value={medVia} onChange={(e) => setMedVia(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  style={{ padding: '10px 14px' }}>
                  <option value="">Selecionar...</option>
                  <option value="oral">Oral</option>
                  <option value="intravenosa">Intravenosa</option>
                  <option value="intramuscular">Intramuscular</option>
                  <option value="subcutanea">Subcutânea</option>
                  <option value="topica">Tópica</option>
                  <option value="inalatoria">Inalatória</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="fmedicaca-3" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Frequência *</label>
              <select id="fmedicaca-3" value={medFreq} onChange={(e) => setMedFreq(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                style={{ padding: '10px 14px' }}>
                <option value="">Selecionar...</option>
                <option value="SOS">SOS (em SOS)</option>
                <option value="1x/dia">1x por dia</option>
                <option value="2x/dia">2x por dia</option>
                <option value="3x/dia">3x por dia</option>
                <option value="4x/dia">4x por dia</option>
                <option value="6x/dia">6x por dia (4/4h)</option>
                <option value="8x/dia">8x por dia (3/3h)</option>
                <option value="contínua">Contínua (perfusão)</option>
              </select>
            </div>
          </div>
          {interacoes.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              {interacoes.map((int, i) => {
                const isGrave = int.severidade === 'grave';
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-xl text-sm ${isGrave ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`} style={{ padding: '10px 14px', marginBottom: '8px' }}>
                    <span className="font-bold shrink-0">{isGrave ? '🔴' : '🟡'}</span>
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wide" style={{ marginBottom: '2px' }}>
                        {isGrave ? 'Major' : 'Moderada'} — {int.med2}
                      </p>
                      <p className="text-xs">{int.descricao}</p>
                    </div>
                  </div>
                );
              })}
              {temInteracaoGrave && (
                <div style={{ marginTop: '8px' }}>
                  <span className="block text-xs font-semibold text-red-700 uppercase tracking-wide" style={{ marginBottom: '4px' }}>
                    Justificação clínica obrigatória *
                  </span>
                  <textarea
                    rows={2}
                    value={justificativaInteracao}
                    onChange={(e) => setJustificativaInteracao(e.target.value)}
                    placeholder="Fundamente clinicamente a prescrição apesar da interacção grave..."
                    className="w-full border border-red-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              )}
            </div>
          )}
          {erroModal && <ErroBox texto={erroModal} />}
          <ModalFooter onCancel={() => setModalMed(false)} onConfirm={submeterMed}
            loading={salvando} disabled={!medNome.trim() || !medDose.trim() || !medVia || !medFreq || (temInteracaoGrave && !justificativaInteracao.trim())} labelConfirm="Prescrever" />
        </Modal>
      )}

      {/* Modal Propor Prescrição (enfermeiro) */}
      {modalPropor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Propor Prescrição</h2>
                <p className="text-xs text-violet-600 font-medium" style={{ marginTop: '2px' }}>Aguardará aprovação do médico responsável</p>
              </div>
              <button aria-label="Fechar" onClick={() => setModalPropor(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fmedicaca-4" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Medicamento *</label>
              <input id="fmedicaca-4" autoFocus type="text" value={propostaMedNome} onChange={e => setPropostaMedNome(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: Paracetamol 500mg" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fmedicaca-5" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Dose *</label>
              <input id="fmedicaca-5" type="text" value={propostaMedDose} onChange={e => setPropostaMedDose(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }} placeholder="Ex: 500mg" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fmedicaca-6" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Via *</label>
              <select id="fmedicaca-6" value={propostaMedVia} onChange={e => setPropostaMedVia(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar...</option>
                {['Oral','IV','IM','SC','Tópica','Inalatória','SL','Retal','Nasal'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label htmlFor="fmedicaca-7" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Frequência *</label>
              <select id="fmedicaca-7" value={propostaMedFreq} onChange={e => setPropostaMedFreq(e.target.value)}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                style={{ padding: '10px 14px' }}>
                <option value="">Seleccionar...</option>
                {['SOS','1x/dia','2x/dia','3x/dia','4x/dia','6/6h','8/8h','12/12h','Contínuo'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="fmedicaca-8" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Observações clínicas</label>
              <textarea id="fmedicaca-8" value={propostaObs} onChange={e => setPropostaObs(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Justificação clínica, alergias conhecidas..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalPropor(false)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterProposta} disabled={salvandoProposta === 'propor' || !propostaMedNome.trim() || !propostaMedDose.trim() || !propostaMedVia || !propostaMedFreq}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>
                {salvandoProposta === 'propor' ? 'A enviar...' : 'Propor ao Médico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejeitar Proposta */}
      {modalRejeitarProposta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '400px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <h2 className="text-lg font-bold text-slate-900">Rejeitar Proposta</h2>
              <button aria-label="Fechar" onClick={() => setModalRejeitarProposta(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="fmedicaca-9" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Motivo *</label>
              <textarea id="fmedicaca-9" value={motivoRejProposta} onChange={e => setMotivoRejProposta(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Ex: Contra-indicação com medicação atual..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalRejeitarProposta(null)} className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50" style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={rejeitarProposta} disabled={!motivoRejProposta.trim() || salvandoProposta === 'rejeitar'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-50" style={{ padding: '11px' }}>Rejeitar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico de Medicação */}
      {modalHistoricoMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '520px', padding: '32px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Histórico de Medicação</h2>
              </div>
              <button onClick={() => setModalHistoricoMed(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingHistoricoMed ? (
                <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '40px 0' }}>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">A carregar...</span>
                </div>
              ) : medHistorico.length === 0 ? (
                <p className="text-sm text-slate-400 text-center" style={{ padding: '40px 0' }}>Sem medicações concluídas</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {medHistorico.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 14px' }}>
                      <svg className="w-4 h-4 text-slate-400 shrink-0" style={{ marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{m.nome}</p>
                        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>{m.dose} · {m.via} · {m.frequencia}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ marginTop: '4px' }}>
                          <span className="text-xs text-slate-400">Início: {new Date(m.iniciadoEm).toLocaleDateString('pt-PT')}</span>
                          {m.terminadoEm && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Fim: {new Date(m.terminadoEm).toLocaleDateString('pt-PT')}</span>
                            </>
                          )}
                          {m.prescritoPor && (
                            <>
                              <span className="text-slate-300 text-xs">·</span>
                              <span className="text-xs text-slate-400">Por {m.prescritoPor.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmarAcao}
        titulo={confirmarAcao?.titulo ?? ''}
        mensagem={confirmarAcao?.mensagem ?? ''}
        variant={confirmarAcao?.variant ?? 'danger'}
        onConfirmar={confirmarAcao?.onConfirmar ?? (() => { /* vazio */ })}
        onCancelar={() => setConfirmarAcao(null)}
      />

      {/* Modal QR 5 Certos */}
      {qrMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          style={{ backdropFilter: 'blur(4px)' }}
          onClick={() => setQrMed(null)}>
          <div className="bg-white rounded-2xl shadow-2xl" style={{ padding: '32px', maxWidth: '320px', width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <h3 className="text-base font-bold text-slate-900">QR — 5 Certos</h3>
              <button onClick={() => setQrMed(null)} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-center bg-white rounded-xl border border-slate-100" style={{ padding: '20px', marginBottom: '16px' }}>
              <QRCode
                value={JSON.stringify({ medicacaoId: qrMed.id, doenteId, nome: qrMed.nome, dose: qrMed.dose, via: qrMed.via })}
                size={200}
              />
            </div>
            <p className="text-sm font-semibold text-slate-800 text-center" style={{ marginBottom: '4px' }}>{qrMed.nome}</p>
            <p className="text-xs text-slate-400 text-center">{qrMed.dose} · {qrMed.via}</p>
            <p className="text-xs text-slate-400 text-center" style={{ marginTop: '12px' }}>
              Scan com o telemóvel para verificar os 5 Certos antes de administrar
            </p>
          </div>
        </div>
      )}
    </>
  );
}
