'use client';
import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';

/** UX-07: devolve a chave (vitals.interval.*) em vez do texto. */
function news2Intervalo(score: number): { chave: 'high' | 'medium' | 'low'; cor: string } {
  if (score >= 7) return { chave: 'high', cor: 'text-red-600' };
  if (score >= 5) return { chave: 'medium', cor: 'text-amber-600' };
  return { chave: 'low', cor: 'text-green-600' };
}
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { HelpTooltip } from '@/components/help-tooltip';
import { FormField } from '@/components/form-field';
import { RegistoDiferido } from '@/components/registo-diferido';
import { LeiturasMonitorPanel } from './leituras-monitor-panel';

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
  const t = useTranslations('vitals');

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
    <div role="presentation" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
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
          <button onClick={onClose} aria-label={t('closeModal')}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <svg aria-hidden="true" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const tc = useTranslations('common');
  const t = useTranslations('vitals');
  return (
    <div className="flex gap-3">
      <button onClick={onCancel}
        className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        style={{ padding: '11px' }}>{tc('cancel')}</button>
      <button onClick={onConfirm} disabled={disabled || loading}
        className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        style={{ padding: '11px' }}>
        {loading ? t('saving') : labelConfirm}
      </button>
    </div>
  );
}

export function SinaisVitaisPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const t = useTranslations('vitals');
  const tc = useTranslations('common');

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
  // PROD-09: dor como 5.º sinal vital.
  const [svDor, setSvDor] = useState('');
  const [svEscalaDor, setSvEscalaDor] = useState('numerica');
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
    { key: 'pressaoS', label: t('item.pressaoS'), val: svPressaoS, set: setSvPressaoS, ph: '120', min: 50, max: 250 },
    { key: 'pressaoD', label: t('item.pressaoD'), val: svPressaoD, set: setSvPressaoD, ph: '80', min: 30, max: 150 },
    { key: 'pulso', label: t('item.pulso'), val: svPulso, set: setSvPulso, ph: '72', min: 20, max: 300 },
    { key: 'temp', label: t('item.temp'), val: svTemp, set: setSvTemp, ph: '36.5', min: 30, max: 45 },
    { key: 'spO2', label: t('item.spO2'), val: svSpO2, set: setSvSpO2, ph: '98', min: 50, max: 100 },
    { key: 'freqResp', label: t('item.freqResp'), val: svFreqResp, set: setSvFreqResp, ph: '16', min: 5, max: 60 },
  ] as const;

  const maxDor = svEscalaDor === 'cpot' ? 8 : 10;
  const validarSV = (): boolean => {
    const erros: Record<string, string> = {};
    if (svDor !== '') {
      const n = Number(svDor);
      if (!Number.isInteger(n) || n < 0 || n > maxDor) erros['dor'] = t('between', { min: 0, max: maxDor });
    }
    svItens.forEach(({ key, val, min, max }) => {
      if (!val) return;
      const n = Number(val);
      if (isNaN(n)) erros[key] = t('invalid');
      else if (n < min || n > max) erros[key] = t('between', { min, max });
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
        dor:       svDor !== '' ? parseInt(svDor) : undefined,
        escalaDor: svDor !== '' ? svEscalaDor : undefined,
      });
      setSvDor('');
      toast.success(t('recorded'));
      setModalSinalVital(false);
      carregarSinaisVitais();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('saveError'));
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
          <span className="text-sm font-semibold text-slate-700">{t('title')}</span>
          <HelpTooltip chave="news2" />
          {['enfermeiro', 'auxiliar', 'medico'].includes(utilizador?.role ?? '') && (
            <BtnAdd label={t('record')} onClick={() => { setSvPressaoS(''); setSvPressaoD(''); setSvPulso(''); setSvTemp(''); setSvSpO2(''); setSvFreqResp(''); setSvPeso(''); setSvNotas(''); setSvAvpu('A'); setSvO2Suplementar(false); setModalSinalVital(true); }} />
          )}
        </div>
        <LeiturasMonitorPanel doenteId={doenteId} role={utilizador?.role} onValidadas={carregarSinaisVitais} />
        {sinaisVitais.length === 0 ? (
          <p className="text-sm text-slate-500 text-center" style={{ padding: '24px 0' }}>{t('empty')}</p>
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
                      {t('news2Level', { nivel: news2Intervalo(sinaisVitais[0].news2).chave, score: sinaisVitais[0].news2 })}
                    </p>
                    {news2Slope !== null && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        news2Slope >= 0.4 ? 'bg-red-100 text-red-700' :
                        news2Slope >= 0.1 ? 'bg-amber-100 text-amber-700' :
                        news2Slope <= -0.1 ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {news2Slope >= 0.1 ? `↑ +${news2Slope.toFixed(1)}/h` : news2Slope <= -0.1 ? `↓ ${news2Slope.toFixed(1)}/h` : t('stable')}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-medium ${news2Intervalo(sinaisVitais[0].news2).cor}`} style={{ margin: 0, marginTop: '2px' }}>
                    {t(`interval.${news2Intervalo(sinaisVitais[0].news2).chave}`)}
                  </p>
                </div>
              </div>
            )}

            {/* Scores de Risco Clínico: qSOFA + CURB-65 */}
            {scores && (scores.qSOFA || scores.curb65) && (
              <div className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '12px 16px', marginBottom: '12px' }}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>{t('riskScores')}</p>
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
                          {t(`qsofa.${scores.qSOFA.risco === 'alto' ? 'alto' : scores.qSOFA.risco === 'moderado' ? 'moderado' : 'baixo'}`)}
                        </p>
                        <p className="text-xs text-slate-500">{t('qsofaParams')}</p>
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
                          {t(`curb.${scores.curb65.risco === 'alto' ? 'alto' : scores.curb65.risco === 'moderado' ? 'moderado' : 'baixo'}`)}
                        </p>
                        <p className="text-xs text-slate-500">{t('curbNote')}</p>
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
                          {t(`sofa.${['muito_grave', 'grave', 'moderado'].includes(scores.sofa.gravidade) ? scores.sofa.gravidade : 'leve'}`)}
                        </p>
                        <p className="text-xs text-slate-500">{t('sofaComponents', { n: scores.sofa.componentesDisponiveis })}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROD-10: quando volta a ser devida a próxima observação (segundo o NEWS2). */}
            {sinaisVitais[0]?.proximaAvaliacaoEm && (() => {
              const devida = new Date(sinaisVitais[0].proximaAvaliacaoEm);
              const atrasada = devida.getTime() < Date.now();
              return (
                <p className={`text-xs font-semibold rounded-lg ${atrasada ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`} style={{ padding: '8px 12px', marginBottom: '12px' }} role={atrasada ? 'alert' : undefined}>
                  {atrasada ? t('obsOverdueAt') : t('nextObsAt')}
                  {devida.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              );
            })()}

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-600 font-semibold uppercase tracking-wide border-b border-slate-100">
                    <th scope="col" className="text-left pb-2">{t('col.date')}</th>
                    <th scope="col" className="text-center pb-2">{t('col.bp')}</th>
                    <th scope="col" className="text-center pb-2">{t('col.pulse')}</th>
                    <th scope="col" className="text-center pb-2">{t('col.temp')}</th>
                    <th scope="col" className="text-center pb-2">{t('col.spo2')}</th>
                    <th scope="col" className="text-center pb-2">{t('col.rr')}</th>
                    <th scope="col" className="text-center pb-2">{t('col.pain')}</th>
                    <th scope="col" className="text-center pb-2">NEWS2</th>
                    <th scope="col" className="text-left pb-2">{t('col.by')}</th>
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
                        <td className="py-2.5 text-slate-500 text-xs">{new Date(sv.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}<RegistoDiferido ocorridoEm={sv.data} registadoEm={sv.registadoEm} /></td>
                        <td className={`py-2.5 text-center font-semibold ${taCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.pressaoSistolica != null ? `${sv.pressaoSistolica}/${sv.pressaoDiastolica}` : '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${pulsoCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.pulso ?? '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${tempCrit ? 'text-red-600' : 'text-slate-700'}`}>{sv.temperatura != null ? sv.temperatura.toFixed(1) : '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${spO2Crit ? 'text-red-600' : 'text-slate-700'}`}>{sv.saturacaoO2 != null ? `${sv.saturacaoO2}%` : '—'}</td>
                        <td className="py-2.5 text-center text-slate-600">{sv.frequenciaRespiratoria ?? '—'}</td>
                        <td className={`py-2.5 text-center font-semibold ${sv.dor != null && (sv.escalaDor === 'cpot' ? sv.dor > 2 : sv.dor >= 7) ? 'text-red-600' : 'text-slate-700'}`}
                            title={sv.escalaDor ?? undefined}>
                          {sv.dor != null ? `${sv.dor}/${sv.escalaDor === 'cpot' ? 8 : 10}` : '—'}
                        </td>
                        <td className="py-2.5 text-center">
                          {sv.news2 != null ? (
                            <span className={`text-xs font-bold rounded-md badge-pad py-0.5 ${sv.news2 >= 7 ? 'bg-red-100 text-red-700' : sv.news2 >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                              {sv.news2}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 text-slate-500 text-xs">{sv.registadoPor?.nome}{sv.origem === 'monitor' && <span className="text-slate-400"> · {t('fromMonitor')}</span>}</td>
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
              <span className="text-sm font-semibold text-slate-700">{t('baseline')}</span>
              <HelpTooltip chave="baseline" />
              {baseline.nRegistos < 8 && (
                <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-md font-medium" style={{ padding: '2px 8px' }}>
                  {t('learning', { n: baseline.nRegistos })}
                </span>
              )}
            </div>
            <svg className={`w-4 h-4 text-slate-500 transition-transform ${baselineAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {baselineAberto && (
            <div style={{ padding: '0 24px 20px' }}>
              {baseline.nRegistos < 8 ? (
                <div className="rounded-xl bg-violet-50 border border-violet-100 text-center text-sm text-violet-700" style={{ padding: '20px' }}>
                  {t('learningLong', { n: baseline.nRegistos })}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-600 font-semibold uppercase tracking-wide border-b border-slate-100">
                      <th className="text-left py-2">{t('col.param')}</th>
                      <th className="text-center py-2">{t('col.mean')}</th>
                      <th className="text-center py-2">{t('col.last')}</th>
                      <th className="text-center py-2">{t('col.state')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: t('item.fc'), media: baseline.fcMedia, sd: baseline.fcSd, ultimo: sinaisVitais[0]?.pulso },
                      { label: t('item.pressaoS'), media: baseline.pasSistolicaMedia, sd: baseline.pasSistolicaSd, ultimo: sinaisVitais[0]?.pressaoSistolica },
                      { label: t('item.pressaoD'), media: baseline.pasDiastolicaMedia, sd: baseline.pasDiastolicaSd, ultimo: sinaisVitais[0]?.pressaoDiastolica },
                      { label: t('item.temp'), media: baseline.tempMedia, sd: baseline.tempSd, ultimo: sinaisVitais[0]?.temperatura },
                      { label: t('item.spO2'), media: baseline.spo2Media, sd: baseline.spo2Sd, ultimo: sinaisVitais[0]?.saturacaoO2 },
                      { label: t('item.fr'), media: baseline.frMedia, sd: baseline.frSd, ultimo: sinaisVitais[0]?.frequenciaRespiratoria },
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
                                {t('deviation')}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md" style={{ padding: '2px 8px' }}>
                                {t('normal')}
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
        <Modal titulo={t('recordTitle')} onClose={() => setModalSinalVital(false)}>
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
              <label htmlFor="fsinaisvi-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{t('weightKg')}</label>
              <input id="fsinaisvi-0" type="number" aria-label={t('weightKg')} value={svPeso} onChange={(e) => setSvPeso(e.target.value)} placeholder="70.5" className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ padding: '8px 12px' }} />
            </div>
            <div>
              <label htmlFor="fsinaisvi-1" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{t('avpuLabel')}</label>
              <select id="fsinaisvi-1" value={svAvpu} aria-label={t('avpuLabel')} onChange={(e) => setSvAvpu(e.target.value)} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" style={{ padding: '8px 12px' }}>
                {(['A', 'V', 'P', 'U'] as const).map((v) => <option key={v} value={v}>{t(`avpu.${v}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
            <FormField label={t('pain', { max: maxDor })} error={svErrors['dor']}>
              <input id="fsinaisvi-dor" type="number" min={0} max={maxDor} aria-label={t('painIntensity')} value={svDor}
                onChange={(e) => { setSvDor(e.target.value); setSvErrors(prev => { const n = { ...prev }; delete n['dor']; return n; }); }}
                placeholder="0"
                className={`w-full border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${svErrors['dor'] ? 'border-red-400' : 'border-slate-200'}`}
                style={{ padding: '8px 12px' }} />
            </FormField>
            <div>
              <label htmlFor="fsinaisvi-escala-dor" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{t('painScale')}</label>
              <select id="fsinaisvi-escala-dor" value={svEscalaDor} onChange={(e) => setSvEscalaDor(e.target.value)} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" style={{ padding: '8px 12px' }}>
                {(['numerica', 'eva', 'faces', 'painad', 'cpot', 'flacc'] as const).map((v) => <option key={v} value={v}>{t(`scale.${v}`)}</option>)}
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
              <span className="text-sm font-medium text-slate-700">{t('supplementalO2')}</span>
              <span className="text-xs text-slate-500">{t('news2Points')}</span>
            </label>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="fsinaisvi-2" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>{t('notes')}</label>
            <textarea id="fsinaisvi-2" rows={2} aria-label={t('notes')} value={svNotas} onChange={(e) => setSvNotas(e.target.value)} placeholder={t('notesPlaceholder')} className="w-full border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ padding: '8px 12px' }} />
          </div>
          <div className="rounded-xl text-xs text-slate-500 bg-slate-50 border border-slate-100" style={{ padding: '10px 14px', marginBottom: '16px' }}>
            {t('news2Hint')}
          </div>
          <ModalFooter onCancel={() => setModalSinalVital(false)} onConfirm={submeterSinalVital} loading={salvando} disabled={salvando} labelConfirm={tc('save')} />
        </Modal>
      )}
    </>
  );
}
