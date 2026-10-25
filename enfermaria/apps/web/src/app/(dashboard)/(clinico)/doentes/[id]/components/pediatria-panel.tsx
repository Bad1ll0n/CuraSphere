'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface PewsRegisto {
  data: string;
  pews: number | null;
  frequenciaRespiratoria: number | null;
  pulso: number | null;
  saturacaoO2: number | null;
  temperatura: number | null;
}

interface DoseResultado {
  doseMg: number;
  limitadaPorMaximo: boolean;
  doseDiariaMg: number | null;
  aviso: string | null;
  pesoKg: number;
  fontePeso: string;
}

function pewsCor(score: number): { bg: string; border: string; txt: string; label: string } {
  if (score >= 6) return { bg: '#fef2f2', border: '#fecaca', txt: '#dc2626', label: 'CRÍTICO — reavaliação imediata' };
  if (score >= 4) return { bg: '#fffbeb', border: '#fde68a', txt: '#d97706', label: 'ALTO — reavaliação urgente' };
  return { bg: '#f0fdf4', border: '#bbf7d0', txt: '#16a34a', label: 'Vigiar' };
}

export function PediatriaPanel({ doenteId }: Props) {
  const toast = useToast();
  const [pews, setPews] = useState<PewsRegisto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mgPorKg, setMgPorKg] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [doseMax, setDoseMax] = useState('');
  const [freq, setFreq] = useState('');
  const [resultado, setResultado] = useState<DoseResultado | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    api
      .get<PewsRegisto[]>(`/pediatria/pews/${doenteId}`)
      .then((r) => setPews(r.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [doenteId]);

  const ultimo = pews[0];
  const serie = [...pews]
    .reverse()
    .map((p) => ({ data: new Date(p.data).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }), PEWS: p.pews }));

  async function calcular() {
    const mg = parseFloat(mgPorKg);
    if (!(mg > 0)) {
      toast.error('Indique a dose em mg/kg.');
      return;
    }
    setCalculando(true);
    try {
      const body: Record<string, number | string> = { doenteId, mgPorKg: mg };
      if (pesoKg) body.pesoKg = parseFloat(pesoKg);
      if (doseMax) body.doseMaximaMg = parseFloat(doseMax);
      if (freq) body.frequenciaDia = parseFloat(freq);
      const r = await api.post<DoseResultado>('/pediatria/calcular-dose', body);
      setResultado(r.data);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Falha ao calcular a dose.');
    } finally {
      setCalculando(false);
    }
  }

  const cor = ultimo?.pews != null ? pewsCor(ultimo.pews) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="text-base font-semibold text-slate-900" style={{ marginBottom: '16px' }}>Pediatria</h3>

      {/* PEWS */}
      <div style={{ marginBottom: '20px' }}>
        <div className="text-xs font-medium text-slate-500" style={{ marginBottom: '8px' }}>
          PEWS — Pediatric Early Warning Score (calculado por faixa etária)
        </div>
        {loading ? (
          <div className="text-sm text-slate-400">A carregar…</div>
        ) : ultimo?.pews == null || !cor ? (
          <div className="text-sm text-slate-400">
            Sem PEWS registado — é calculado automaticamente ao registar sinais vitais.
          </div>
        ) : (
          <>
            <div
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: cor.bg, border: `1px solid ${cor.border}`, marginBottom: '12px' }}
            >
              <span className="text-2xl font-bold" style={{ color: cor.txt }}>{ultimo.pews}</span>
              <div>
                <div className="text-sm font-semibold" style={{ color: cor.txt }}>{cor.label}</div>
                <div className="text-xs text-slate-500">Último registo: {new Date(ultimo.data).toLocaleString('pt-PT')}</div>
              </div>
            </div>
            {serie.length > 1 && (
              <div style={{ height: '140px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie}>
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="PEWS" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* Calculadora de dose por peso */}
      <div className="border-t border-slate-100" style={{ paddingTop: '16px' }}>
        <div className="text-xs font-medium text-slate-500" style={{ marginBottom: '8px' }}>Calculadora de dose por peso</div>
        <div className="grid grid-cols-2 gap-2" style={{ marginBottom: '10px' }}>
          <input value={mgPorKg} onChange={(e) => setMgPorKg(e.target.value)} type="number" placeholder="mg/kg"
            aria-label="Dose por kg (mg/kg)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} type="number" placeholder="Peso (kg) — opcional"
            aria-label="Peso em kg (opcional)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input value={doseMax} onChange={(e) => setDoseMax(e.target.value)} type="number" placeholder="Dose máx (mg)"
            aria-label="Dose máxima em mg" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input value={freq} onChange={(e) => setFreq(e.target.value)} type="number" placeholder="Tomas/dia"
            aria-label="Tomas por dia" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={calcular} disabled={calculando}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
          {calculando ? 'A calcular…' : 'Calcular dose'}
        </button>
        <p className="text-xs text-slate-400" style={{ marginTop: '6px' }}>
          Sem peso, usa o último registado nos sinais vitais. Apoio à decisão — validar contra o formulário.
        </p>
        {resultado && (
          <div className="rounded-xl p-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', marginTop: '12px' }}>
            <div className="text-lg font-bold text-blue-700">
              {resultado.doseMg} mg <span className="text-sm font-normal text-slate-500">por toma</span>
            </div>
            {resultado.doseDiariaMg != null && <div className="text-sm text-slate-600">{resultado.doseDiariaMg} mg/dia</div>}
            <div className="text-xs text-slate-500" style={{ marginTop: '4px' }}>Peso: {resultado.pesoKg} kg ({resultado.fontePeso})</div>
            {resultado.aviso && <div className="text-xs font-medium text-amber-600" style={{ marginTop: '4px' }}>⚠ {resultado.aviso}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
