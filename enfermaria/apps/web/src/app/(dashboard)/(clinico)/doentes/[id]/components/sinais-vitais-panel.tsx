'use client';
import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function news2Intervalo(score: number): { texto: string; cor: string } {
  if (score >= 7) return { texto: 'Monitorização contínua · resposta imediata', cor: 'text-red-600' };
  if (score >= 5) return { texto: 'Monitorizar de 4h/4h · resposta urgente', cor: 'text-amber-600' };
  return { texto: 'Monitorizar de 12h/12h', cor: 'text-green-600' };
}
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { HelpTooltip } from '@/components/help-tooltip';
import { FormField } from '@/components/form-field';

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
  const [svO2Suplementar, setSvO2Suplementar] = useState(false);
  const [svErrors, setSvErrors] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [baseline, setBaseline] = useState<any>(null);
  const [baselineAberto, setBaselineAberto] = useState(false);
  const [scores, setScores] = useState<any>(null);
  const [news2Slope, setNews2Slope] = useState<number | null>(null);

  const carregarSinaisVitais = () =>
    api.get(`/sinais-vitais/${doenteId}`)
      .then((r) => setSinaisVitais(r.data))
      .catch(() => setSinaisVitais([]));

  useEffect(() => {
    carregarSinaisVitais();
  }, [doenteId]);

  useEffect(() => {
    api.get(`/baselines/${doenteId}`)
      .then((r) => setBaseline(r.data))
      .catch(() => setBaseline(null));
    api.get(`/sinais-vitais/${doenteId}/scores`)
      .then((r) => setScores(r.data))
      .catch(() => setScores(null));
    api.get(`/sinais-vitais/${doenteId}/tendencia`)
      .then((r) => setNews2Slope(r.data?.news2Slope ?? null))
      .catch(() => setNews2Slope(null));
  }, [doenteId]);

  const svItens = [
    { key: 'pressaoS', label: 'TA Sistólica (mmHg)', val: svPressaoS, set: setSvPressaoS, ph: '120', min: 50, max: 250 },
    { key: 'pressaoD', label: 'TA Diastólica (mmHg)', val: svPressaoD, set: setSvPressaoD, ph: '80', min: 30, max: 150 },
    { key: 'pulso', label: 'Pulso (bpm)', val: svPulso, set: setSvPulso, ph: '72', min: 20, max: 300 },
    { key: 'temp', label: 'Temperatura (ºC)', val: svTemp, set: setSvTemp, ph: '36.5', min: 30, max: 45 },
    { key: 'spO2', label: 'SpO₂ (%)', val: svSpO2, set: setSvSpO2, ph: '98', min: 50, max: 100 },
    { key: 'freqResp', label: 'Freq. Resp. (rpm)', val: svFreqResp, set: setSvFreqResp, ph: '16', min: 5, max: 60 },
  ] as const;

  const validarSV = (): boolean => {
    const erros: Record<string, string> = {};
    svItens.forEach(({ key, val, min, max }) => {
      if (!val) return;
      const n = Number(val);
      if (isNaN(n)) erros[key] = 'Valor inválido';
      else if (n < min || n > max) erros[key] = `Deve estar entre ${min} e ${max}`;
    });
    setSvErrors(erros);
    return Object.keys(erros).length === 0;
  };

  const submeterSinalVital = async () => {
    if (!validarSV()) return;
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
        o2Suplementar: svO2Suplementar || undefined,
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
          <HelpTooltip chave="news2" />
          {['enfermeiro', 'auxiliar', 'medico'].includes(utilizador?.role ?? '') && (
            <BtnAdd label="Registar sinais vitais" onClick={() => { setSvPressaoS(''); setSvPressaoD(''); setSvPulso(''); setSvTemp(''); setSvSpO2(''); setSvFreqResp(''); setSvPeso(''); setSvNotas(''); setSvAvpu('A'); setSvO2Suplementar(false); setModalSinalVital(true); }} />
          )}
        </div>
        {sinaisVitais.length === 0 ? (
          <p className="text-sm text-slate-400 text-center" style={{ padding: '24px 0' }}>Sem registos de sinais vitais</p>
        ) : (
          <>
            {/* Gráfico */}
            {sinaisVitais.length > 1 && (
              <div style={{ marginBottom: '24px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={[...sinaisVitais].reverse().map((sv) => ({
                    hora: new Date(sv.data).toLocaleTimeString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    TA: sv.pressaoSistolica ?? null,
                    Pulso: sv.pulso ?? null,
                    'SpO₂': sv.saturacaoO2 ?? null,
                    Temp: sv.temperatura ?? null,
                    Peso: sv.peso ?? null,
                    NEWS2: sv.news2 ?? null,
                  }))}>
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 20]} tick={{ fontSize: 10 }} tickCount={5} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="TA" stroke="#ef4444" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="Pulso" stroke="#f97316" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="SpO₂" stroke="#3b82f6" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="Temp" stroke="#8b5cf6" dot={false} strokeWidth={2} connectNulls />
                    <Line yAxisId="left" type="monotone" dataKey="Peso" stroke="#14b8a6" dot={false} strokeWidth={1.5} strokeDasharray="4 2" connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="NEWS2" stroke="#dc2626" dot={false} strokeWidth={2} strokeDasharray="6 3" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Banner NEWS2 com intervalo recomendado */}
            {sinaisVitais[0]?.news2 != null && (
              <div className={`rounded-xl flex items-start gap-3 text-sm font-medium ${sinaisVitais[0].news2 >= 7 ? 'bg-red-50 border border-red-200 text-red-800' : sinaisVitais[0].news2 >= 5 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'}`} style={{ padding: '12px 16px', marginBottom: '12px' }}>
                <span className={`text-xl font-black mt-0.5 ${sinaisVitais[0].news2 >= 7 ? 'text-red-600' : sinaisVitais[0].news2 >= 5 ? 'text-amber-600' : 'text-green-600'}`}>{sinaisVitais[0].news2}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ margin: 0 }}>
                      NEWS2 {sinaisVitais[0].news2 >= 7 ? 'CRÍTICO' : sinaisVitais[0].news2 >= 5 ? 'ALTO' : 'BAIXO'} — Score {sinaisVitais[0].news2}
                    </p>
                    {news2Slope !== null && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        news2Slope >= 0.4 ? 'bg-red-100 text-red-700' :
                        news2Slope >= 0.1 ? 'bg-amber-100 text-amber-700' :
                        news2Slope <= -0.1 ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {news2Slope >= 0.1 ? `↑ +${news2Slope.toFixed(1)}/h` : news2Slope <= -0.1 ? `↓ ${news2Slope.toFixed(1)}/h` : '→ estável'}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-medium ${news2Intervalo(sinaisVitais[0].news2).cor}`} style={{ margin: 0, marginTop: '2px' }}>
                    {news2Intervalo(sinaisVitais[0].news2).texto}
                  </p>
                </div>
              </div>
            )}

            {/* Scores de Risco Clínico: qSOFA + CURB-65 */}
            {scores && (scores.qSOFA || scores.curb65) && (
              <div className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 16px', marginBottom: '12px' }}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Scores de Risco</p>
                <div className="flex flex-wrap gap-3">
                  {scores.qSOFA && (
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${scores.qSOFA.risco === 'alto' ? 'bg-red-50 border-red-200' : scores.qSOFA.risco === 'moderado' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <div>
                        <p className="text-xs font-bold text-slate-600">qSOFA</p>
                        <span className={`text-lg font-black leading-none ${scores.qSOFA.risco === 'alto' ? 'text-red-600' : scores.qSOFA.risco === 'moderado' ? 'text-amber-600' : 'text-green-600'}`}>
                          {scores.qSOFA.score}/3
                        </span>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${scores.qSOFA.risco === 'alto' ? 'text-red-700' : scores.qSOFA.risco === 'moderado' ? 'text-amber-700' : 'text-green-700'}`}>
                          {scores.qSOFA.risco === 'alto' ? '⚠ Suspeita sépsis' : scores.qSOFA.risco === 'moderado' ? 'Monitorizar' : 'Baixo risco'}
                        </p>
                        <p className="text-xs text-slate-400">FR · PAS · Consciência</p>
                      </div>
                    </div>
                  )}
                  {scores.curb65 && (
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${scores.curb65.risco === 'alto' ? 'bg-red-50 border-red-200' : scores.curb65.risco === 'moderado' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <div>
                        <p className="text-xs font-bold text-slate-600">CURB-65</p>
                        <span className={`text-lg font-black leading-none ${scores.curb65.risco === 'alto' ? 'text-red-600' : scores.curb65.risco === 'moderado' ? 'text-amber-600' : 'text-green-600'}`}>
                          {scores.curb65.score}/4
                        </span>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${scores.curb65.risco === 'alto' ? 'text-red-700' : scores.curb65.risco === 'moderado' ? 'text-amber-700' : 'text-green-700'}`}>
                          {scores.curb65.risco === 'alto' ? 'Considerar UCI' : scores.curb65.risco === 'moderado' ? 'Internamento' : 'Ambulatório'}
                        </p>
                        <p className="text-xs text-slate-400">Pneumonia (sem Ureia)</p>
                      </div>
                    </div>
                  )}
                  {scores.sofa && (
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      scores.sofa.gravidade === 'muito_grave' ? 'bg-red-50 border-red-200' :
                      scores.sofa.gravidade === 'grave' ? 'bg-orange-50 border-orange-200' :
                      scores.sofa.gravidade === 'moderado' ? 'bg-amber-50 border-amber-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <div>
                        <p className="text-xs font-bold text-slate-600">SOFA</p>
                        <span className={`text-lg font-black leading-none ${
                          scores.sofa.gravidade === 'muito_grave' ? 'text-red-600' :
                          scores.sofa.gravidade === 'grave' ? 'text-orange-600' :
                          scores.sofa.gravidade === 'moderado' ? 'text-amber-600' :
                          'text-green-600'
                        }`}>
                          {scores.sofa.score}/24
                        </span>
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${
                          scores.sofa.gravidade === 'muito_grave' ? 'text-red-700' :
                          scores.sofa.gravidade === 'grave' ? 'text-orange-700' :
                          scores.sofa.gravidade === 'moderado' ? 'text-amber-700' :
                          'text-green-700'
                        }`}>
                          {scores.sofa.gravidade === 'muito_grave' ? '⚠ Muito grave' :
                           scores.sofa.gravidade === 'grave' ? '⚠ Grave — UCI' :
                           scores.sofa.gravidade === 'moderado' ? 'Moderado' : 'Leve'}
                        </p>
                        <p className="text-xs text-slate-400">{scores.sofa.componentesDisponiveis}/6 componentes</p>
                      </div>
                    </div>
                  )}
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

      {/* Baseline Individual */}
      {baseline && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setBaselineAberto(a => !a)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBaselineAberto(a => !a); } }}
            className="w-full flex items-center justify-between text-left hover:bg-slate-50/50 rounded-2xl transition-colors cursor-pointer"
            style={{ padding: '16px 24px' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">Baseline Individual</span>
              <HelpTooltip chave="baseline" />
              {baseline.nRegistos < 8 && (
                <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-md font-medium" style={{ padding: '2px 8px' }}>
                  A aprender — {baseline.nRegistos}/8 registos
                </span>
              )}
            </div>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${baselineAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {baselineAberto && (
            <div style={{ padding: '0 24px 20px' }}>
              {baseline.nRegistos < 8 ? (
                <div className="rounded-xl bg-violet-50 border border-violet-100 text-center text-sm text-violet-700" style={{ padding: '20px' }}>
                  A aprender o baseline deste doente — {baseline.nRegistos}/8 registos necessários
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-600 font-semibold uppercase tracking-wide border-b border-slate-100">
                      <th className="text-left py-2">Parâmetro</th>
                      <th className="text-center py-2">Média ± SD</th>
                      <th className="text-center py-2">Último valor</th>
                      <th className="text-center py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'FC (bpm)', media: baseline.fcMedia, sd: baseline.fcSd, ultimo: sinaisVitais[0]?.pulso },
                      { label: 'TA Sistólica (mmHg)', media: baseline.pasSistolicaMedia, sd: baseline.pasSistolicaSd, ultimo: sinaisVitais[0]?.pressaoSistolica },
                      { label: 'TA Diastólica (mmHg)', media: baseline.pasDiastolicaMedia, sd: baseline.pasDiastolicaSd, ultimo: sinaisVitais[0]?.pressaoDiastolica },
                      { label: 'Temperatura (ºC)', media: baseline.tempMedia, sd: baseline.tempSd, ultimo: sinaisVitais[0]?.temperatura },
                      { label: 'SpO₂ (%)', media: baseline.spo2Media, sd: baseline.spo2Sd, ultimo: sinaisVitais[0]?.saturacaoO2 },
                      { label: 'FR (rpm)', media: baseline.frMedia, sd: baseline.frSd, ultimo: sinaisVitais[0]?.frequenciaRespiratoria },
                    ].map(({ label, media, sd, ultimo }) => {
                      if (media == null) return null;
                      const desviado = ultimo != null && sd != null && Math.abs(ultimo - media) > 2 * sd;
                      return (
                        <tr key={label} className="border-b border-slate-50">
                          <td className="py-2.5 text-slate-700 font-medium">{label}</td>
                          <td className="py-2.5 text-center text-slate-500 text-xs">
                            {media.toFixed(1)} ± {sd?.toFixed(1) ?? '—'}
                          </td>
                          <td className="py-2.5 text-center font-semibold text-slate-700">
                            {ultimo != null ? ultimo : '—'}
                          </td>
                          <td className="py-2.5 text-center">
                            {ultimo == null ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : desviado ? (
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md" style={{ padding: '2px 8px' }}>
                                ⚠ Desvio
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md" style={{ padding: '2px 8px' }}>
                                ✓ Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Sinais Vitais */}
      {modalSinalVital && (
        <Modal titulo="Registar Sinais Vitais" onClose={() => setModalSinalVital(false)}>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            {svItens.map(({ key, label, val, set, ph }) => (
              <FormField key={key} label={label} error={svErrors[key]}>
                <input type="number" value={val} onChange={(e) => { set(e.target.value); setSvErrors(prev => { const n = { ...prev }; delete n[key]; return n; }); }} placeholder={ph}
                  className={`w-full border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${svErrors[key] ? 'border-red-400' : 'border-slate-200'}`}
                  style={{ padding: '8px 12px' }} />
              </FormField>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Peso (kg)</label>
              <input type="number" aria-label="Peso (kg)" value={svPeso} onChange={(e) => setSvPeso(e.target.value)} placeholder="70.5" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '8px 12px' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Consciência (AVPU)</label>
              <select value={svAvpu} aria-label="Consciência (AVPU)" onChange={(e) => setSvAvpu(e.target.value)} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" style={{ padding: '8px 12px' }}>
                <option value="A">A — Alert (Alerta)</option>
                <option value="V">V — Voice (Responde à voz)</option>
                <option value="P">P — Pain (Responde à dor)</option>
                <option value="U">U — Unresponsive (Sem resposta)</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={svO2Suplementar}
                onChange={(e) => setSvO2Suplementar(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">O₂ Suplementar em uso</span>
              <span className="text-xs text-slate-400">(+2 pts NEWS2)</span>
            </label>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Notas</label>
            <textarea rows={2} aria-label="Notas" value={svNotas} onChange={(e) => setSvNotas(e.target.value)} placeholder="Observações..." className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '8px 12px' }} />
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
