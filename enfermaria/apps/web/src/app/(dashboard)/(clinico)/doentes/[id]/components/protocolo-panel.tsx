'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { AiFeedback } from '@/components/ai-feedback';

interface Protocolo {
  nome: string;
  estado: 'ok' | 'pendente' | 'violado';
  detalhe: string;
}

interface ProtocoloResult {
  protocolos: Protocolo[];
  observacoesAI: string;
  disclaimer: string;
}

const estadoBadge: Record<string, string> = {
  ok: 'bg-green-100 text-green-700 border-green-200',
  pendente: 'bg-amber-100 text-amber-700 border-amber-200',
  violado: 'bg-red-100 text-red-700 border-red-200',
};
const estadoIcon: Record<string, string> = { ok: '✓', pendente: '⏱', violado: '✗' };

export function ProtocoloPanel({ doenteId, utilizador }: { doenteId: string; utilizador: any }) {
  const [resultado, setResultado] = useState<ProtocoloResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ultimaVerificacao, setUltimaVerificacao] = useState<Date | null>(null);
  const [mostrarFactores, setMostrarFactores] = useState(false);

  const podeVer = ['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  const verificar = useCallback(async () => {
    if (!podeVer) return;
    setLoading(true);
    try {
      const r = await api.get(`/ai-clinico/${doenteId}/protocolo`);
      setResultado(r.data);
      setUltimaVerificacao(new Date());
      setAberto(true);
    } catch { /* vazio */ }
    finally { setLoading(false); }
  }, [doenteId, podeVer]);

  if (!podeVer) return null;

  const nViolados = resultado?.protocolos.filter(p => p.estado === 'violado').length ?? 0;
  const nPendentes = resultado?.protocolos.filter(p => p.estado === 'pendente').length ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
      <button
        onClick={() => aberto ? setAberto(false) : (resultado ? setAberto(true) : verificar())}
        className="w-full flex items-center justify-between text-left"
        style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${nViolados > 0 ? 'bg-red-50' : nPendentes > 0 ? 'bg-amber-50' : 'bg-indigo-50'}`}>
            <svg className={`w-4 h-4 ${nViolados > 0 ? 'text-red-500' : nPendentes > 0 ? 'text-amber-500' : 'text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Verificação de Protocolos</span>
            <span className="text-xs text-slate-400 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">IA</span>
            {nViolados > 0 && (
              <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                {nViolados} violado{nViolados !== 1 ? 's' : ''}
              </span>
            )}
            {nPendentes > 0 && nViolados === 0 && (
              <span className="text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                {nPendentes} pendente{nPendentes !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ultimaVerificacao && (
            <span className="text-xs text-slate-300">
              {ultimaVerificacao.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {loading ? (
            <svg className="animate-spin w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {aberto && resultado && (
        <div style={{ padding: '0 24px 24px' }}>

          {/* Lista de protocolos */}
          <div className="flex flex-col gap-3" style={{ marginBottom: '20px' }}>
            {resultado.protocolos.map((p, i) => (
              <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${p.estado === 'violado' ? 'bg-red-50 border-red-200' : p.estado === 'pendente' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                <span className={`text-xs font-bold border rounded-md px-1.5 py-0.5 shrink-0 mt-0.5 ${estadoBadge[p.estado]}`}>
                  {estadoIcon[p.estado]} {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.nome}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{p.detalhe}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Observações AI */}
          {resultado.observacoesAI && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50" style={{ padding: '16px', marginBottom: '12px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Análise IA</span>
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed">{resultado.observacoesAI}</p>
            </div>
          )}

          {/* Factores considerados — explicabilidade */}
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => setMostrarFactores(f => !f)}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors font-medium flex items-center gap-1">
              Ver factores considerados {mostrarFactores ? '▲' : '▼'}
            </button>
            {mostrarFactores && (
              <div className="bg-slate-50 rounded-xl" style={{ padding: '12px', marginTop: '8px' }}>
                <ul className="space-y-1">
                  {['Diagnóstico principal', 'Medicação activa', 'Sinais vitais recentes', 'Alertas clínicos', 'Notas de turno', 'Avaliações de escala'].map((f, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-300 italic">{resultado.disclaimer}</p>
            <div className="flex items-center gap-3">
              <AiFeedback decisaoId={(resultado as any)?._decisaoId} />
              <button
                onClick={verificar}
                disabled={loading}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                style={{ padding: '5px 12px' }}>
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {aberto && !resultado && !loading && (
        <div style={{ padding: '0 24px 24px' }}>
          <div className="text-center py-6">
            <p className="text-sm text-slate-400" style={{ marginBottom: '12px' }}>
              Verificar aderência aos protocolos clínicos activos para este doente.
            </p>
            <button
              onClick={verificar}
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
              style={{ padding: '10px 24px' }}>
              Verificar Protocolos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
