'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface LosData {
  losEstimadoDias: number;
  confianca: 'alta' | 'media' | 'baixa';
  factores: string[];
  alertaAtraso: boolean;
  diasJaInternado?: number;
  disclaimer?: string;
  _decisaoId?: string;
}

const CONFIANCA_COR: Record<string, string> = {
  alta: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  media: 'text-amber-600 bg-amber-50 border-amber-200',
  baixa: 'text-slate-500 bg-slate-50 border-slate-200',
};

const ROLES_COM_LOS = ['medico', 'chefe_enfermeiros', 'chefe_turno'];

export function LosWidget({ doenteId, utilizador }: Props) {
  const [los, setLos] = useState<LosData | null>(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);

  const role = utilizador?.role ?? '';
  if (!ROLES_COM_LOS.includes(role)) return null;

  const carregar = async () => {
    if (los || loading) return;
    setLoading(true);
    try {
      const r = await api.get(`/ai-clinico/${doenteId}/los`);
      setLos(r.data);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [doenteId]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg animate-pulse"
        style={{ padding: '4px 10px' }}>
        ⏱ A estimar alta...
      </span>
    );
  }

  if (!los) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-lg transition-colors ${
          los.alertaAtraso
            ? 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
            : CONFIANCA_COR[los.confianca]
        }`}
        style={{ padding: '4px 10px' }}
        title="Previsão de alta IA"
      >
        {los.alertaAtraso ? '⚠ ' : '⏱ '}
        {los.losEstimadoDias} {los.losEstimadoDias === 1 ? 'dia' : 'dias'} estimados
        <svg className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {aberto && (
        <div className="absolute top-full left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 w-72"
          style={{ marginTop: '6px', padding: '14px 16px' }}>
          <p className="text-xs font-bold text-slate-700" style={{ marginBottom: '8px' }}>
            Previsão de Alta — IA
          </p>
          <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
            <span className={`text-sm font-bold ${los.alertaAtraso ? 'text-red-600' : 'text-slate-800'}`}>
              {los.losEstimadoDias} {los.losEstimadoDias === 1 ? 'dia' : 'dias'}
            </span>
            <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${CONFIANCA_COR[los.confianca]}`}>
              Confiança {los.confianca}
            </span>
            {los.alertaAtraso && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">⚠ Atraso previsto</span>
            )}
          </div>
          {los.factores.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>Factores</p>
              <ul className="flex flex-col gap-1">
                {los.factores.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <span className="text-slate-400 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-400 italic">{los.disclaimer}</p>
          <button
            onClick={() => { setLos(null); setAberto(false); carregar(); }}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            style={{ marginTop: '8px' }}
          >
            ↺ Reanalisar
          </button>
        </div>
      )}
    </div>
  );
}
