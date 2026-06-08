'use client';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { HelpTooltip } from '@/components/help-tooltip';
import { AiFeedback } from '@/components/ai-feedback';
import { AiConsentModal } from '@/components/ai-consent-modal';
import { hasAiConsent } from '@/lib/ai-consent';
import api from '@/lib/api';

interface Props {
  doenteId: string;
  utilizador: { id: string; role: string; nome: string } | null;
}

interface RespostaMedico {
  observacoes?: string[];
  padroesDetectados?: string[];
  investigacoesAConsiderar?: string[];
  disclaimer?: string;
  _decisaoId?: string;
}

interface RespostaEnfermeiro {
  observacoes?: string[];
  disclaimer?: string;
  _decisaoId?: string;
}

type Resposta = RespostaMedico & RespostaEnfermeiro;

const ROLES_COM_ACESSO = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno'];

const FACTORES_ANALISADOS = [
  'Diagnóstico principal e comorbilidades',
  'Sinais vitais (últimas 3 medições)',
  'Medicação activa e prescrições',
  'Tarefas pendentes e alertas clínicos',
  'Notas de turno recentes',
  'Avaliações de escala (Braden, Morse)',
];

interface DiagDD {
  diagnostico: string;
  probabilidade: 'Alta' | 'Média' | 'Baixa';
  justificacao: string;
  proximos_passos: string;
}

