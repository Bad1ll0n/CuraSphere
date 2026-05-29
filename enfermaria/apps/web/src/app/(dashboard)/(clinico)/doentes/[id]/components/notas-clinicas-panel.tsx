'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';

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

  const role = utilizador?.role ?? '';
  const podeCriarNotaClinica = ['medico', 'enfermeiro'].includes(role);

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
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSoapForm({ subjetivo: n.subjetivo, objetivo: n.objetivo, avaliacao: n.avaliacao, plano: n.plano }); setNotaSoapEditandoId(n.id); setModalNotaClinica(true); }}
                        className="text-xs text-slate-400 hover:text-emerald-600 transition-colors" style={{ padding: '4px 8px' }}>Editar</button>
                      <button onClick={() => apagarNotaClinica(n.id)}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors" style={{ padding: '4px 8px' }}>Apagar</button>
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
              <button onClick={() => setModalNotaClinica(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
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
                <label className={`block text-xs font-bold text-${cor}-600 uppercase tracking-wide`} style={{ marginBottom: '6px' }}>{label}</label>
                <textarea value={(soapForm as any)[key]} onChange={e => setSoapForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={3} placeholder={placeholder}
                  className={`w-full border border-${cor}-200 rounded-xl text-sm bg-${cor}-50 focus:outline-none focus:ring-2 focus:ring-${cor}-400 resize-none`}
                  style={{ padding: '10px 14px' }} />
              </div>
            ))}
            <div className="flex gap-3" style={{ marginTop: '8px' }}>
              <button onClick={() => setModalNotaClinica(false)}
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
