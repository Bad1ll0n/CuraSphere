'use client';
import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

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
      <div ref={ref}
           role="dialog"
           aria-modal="true"
           aria-labelledby="modal-titulo"
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

export function SinaisVitaisPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();

  const [sinaisVitais, setSinaisVitais] = useState<any[]>([]);
  const [modalSinalVital, setModalSinalVital] = useState(false);
  const [svPressaoS, setSvPressaoS] = useState('');
  const [svPressaoD, setSvPressaoD] = useState('');
  const [svPulso, setSvPulso] = useState('');
  const [svTemp, setSvTemp] = useState('');
  const [svSpO2, setSvSpO2] = useState('');
  const [svFreqResp, setSvFreqResp] = useState('');
  const [svPeso, setSvPeso] = useState('');
  const [svNotas, setSvNotas] = useState('');
  const [svAvpu, setSvAvpu] = useState('A');
  const [salvando, setSalvando] = useState(false);

  const carregarSinaisVitais = () =>
    api.get(`/sinais-vitais/${doenteId}`)
      .then((r) => setSinaisVitais(r.data))
      .catch(() => setSinaisVitais([]));

  useEffect(() => {
    carregarSinaisVitais();
  }, [doenteId]);

  const submeterSinalVital = async () => {
    setSalvando(true);
    try {
      await api.post(`/sinais-vitais/${doenteId}`, {
        pressaoSistolica:       svPressaoS  ? parseInt(svPressaoS)  : undefined,
        pressaoDiastolica:      svPressaoD  ? parseInt(svPressaoD)  : undefined,
        pulso:                  svPulso     ? parseInt(svPulso)     : undefined,
        temperatura:            svTemp      ? parseFloat(svTemp)    : undefined,
        saturacaoO2:            svSpO2      ? parseInt(svSpO2)      : undefined,
        frequenciaRespiratoria: svFreqResp  ? parseInt(svFreqResp)  : undefined,
        peso:                   svPeso      ? parseFloat(svPeso)    : undefined,
        notas: svNotas || undefined,
        avpu: svAvpu || undefined,
      });
      toast.success('Sinais vitais registados');
      setModalSinalVital(false);
      carregarSinaisVitais();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
          <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700">Sinais Vitais</span>
          {['enfermeiro', 'auxiliar', 'medico'].includes(utilizador?.role ?? '') && (
            <BtnAdd label="Registar sinais vitais" onClick={() => { setSvPressaoS(''); setSvPressaoD(''); setSvPulso(''); setSvTemp(''); setSvSpO2(''); setSvFreqResp(''); setSvPeso(''); setSvNotas(''); setSvAvpu('A'); setModalSinalVital(true); }} />
          )}
        </div>
        {sinaisVitais.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>Sem registos de sinais vitais</p>
        ) : (
          <>
            {/* Gráfico */}
            {sinaisVitais.length > 1 && (
              <div style={{ marginBottom: '24px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[...sinaisVitais].reverse().map((sv) => ({
                    hora: new Date(sv.data).toLocaleTimeString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    TA: sv.pressaoSistolica ?? null,
                    Pulso: sv.pulso ?? null,
                    'SpO₂': sv.saturacaoO2 ?? null,
                    'Temp': sv.temperatura ?? null,
                  }))}>
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="TA" stroke="#ef4444" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="Pulso" stroke="#f97316" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="SpO₂" stroke="#3b82f6" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="Temp" stroke="#8b5cf6" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Banner NEWS2 se score alto */}
            {sinaisVitais[0]?.news2 != null && sinaisVitais[0].news2 >= 5 && (
              <div className={`rounded-xl flex items-center gap-3 text-sm font-medium ${sinaisVitais[0].news2 >= 7 ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`} style={{ padding: '12px 16px', marginBottom: '12px' }}>
                <span className={`text-xl font-black ${sinaisVitais[0].news2 >= 7 ? 'text-red-600' : 'text-amber-600'}`}>{sinaisVitais[0].news2}</span>
                <div>
                  <p className="font-semibold" style={{ margin: 0 }}>
                    NEWS2 {sinaisVitais[0].news2 >= 7 ? 'CRÍTICO' : 'ALTO'} — Score {sinaisVitais[0].news2}
                  </p>
                  <p className="text-xs opacity-80" style={{ margin: 0 }}>
                    {sinaisVitais[0].news2 >= 7 ? 'Resposta imediata necessária. Activar equipa de emergência.' : 'Monitorização frequente e avaliação clínica urgente.'}
                  </p>
                </div>
              </div>
            )}

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-600 font-semibold uppercase tracking-wide border-b border-slate-100">
                    <th scope="col" className="text-left pb-2">Data/Hora</th>
                    <th scope="col" className="text-center pb-2">TA (mmHg)</th>
                    <th scope="col" className="text-center pb-2">Pulso</th>
                    <th scope="col" className="text-center pb-2">Temp ºC</th>
                    <th scope="col" className="text-center pb-2">SpO₂ %</th>
                    <th scope="col" className="text-center pb-2">FR</th>
                    <th scope="col" className="text-center pb-2">NEWS2</th>
                    <th scope="col" className="text-left pb-2">Registado por</th>
                  </tr>
                </thead>
                <tbody>
                  {sinaisVitais.map((sv: any) => {
                    const taCrit = sv.pressaoSistolica != null && (sv.pressaoSistolica >= 160 || sv.pressaoSistolica < 80);
                    const pulsoCrit = sv.pulso != null && (sv.pulso > 120 || sv.pulso < 50);
                    const tempCrit = sv.temperatura != null && (sv.temperatura > 38.5 || sv.temperatura < 35);
                    const spO2Crit = sv.saturacaoO2 != null && sv.saturacaoO2 < 90;
                    return (
                      <tr key={sv.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 text-slate-500 text-xs">{new Date(sv.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className={`py-2.5 text-center font-semibold ${taCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.pressaoSistolica != null ? `${sv.pressaoSistolica}/${sv.pressaoDiastolica}` : '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${pulsoCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.pulso ?? '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${tempCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.temperatura != null ? sv.temperatura.toFixed(1) : '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${spO2Crit ? 'text-red-600' : 'text-slate-700'}`}>{sv.saturacaoO2 != null ? `${sv.saturacaoO2}%` : '—'}</td>
                        <td className="py-2.5 text-center text-slate-600">{sv.frequenciaRespiratoria ?? '—'}</td>
                        <td className="py-2.5 text-center">
                          {sv.news2 != null ? (
                            <span className={`text-xs font-bold rounded-md badge-pad py-0.5 ${sv.news2 >= 7 ? 'bg-red-100 text-red-700' : sv.news2 >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                              {sv.news2}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 text-slate-400 text-xs">{sv.registadoPor?.nome}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Sinais Vitais */}
      {modalSinalVital && (
        <Modal titulo="Registar Sinais Vitais" onClose={() => setModalSinalVital(false)}>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            {[
              { label: 'TA Sistólica (mmHg)', val: svPressaoS, set: setSvPressaoS, ph: '120' },
              { label: 'TA Diastólica (mmHg)', val: svPressaoD, set: setSvPressaoD, ph: '80' },
              { label: 'Pulso (bpm)', val: svPulso, set: setSvPulso, ph: '72' },
              { label: 'Temperatura (ºC)', val: svTemp, set: setSvTemp, ph: '36.5' },
              { label: 'SpO₂ (%)', val: svSpO2, set: setSvSpO2, ph: '98' },
              { label: 'Freq. Resp. (rpm)', val: svFreqResp, set: setSvFreqResp, ph: '16' },
            ].map(({ label, val, set, ph }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{label}</label>
                <input type="number" value={val} onChange={(e) => set(e.target.value)} placeholder={ph} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '8px 12px' }} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Peso (kg)</label>
              <input type="number" value={svPeso} onChange={(e) => setSvPeso(e.target.value)} placeholder="70.5" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '8px 12px' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Consciência (AVPU)</label>
              <select value={svAvpu} onChange={(e) => setSvAvpu(e.target.value)} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" style={{ padding: '8px 12px' }}>
                <option value="A">A — Alert (Alerta)</option>
                <option value="V">V — Voice (Responde à voz)</option>
                <option value="P">P — Pain (Responde à dor)</option>
                <option value="U">U — Unresponsive (Sem resposta)</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Notas</label>
            <textarea rows={2} value={svNotas} onChange={(e) => setSvNotas(e.target.value)} placeholder="Observações..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '8px 12px' }} />
          </div>
          <div className="rounded-xl text-xs text-slate-500 bg-slate-50 border border-slate-100" style={{ padding: '10px 14px', marginBottom: '16px' }}>
            O score NEWS2 é calculado automaticamente com base nos valores registados. Score ≥5 gera alerta clínico.
          </div>
          <ModalFooter onCancel={() => setModalSinalVital(false)} onConfirm={submeterSinalVital} loading={salvando} disabled={salvando} labelConfirm="Guardar" />
        </Modal>
      )}
    </>
  );
}