export function AiClinicoPanel({ doenteId, utilizador }: Props) {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [textoStream, setTextoStream] = useState('');
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [mostrarConsent, setMostrarConsent] = useState(false);
  const [mostrarFactores, setMostrarFactores] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const textoAcumuladoRef = useRef('');

  // Diagnóstico diferencial
  const [showDD, setShowDD] = useState(false);
  const [sintomasDD, setSintomasDD] = useState('');
  const [diagnosticosDD, setDiagnosticosDD] = useState<DiagDD[]>([]);
  const [loadingDD, setLoadingDD] = useState(false);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  if (!utilizador || !ROLES_COM_ACESSO.includes(utilizador.role)) return null;

  const isMedico = utilizador.role === 'medico';

  const analisar = () => {
    esRef.current?.close();
    textoAcumuladoRef.current = '';
    setTextoStream('');
    setResposta(null);
    setStreaming(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    const es = new EventSource(`${apiUrl}/ai-clinico/${doenteId}/stream`, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.done) {
          es.close();
          esRef.current = null;
          setStreaming(false);
          const texto = textoAcumuladoRef.current.trim();
          // tentativa de parse JSON para obter vista estruturada
          const jsonMatch = texto.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              setResposta(parsed);
              setTextoStream('');
            } catch {
              // mantém texto livre
            }
          }
          return;
        }

        if (data.erro) {
          es.close();
          esRef.current = null;
          setStreaming(false);
          toast.error(data.erro ?? 'Erro ao obter análise de IA');
          return;
        }

        if (data.texto) {
          textoAcumuladoRef.current += data.texto;
          setTextoStream((prev) => prev + data.texto);
        }
      } catch {
        // ignore malformed chunks
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setStreaming(false);
      if (!textoAcumuladoRef.current && !resposta) {
        toast.error('Erro ao obter análise de IA');
      }
    };
  };

  const handleAbrir = () => {
    if (!aberto) {
      if (!hasAiConsent()) {
        setMostrarConsent(true);
        return;
      }
      if (!resposta && !textoStream) analisar();
    }
    setAberto((a) => !a);
  };

  const handleConsentAceitar = () => {
    setMostrarConsent(false);
    setAberto(true);
    analisar();
  };

  const reanalisar = () => {
    setResposta(null);
    setTextoStream('');
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
            {/* Disclaimer */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium flex items-start gap-2" style={{ padding: '10px 14px', marginBottom: '16px' }}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Apoio à decisão clínica apenas. Não substitui avaliação, diagnóstico ou tratamento médico. Valide sempre com julgamento clínico.
            </div>

            {/* Streaming em progresso */}
            {streaming && (
              <div>
                <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium" style={{ marginBottom: '10px' }}>
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  A analisar dados clínicos...
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl" style={{ padding: '14px', minHeight: '60px' }}>
                  {textoStream}
                  <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse align-middle" style={{ marginLeft: '2px' }} />
                </pre>
              </div>
            )}

            {/* Texto livre (streaming terminou sem JSON válido) */}
            {!streaming && textoStream && !resposta && (
              <div>
                <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl" style={{ padding: '14px' }}>
                  {textoStream}
                </pre>
                <div className="flex items-center justify-between" style={{ marginTop: '12px' }}>
                  <button onClick={reanalisar} className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
                    ↺ Reanalisar
                  </button>
                </div>
              </div>
            )}

            {/* Vista estruturada (JSON parseado com sucesso) */}
            {!streaming && resposta && (
              <div className="space-y-4">
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

                <div>
                  <button
                    onClick={() => setMostrarFactores((f) => !f)}
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
                  <button onClick={reanalisar} className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium">
                    ↺ Reanalisar
                  </button>
                  <AiFeedback decisaoId={resposta._decisaoId} />
                </div>
              </div>
            )}

            {/* Estado inicial: sem streaming e sem resposta */}
            {!streaming && !textoStream && !resposta && (
              <div className="text-center" style={{ padding: '16px' }}>
                <button
                  onClick={analisar}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  style={{ padding: '10px 24px' }}>
                  Analisar com IA
                </button>
              </div>
            )}

            {/* Diagnóstico Diferencial — só médicos */}
            {isMedico && (
              <div className="border-t border-slate-100" style={{ marginTop: '16px', paddingTop: '16px' }}>
                <button
                  onClick={() => setShowDD(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Diagnóstico Diferencial {showDD ? '▲' : '▼'}
                </button>

                {showDD && (
                  <div className="rounded-xl bg-violet-50/60 border border-violet-200" style={{ padding: '14px', marginTop: '10px' }}>
                    <textarea
                      value={sintomasDD}
                      onChange={e => setSintomasDD(e.target.value)}
                      placeholder="Descreva sintomas / queixa actual..."
                      rows={2}
                      className="w-full text-sm border border-violet-200 rounded-lg bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                      style={{ padding: '8px 12px' }}
                    />
                    <button
                      onClick={async () => {
                        if (!sintomasDD.trim()) return;
                        setLoadingDD(true);
                        try {
                          const r = await api.post(`/ai-clinico/${doenteId}/diagnostico-diferencial`, { sintomas: sintomasDD });
                          setDiagnosticosDD(r.data ?? []);
                        } catch {
                          toast.error('Erro ao gerar diagnóstico diferencial');
                        } finally {
                          setLoadingDD(false);
                        }
                      }}
                      disabled={loadingDD || !sintomasDD.trim()}
                      className="text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      style={{ padding: '6px 16px', marginTop: '8px' }}>
                      {loadingDD ? 'A analisar...' : 'Gerar DD'}
                    </button>

                    {diagnosticosDD.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        {diagnosticosDD.map((d, i) => (
                          <div key={i} className="bg-white rounded-xl border border-violet-100" style={{ padding: '10px 14px', marginBottom: '8px' }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                              <span className="text-sm font-semibold text-slate-900">{i + 1}. {d.diagnostico}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                d.probabilidade === 'Alta' ? 'bg-red-100 text-red-700 border-red-200' :
                                d.probabilidade === 'Média' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                'bg-green-100 text-green-700 border-green-200'
                              }`}>{d.probabilidade}</span>
                            </div>
                            <p className="text-xs text-slate-600">{d.justificacao}</p>
                            <p className="text-xs text-slate-500 font-medium" style={{ marginTop: '4px' }}>→ {d.proximos_passos}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
