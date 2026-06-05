'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { HelpTooltip } from '@/components/help-tooltip';
import { AiFeedback } from '@/components/ai-feedback';
import { AiConsentModal } from '@/components/ai-consent-modal';
import { hasAiConsent } from '@/lib/ai-consent';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface RespostaMedico {
  observacoes?: string[];
  padroesDetectados?: string[];
  investigacoesAConsiderar?: string[];
  disclaimer?: string;
}

interface RespostaEnfermeiro {
  observacoes?: string[];
  disclaimer?: string;
}

const ROLES_COM_ACESSO = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno'];

const FACTORES_ANALISADOS = [
  'Diagnóstico principal e comorbilidades',
  'Sinais vitais (últimas 3 medições)',
  'Medicação activa e prescrições',
  'Tarefas pendentes e alertas clínicos',
  'Notas de turno recentes',
  'Avaliações de escala (Braden, Morse)',
];

export function AiClinicoPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resposta, setResposta] = useState<RespostaMedico & RespostaEnfermeiro | null>(null);
  const [mostrarConsent, setMostrarConsent] = useState(false);
  const [mostrarFactores, setMostrarFactores] = useState(false);

  if (!utilizador || !ROLES_COM_ACESSO.includes(utilizador.role)) return null;

  const isMedico = utilizador.role === 'medico';

  const analisar = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/ai-clinico/${doenteId}`);
      setResposta(r.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao analisar dados clínicos');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrir = () => {
    if (!aberto) {
      if (!hasAiConsent()) {
        setMostrarConsent(true);
        return;
      }
      if (!resposta) analisar();
    }
    setAberto(a => !a);
  };

  const handleConsentAceitar = () => {
    setMostrarConsent(false);
    setAberto(true);
    analisar();
  };

  return (
    <>
      {mostrarConsent && (
        <AiConsentModal
          onAceitar={handleConsentAceitar}
          onRecusar={() => setMostrarConsent(false)}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
        <button
          onClick={handleAbrir}
          className="w-full flex items-center justify-between text-left hover:bg-slate-50/50 rounded-2xl transition-colors"
          style={{ padding: '16px 24px' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-700">Análise de Apoio Clínico (IA)</span>
            <HelpTooltip chave="ai_clinico" />
            <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-md font-medium" style={{ padding: '2px 8px' }}>
              {isMedico ? 'Médico' : 'Enfermagem'}
            </span>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {aberto && (
          <div style={{ padding: '0 24px 20px' }}>
            {/* Disclaimer sempre visível */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium flex items-start gap-2" style={{ padding: '10px 14px', marginBottom: '16px' }}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Apoio à decisão clínica apenas. Não substitui avaliação, diagnóstico ou tratamento médico. Valide sempre com julgamento clínico.
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 text-slate-400" style={{ padding: '24px' }}>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-500">A analisar dados clínicos...</span>
              </div>
            ) : resposta ? (
              <div className="space-y-4">
                {/* Observações — visíveis a todos os roles */}
                {(resposta.observacoes ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Observações</p>
                    <ul className="space-y-2">
                      {resposta.observacoes!.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Padrões detectados — só médico */}
                {isMedico && (resposta.padroesDetectados ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Padrões Detectados</p>
                    <ul className="space-y-2">
                      {resposta.padroesDetectados!.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-violet-400 shrink-0 mt-0.5">◆</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Investigações a considerar — só médico */}
                {isMedico && (resposta.investigacoesAConsiderar ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Investigações a Considerar</p>
                    <ul className="space-y-2">
                      {resposta.investigacoesAConsiderar!.map((inv, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-blue-400 shrink-0 mt-0.5">→</span>
                          {inv}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Factores considerados — explicabilidade */}
                <div>
                  <button
                    onClick={() => setMostrarFactores(f => !f)}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors font-medium flex items-center gap-1">
                    Ver factores considerados {mostrarFactores ? '▲' : '▼'}
                  </button>
                  {mostrarFactores && (
                    <div className="bg-slate-50 rounded-xl" style={{ padding: '12px', marginTop: '8px' }}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '8px' }}>Dados incluídos na análise</p>
                      <ul className="space-y-1">
                        {FACTORES_ANALISADOS.map((f, i) => (
                          <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between" style={{ marginTop: '4px' }}>
                  <button
                    onClick={() => { setResposta(null); analisar(); }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
                    ↺ Reanalisar
                  </button>
                  <AiFeedback decisaoId={(resposta as any)?._decisaoId} />
                </div>
              </div>
            ) : (
              <div className="text-center" style={{ padding: '16px' }}>
                <button onClick={analisar}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  style={{ padding: '10px 24px' }}>
                  Analisar com IA
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
