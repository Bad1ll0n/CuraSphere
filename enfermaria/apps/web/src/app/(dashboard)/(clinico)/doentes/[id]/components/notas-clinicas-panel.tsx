'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { ConfirmModal } from '@/components/confirm-modal';
import { useSocket, emitSocket } from '@/lib/use-socket';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
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

export function NotasClinicasPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();

  const [notasClincias, setNotasClincias] = useState<any[]>([]);
  const [modalNotaClinica, setModalNotaClinica] = useState(false);
  const [soapForm, setSoapForm] = useState({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' });
  const [salvandoSoap, setSalvandoSoap] = useState(false);
  const [notaSoapEditandoId, setNotaSoapEditandoId] = useState<string | null>(null);
  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);
  const [locks, setLocks] = useState<Record<string, string>>({}); // notaId → nome do editor

  const role = utilizador?.role ?? '';
  const podeCriarNotaClinica = ['medico', 'enfermeiro'].includes(role);

  const soapDirty = modalNotaClinica && Object.values(soapForm).some(v => v.trim().length > 0);
  useUnsavedChanges(soapDirty);

  // Socket — join doente room and listen for nota locks
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
  useSocket(token, {
    'nota:lock': (data: { notaId: string; nome: string }) =>
      setLocks(prev => ({ ...prev, [data.notaId]: data.nome })),
    'nota:unlock': (data: { notaId: string }) =>
      setLocks(prev => { const n = { ...prev }; delete n[data.notaId]; return n; }),
  });
  useEffect(() => {
    if (token) emitSocket('nota:join-doente', { doenteId });
  }, [doenteId, token]);

  // Voice dictation
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoice = (fieldKey: string) => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Ditação por voz não suportada neste browser'); return; }

    if (isListening && activeVoiceField === fieldKey) {
      recognitionRef.current?.stop();
      return;
    }

    if (recognitionRef.current) recognitionRef.current.stop();

    const rec = new SR();
    rec.lang = 'pt-PT';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as SpeechRecognitionResultList)
        .map((r: any) => r[0].transcript)
        .join(' ');
      setSoapForm(f => ({ ...f, [fieldKey]: (f as any)[fieldKey] ? `${(f as any)[fieldKey]} ${transcript}` : transcript }));
    };
    rec.onend = () => { setIsListening(false); setActiveVoiceField(null); };
    rec.onerror = () => { setIsListening(false); setActiveVoiceField(null); };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setActiveVoiceField(fieldKey);
  };

  const carregarNotasClincias = () =>
    api.get(`/notas-clinicas/${doenteId}`).then((r) => setNotasClincias(r.data)).catch(() => setNotasClincias([]));

  useEffect(() => {
    carregarNotasClincias();
  }, [doenteId]);

  const submeterNotaClinica = async () => {
    const { subjetivo, objetivo, avaliacao, plano } = soapForm;
    if (!subjetivo.trim() || !objetivo.trim() || !avaliacao.trim() || !plano.trim()) return;
    setSalvandoSoap(true);
    try {
      if (notaSoapEditandoId) {
        await api.patch(`/notas-clinicas/${notaSoapEditandoId}`, soapForm);
        emitSocket('nota:edit-stop', { notaId: notaSoapEditandoId, doenteId });
        setNotaSoapEditandoId(null);
      } else {
        await api.post(`/notas-clinicas/${doenteId}`, soapForm);
      }
      toast.success('Nota guardada');
      setModalNotaClinica(false);
      setSoapForm({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' });
      carregarNotasClincias();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoSoap(false); }
  };

  const cancelarEdicao = (notaId: string | null) => {
    if (notaId) emitSocket('nota:edit-stop', { notaId, doenteId });
    setNotaSoapEditandoId(null);
    setModalNotaClinica(false);
  };

  const apagarNotaClinica = (notaId: string) => {
    setConfirmarAcao({
      titulo: 'Apagar Nota Clínica',
      mensagem: 'Apagar esta nota clínica permanentemente? Esta acção não pode ser revertida.',
      variant: 'danger',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.delete(`/notas-clinicas/${notaId}`);
          toast.success('Nota apagada');
          carregarNotasClincias();
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
        }
      },
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Notas Clínicas SOAP</span>
          {notasClincias.length > 0 && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
              {notasClincias.length}
            </span>
          )}
          {podeCriarNotaClinica && (
            <BtnAdd label="Adicionar nota clínica SOAP" onClick={() => {
              setSoapForm({ subjetivo: '', objetivo: '', avaliacao: '', plano: '' });
              setNotaSoapEditandoId(null);
              setModalNotaClinica(true);
            }} />
          )}
        </div>
        {notasClincias.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>
            {podeCriarNotaClinica ? 'Sem notas SOAP — clica em + para adicionar' : 'Sem notas clínicas registadas'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {notasClincias.map((n: any) => (
              <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '16px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{n.autor?.nome}</span>
                    <span className="text-slate-300 text-xs">·</span>
                    <span className="text-xs text-slate-400">
                      {new Date(n.criadaEm).toLocaleDateString('pt-PT')} {new Date(n.criadaEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {n.editadaEm && <span className="text-xs text-slate-400 italic">(editada)</span>}
                  </div>
                  {podeCriarNotaClinica && n.autor?.id === utilizador?.id && (
                    <div className="flex items-center gap-2">
                      {locks[n.id] && locks[n.id] !== utilizador?.nome ? (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                          ✎ A ser editado por {locks[n.id]}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => {
                            emitSocket('nota:edit-start', { notaId: n.id, doenteId });
                            setSoapForm({ subjetivo: n.subjetivo, objetivo: n.objetivo, avaliacao: n.avaliacao, plano: n.plano });
                            setNotaSoapEditandoId(n.id);
                            setModalNotaClinica(true);
                          }}
                            className="text-xs text-slate-400 hover:text-emerald-600 transition-colors" style={{ padding: '4px 8px' }}>Editar</button>
                          <button onClick={() => apagarNotaClinica(n.id)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors" style={{ padding: '4px 8px' }}>Apagar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'subjetivo', label: 'S — Subjetivo', cor: 'blue' },
                    { key: 'objetivo', label: 'O — Objetivo', cor: 'purple' },
                    { key: 'avaliacao', label: 'A — Avaliação', cor: 'amber' },
                    { key: 'plano', label: 'P — Plano', cor: 'green' },
                  ].map(({ key, label, cor }) => (
                    <div key={key} className={`rounded-lg bg-${cor}-50 border border-${cor}-100`} style={{ padding: '10px 12px' }}>
                      <p className={`text-xs font-bold text-${cor}-600 uppercase tracking-wide`} style={{ marginBottom: '4px' }}>{label}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{(n as any)[key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nota Clínica SOAP */}
      {modalNotaClinica && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-y-auto" style={{ maxWidth: '600px', padding: '32px', maxHeight: '90vh', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-xl font-bold text-slate-900">{notaSoapEditandoId ? 'Editar Nota SOAP' : 'Nova Nota Clínica SOAP'}</h2>
              <button onClick={() => { recognitionRef.current?.stop(); cancelarEdicao(notaSoapEditandoId); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {[
              { key: 'subjetivo', label: 'S — Subjetivo', placeholder: 'O que o doente refere: queixas, sintomas, história...', cor: 'blue' },
              { key: 'objetivo', label: 'O — Objetivo', placeholder: 'Dados objetivos: exame físico, sinais vitais, resultados de exames...', cor: 'purple' },
              { key: 'avaliacao', label: 'A — Avaliação', placeholder: 'Avaliação clínica, diagnóstico diferencial, raciocínio...', cor: 'amber' },
              { key: 'plano', label: 'P — Plano', placeholder: 'Plano de ação: tratamento, exames a pedir, consultas, alta...', cor: 'green' },
            ].map(({ key, label, placeholder, cor }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                  <label className={`block text-xs font-bold text-${cor}-600 uppercase tracking-wide`}>{label}</label>
                  <button
                    type="button"
                    onClick={() => toggleVoice(key)}
                    title={isListening && activeVoiceField === key ? 'Parar ditação' : 'Iniciar ditação por voz'}
                    className={`flex items-center gap-1 text-xs font-medium rounded-lg border transition-all ${
                      isListening && activeVoiceField === key
                        ? 'bg-red-500 text-white border-red-500 animate-pulse'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                    style={{ padding: '4px 8px' }}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    {isListening && activeVoiceField === key ? 'A gravar...' : 'Voz'}
                  </button>
                </div>
                <textarea value={(soapForm as any)[key]} onChange={e => setSoapForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={3} placeholder={placeholder}
                  className={`w-full border border-${cor}-200 rounded-xl text-sm bg-${cor}-50 focus:outline-none focus:ring-2 focus:ring-${cor}-400 resize-none ${isListening && activeVoiceField === key ? 'ring-2 ring-red-400' : ''}`}
                  style={{ padding: '10px 14px' }} />
              </div>
            ))}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => { recognitionRef.current?.stop(); cancelarEdicao(notaSoapEditandoId); }}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={submeterNotaClinica} disabled={salvandoSoap || !soapForm.subjetivo.trim() || !soapForm.objetivo.trim() || !soapForm.avaliacao.trim() || !soapForm.plano.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoSoap ? 'A guardar...' : 'Guardar Nota'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmarAcao}
        titulo={confirmarAcao?.titulo ?? ''}
        mensagem={confirmarAcao?.mensagem ?? ''}
        variant={confirmarAcao?.variant ?? 'danger'}
        onConfirmar={confirmarAcao?.onConfirmar ?? (() => {})}
        onCancelar={() => setConfirmarAcao(null)}
      />
    </>
  );
}
