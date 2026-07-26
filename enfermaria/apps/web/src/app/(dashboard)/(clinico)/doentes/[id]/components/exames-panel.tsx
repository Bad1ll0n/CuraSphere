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

const TIPO_EXAME_LABELS: Record<string, string> = {
  analise_clinica: 'Análise Clínica', rx: 'Raio-X', eco: 'Ecografia',
  tc: 'TC', rmn: 'RMN', ecg: 'ECG', outro: 'Outro',
};
const ESTADO_EXAME_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  solicitado:            { label: 'Solicitado',            bg: 'bg-blue-50',   text: 'text-blue-700' },
  em_progresso:         { label: 'Em Progresso',          bg: 'bg-amber-50',  text: 'text-amber-700' },
  resultado_disponivel: { label: 'Resultado Disponível',  bg: 'bg-green-50',  text: 'text-green-700' },
  cancelado:            { label: 'Cancelado',             bg: 'bg-slate-100', text: 'text-slate-600' },
};

export function ExamesPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();

  const [exames, setExames] = useState<any[]>([]);
  const [modalExame, setModalExame] = useState(false);
  const [exameForm, setExameForm] = useState({ tipo: 'analise_clinica', descricao: '', urgente: false });
  const [resultadoModal, setResultadoModal] = useState<any>(null);
  const [resultadoTexto, setResultadoTexto] = useState('');
  const [salvandoExame, setSalvandoExame] = useState(false);
  const [confirmarAcao, setConfirmarAcao] = useState<{
    titulo: string; mensagem: string; variant: 'danger' | 'warning';
    onConfirmar: () => void;
  } | null>(null);

  const podeSolicitar = utilizador?.role === 'medico';
  const podeRegistarResultado = ['medico', 'tecnico_saude', 'administrativo'].includes(utilizador?.role ?? '');

  const carregarExames = () =>
    api.get(`/exames/${doenteId}`).then((r) => setExames(r.data)).catch(() => setExames([]));

  useEffect(() => {
    carregarExames();
  }, [doenteId]);

  const solicitarExame = async () => {
    if (!exameForm.descricao.trim()) return;
    setSalvandoExame(true);
    try {
      await api.post(`/exames/${doenteId}`, exameForm);
      toast.success('Guardado com sucesso');
      setModalExame(false);
      setExameForm({ tipo: 'analise_clinica', descricao: '', urgente: false });
      carregarExames();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoExame(false); }
  };

  const registarResultado = async () => {
    if (!resultadoModal || !resultadoTexto.trim()) return;
    setSalvandoExame(true);
    try {
      await api.patch(`/exames/${resultadoModal.id}/resultado`, { resultado: resultadoTexto });
      toast.success('Guardado com sucesso');
      setResultadoModal(null);
      setResultadoTexto('');
      carregarExames();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvandoExame(false); }
  };

  const cancelarExame = (exameId: string) => {
    setConfirmarAcao({
      titulo: 'Cancelar Exame',
      mensagem: 'Cancelar este exame? Esta acção não pode ser revertida.',
      variant: 'warning',
      onConfirmar: async () => {
        setConfirmarAcao(null);
        try {
          await api.patch(`/exames/${exameId}/cancelar`);
          toast.success('Exame cancelado');
          carregarExames();
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
          <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Exames Complementares</span>
          {podeSolicitar && <BtnAdd label="Solicitar exame" onClick={() => { setExameForm({ tipo: 'analise_clinica', descricao: '', urgente: false }); setModalExame(true); }} />}
        </div>
        {exames.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '20px 0' }}>Sem exames solicitados</p>
        ) : (
          <div className="flex flex-col gap-3">
            {exames.map((e: any) => {
              const cfg = ESTADO_EXAME_CONFIG[e.estado] ?? ESTADO_EXAME_CONFIG.solicitado;
              return (
                <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '14px 16px' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                      <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 badge-pad py-0.5 rounded-full">{TIPO_EXAME_LABELS[e.tipo] ?? e.tipo}</span>
                      {e.urgente && <span className="text-xs font-bold text-red-600 bg-red-50 badge-pad py-0.5 rounded-full">URGENTE</span>}
                      <span className={`text-xs font-medium badge-pad py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm text-slate-700">{e.descricao}</p>
                    {e.resultado && (
                      <p className="text-sm text-slate-600 bg-green-50 rounded-lg border border-green-100 mt-2" style={{ padding: '8px 12px' }}>
                        <span className="font-semibold text-green-700">Resultado:</span> {e.resultado}
                      </p>
                    )}
                    <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>
                      Por {e.solicitadoPor?.nome} · {new Date(e.criadoEm).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {podeRegistarResultado && ['solicitado', 'em_progresso'].includes(e.estado) && (
                      <button onClick={() => { setResultadoModal(e); setResultadoTexto(''); }}
                        className="text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}>
                        Resultado
                      </button>
                    )}
                    {podeSolicitar && e.estado === 'solicitado' && (
                      <button onClick={() => cancelarExame(e.id)}
                        className="text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        style={{ padding: '6px 12px' }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Solicitar Exame */}
      {modalExame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Solicitar Exame</h2>
              <button aria-label="Fechar" onClick={() => setModalExame(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Tipo de Exame</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TIPO_EXAME_LABELS).map(([v, l]) => (
                  <button key={v} onClick={() => setExameForm(f => ({ ...f, tipo: v }))}
                    className={`text-sm font-semibold filter-pad py-2 rounded-lg border transition-colors ${exameForm.tipo === v ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Descrição *</label>
              <textarea value={exameForm.descricao} onChange={e => setExameForm(f => ({ ...f, descricao: e.target.value }))}
                rows={3} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva o exame solicitado..." />
            </div>
            <div className="flex items-center gap-2" style={{ marginBottom: '24px' }}>
              <input type="checkbox" id="exameUrgente" checked={exameForm.urgente} onChange={e => setExameForm(f => ({ ...f, urgente: e.target.checked }))}
                className="w-4 h-4 accent-red-600" />
              <label htmlFor="exameUrgente" className="text-sm font-medium text-red-600">Urgente</label>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalExame(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={solicitarExame} disabled={salvandoExame || !exameForm.descricao.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoExame ? 'A solicitar...' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registar Resultado */}
      {resultadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full" style={{ maxWidth: '440px', padding: '32px', margin: '0 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 className="text-lg font-bold text-slate-900">Registar Resultado</h2>
              <button aria-label="Fechar" onClick={() => setResultadoModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
            </div>
            <p className="text-slate-600 text-sm" style={{ marginBottom: '20px' }}>
              {TIPO_EXAME_LABELS[resultadoModal.tipo] ?? resultadoModal.tipo} — {resultadoModal.descricao}
            </p>
            <div style={{ marginBottom: '24px' }}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Resultado *</label>
              <textarea value={resultadoTexto} onChange={e => setResultadoTexto(e.target.value)}
                rows={4} className="w-full border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                style={{ padding: '10px 14px' }} placeholder="Descreva o resultado do exame..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setResultadoModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                style={{ padding: '11px' }}>Cancelar</button>
              <button onClick={registarResultado} disabled={salvandoExame || !resultadoTexto.trim()}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '11px' }}>
                {salvandoExame ? 'A guardar...' : 'Guardar Resultado'}
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
