'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

interface PlanoAlta {
  id: string;
  doenteId: string;
  dataAlvoDia: string | null;
  afebrилApenas24h: boolean;
  mobilidadeAdequada: boolean;
  alimentacaoOral: boolean;
  doresControladas: boolean;
  familiaInformada: boolean;
  transporteAssegurado: boolean;
  medicacaoPreparada: boolean;
  consultaSegAlt: boolean;
  notas: string | null;
}

interface SumarioAlta {
  riscReadmissao: string | null;
  fatoresReadmissao: string | null;
  recomendacoesAlta: string | null;
  cartaAlta: string | null;
}

const CRITERIOS: { campo: keyof PlanoAlta; label: string }[] = [
  { campo: 'afebrилApenas24h',     label: 'Afebril >24h' },
  { campo: 'mobilidadeAdequada',   label: 'Mobilidade adequada' },
  { campo: 'alimentacaoOral',      label: 'Alimentação oral' },
  { campo: 'doresControladas',     label: 'Dores controladas' },
  { campo: 'familiaInformada',     label: 'Família informada' },
  { campo: 'transporteAssegurado', label: 'Transporte assegurado' },
  { campo: 'medicacaoPreparada',   label: 'Medicação preparada' },
  { campo: 'consultaSegAlt',       label: 'Consulta seguimento' },
];

const RISCO_CONFIG = {
  baixo: { label: 'Baixo', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-700' },
  medio: { label: 'Médio', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  alto: { label: 'Alto', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
};

export function PlanoAltaPanel({ doenteId, utilizador }: { doenteId: string; utilizador: any }) {
  const [plano, setPlano] = useState<PlanoAlta | null>(null);
  const [sumario, setSumario] = useState<SumarioAlta | null>(null);
  const [aberto, setAberto] = useState(false);
  const [dataAlvo, setDataAlvo] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [calculandoRisco, setCalculandoRisco] = useState(false);
  const [gerandoCarta, setGerandoCarta] = useState(false);
  const [cartaAberta, setCartaAberta] = useState(false);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const toast = useToast();

  const podeEditar = ['medico', 'enfermeiro', 'chefe_turno', 'chefe_enfermeiros'].includes(utilizador?.role ?? '');

  const carregar = () => {
    api.get(`/plano-alta/${doenteId}`).then(r => {
      setPlano(r.data);
      setDataAlvo(r.data?.dataAlvoDia ? r.data.dataAlvoDia.split('T')[0] : '');
      setNotas(r.data?.notas ?? '');
    }).catch(() => {});
    api.get(`/doentes/${doenteId}/sumario-alta`).then(r => {
      if (r.data) setSumario(r.data);
    }).catch(() => {});
    api.get(`/doentes/${doenteId}/followups`).then(r => setFollowUps(r.data ?? [])).catch(() => {});
  };

  useEffect(() => { carregar(); }, [doenteId]);

  const calcularRisco = async () => {
    setCalculandoRisco(true);
    try {
      await api.post(`/ai-clinico/${doenteId}/readmissao`);
      await api.get(`/doentes/${doenteId}/sumario-alta`).then(r => { if (r.data) setSumario(r.data); });
      toast.success('Risco de readmissão calculado');
    } catch {
      toast.error('Erro ao calcular risco');
    } finally {
      setCalculandoRisco(false);
    }
  };

  const gerarCarta = async () => {
    setGerandoCarta(true);
    try {
      await api.post(`/ai-clinico/${doenteId}/carta-alta`);
      await api.get(`/doentes/${doenteId}/sumario-alta`).then(r => { if (r.data) setSumario(r.data); });
      setCartaAberta(true);
      toast.success('Carta de alta gerada');
    } catch {
      toast.error('Erro ao gerar carta');
    } finally {
      setGerandoCarta(false);
    }
  };

  const toggler = async (campo: string, valor: boolean) => {
    if (!podeEditar) return;
    try {
      await api.patch(`/plano-alta/${doenteId}`, { [campo]: valor });
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    }
  };

  const guardar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/plano-alta/${doenteId}`, {
        dataAlvoDia: dataAlvo || undefined,
        notas: notas || undefined,
      });
      toast.success('Plano de alta guardado');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro');
    } finally { setSalvando(false); }
  };

  if (!plano) return null;

  const cumpridos = CRITERIOS.filter(c => plano[c.campo] === true).length;
  const progresso = Math.round((cumpridos / CRITERIOS.length) * 100);

  const atrasado = plano.dataAlvoDia && new Date(plano.dataAlvoDia) < new Date() && progresso < 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between"
        style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <span className="text-base">🏠</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">Plano de Alta</span>
              {atrasado && (
                <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg" style={{ padding: '2px 8px' }}>
                  Data alvo ultrapassada
                </span>
              )}
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: '4px' }}>
              <div className="w-28 bg-slate-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <span className="text-xs text-slate-500">{cumpridos}/{CRITERIOS.length} critérios</span>
            </div>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div style={{ padding: '0 24px 24px' }}>
          <div className="grid grid-cols-2 gap-2" style={{ marginBottom: '16px' }}>
            {CRITERIOS.map(({ campo, label }) => {
              const feito = plano[campo] as boolean;
              return (
                <button
                  key={campo}
                  onClick={() => toggler(campo as string, !feito)}
                  disabled={!podeEditar}
                  className={`flex items-center gap-2 rounded-xl border transition-all text-left ${
                    feito ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200 hover:border-blue-200'
                  } ${podeEditar ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{ padding: '10px 12px' }}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${feito ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {feito ? '✓' : ''}
                  </span>
                  <span className={`text-sm font-medium ${feito ? 'text-green-800' : 'text-slate-600'}`}>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3" style={{ marginBottom: '12px' }}>
            <div className="flex-1">
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>
                Data Alvo de Alta
              </span>
              <input
                type="date"
                value={dataAlvo}
                onChange={e => setDataAlvo(e.target.value)}
                disabled={!podeEditar}
                className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
                style={{ padding: '8px 12px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="fplanoalt-0" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Notas</label>
            <textarea id="fplanoalt-0"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              disabled={!podeEditar}
              rows={2}
              className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 resize-none"
              style={{ padding: '8px 12px' }}
            />
          </div>

          {podeEditar && (
            <button onClick={guardar} disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ padding: '9px 20px' }}>
              {salvando ? 'A guardar...' : 'Guardar'}
            </button>
          )}

          {/* Readmission risk section */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Risco de Readmissão 30 dias</span>
              {['medico', 'chefe_enfermeiros', 'chefe_turno'].includes(utilizador?.role ?? '') && (
                <button
                  onClick={calcularRisco}
                  disabled={calculandoRisco}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50 flex items-center gap-1"
                >
                  {calculandoRisco ? (
                    <>
                      <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      A calcular...
                    </>
                  ) : '🧠 Calcular IA'}
                </button>
              )}
            </div>

            {sumario?.riscReadmissao ? (() => {
              const cfg = RISCO_CONFIG[sumario.riscReadmissao as keyof typeof RISCO_CONFIG] ?? RISCO_CONFIG.medio;
              const fatores: string[] = (() => { try { return JSON.parse(sumario.fatoresReadmissao ?? '[]'); } catch { return []; } })();
              const recomendacoes: string[] = (() => { try { return JSON.parse(sumario.recomendacoesAlta ?? '[]'); } catch { return []; } })();
              return (
                <div className={`rounded-xl border ${cfg.bg} ${cfg.border}`} style={{ padding: '12px 14px' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                    <span className={`text-xs font-bold rounded-lg ${cfg.badge}`} style={{ padding: '2px 8px' }}>
                      {cfg.label}
                    </span>
                    <span className={`text-xs font-semibold ${cfg.text}`}>Risco de readmissão</span>
                  </div>
                  {fatores.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <p className="text-xs font-semibold text-slate-500" style={{ marginBottom: '4px' }}>Fatores:</p>
                      <ul className="flex flex-col gap-0.5">
                        {fatores.map((f, i) => (
                          <li key={i} className={`text-xs ${cfg.text}`}>· {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recomendacoes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500" style={{ marginBottom: '4px' }}>Recomendações:</p>
                      <ul className="flex flex-col gap-0.5">
                        {recomendacoes.map((r, i) => (
                          <li key={i} className="text-xs text-slate-600">· {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })() : (
              <p className="text-xs text-slate-400 italic">Não calculado. Clique em "Calcular IA" para avaliar o risco pós-alta.</p>
            )}
          </div>

          {/* Carta de Alta para Médico de Família */}
          <div className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '14px 16px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: sumario?.cartaAlta ? '10px' : '0' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Carta de Alta (Médico de Família)</span>
                {sumario?.cartaAlta && (
                  <button onClick={() => setCartaAberta(v => !v)} className="text-xs text-slate-400 hover:text-slate-600">
                    {cartaAberta ? '▲ Ocultar' : '▼ Ver'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {sumario?.cartaAlta && (
                  <button onClick={() => window.print()} className="text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg" style={{ padding: '3px 10px' }}>
                    Imprimir
                  </button>
                )}
                {sumario?.cartaAlta && ['medico', 'chefe_enfermeiros', 'direcao'].includes(utilizador?.role ?? '') && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/v1/doentes/${doenteId}/carta-alta/pdf`}
                    download
                    className="text-xs font-semibold text-green-600 hover:text-green-800 border border-green-200 rounded-lg"
                    style={{ padding: '3px 10px' }}>
                    📄 PDF
                  </a>
                )}
                {['medico', 'enfermeiro', 'chefe_enfermeiros', 'direcao'].includes(utilizador?.role ?? '') && (
                  <button onClick={gerarCarta} disabled={gerandoCarta}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50 flex items-center gap-1">
                    {gerandoCarta ? (
                      <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> A gerar...</>
                    ) : sumario?.cartaAlta ? '🧠 Regenerar' : '🧠 Gerar carta IA'}
                  </button>
                )}
              </div>
            </div>
            {sumario?.cartaAlta && cartaAberta && (
              <div className="rounded-lg bg-white border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono" style={{ padding: '14px', maxHeight: '400px', overflowY: 'auto' }}>
                {sumario.cartaAlta}
              </div>
            )}
            {!sumario?.cartaAlta && (
              <p className="text-xs text-slate-400 italic" style={{ marginTop: '6px' }}>Não gerada. Clique em "Gerar carta IA" para criar automaticamente.</p>
            )}
          </div>
        </div>
      )}

      {/* Follow-ups Pós-Alta */}
      {followUps.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50" style={{ padding: '16px', marginTop: '12px' }}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '10px' }}>Follow-ups Pós-Alta</p>
          <div className="flex flex-col gap-2">
            {followUps.map((fu: any) => (
              <div key={fu.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${fu.concluido ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                <div>
                  <p className={`text-xs font-semibold ${fu.concluido ? 'text-green-700' : 'text-slate-700'}`}>
                    {fu.tipo === '7_dias' ? '7 dias pós-alta' : fu.tipo === '30_dias' ? '30 dias pós-alta' : fu.especialidade ?? fu.tipo}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(fu.dataAgendada).toLocaleDateString('pt-PT')} · {fu.responsavel?.nome ?? '—'}
                  </p>
                </div>
                {fu.concluido ? (
                  <span className="text-xs text-green-600 font-medium">✓ Concluído</span>
                ) : (
                  podeEditar && (
                    <button
                      onClick={async () => {
                        try {
                          await api.patch(`/doentes/followup/${fu.id}/concluir`);
                          setFollowUps(prev => prev.map(f => f.id === fu.id ? { ...f, concluido: true } : f));
                          toast.success('Follow-up marcado como concluído');
                        } catch { toast.error('Erro ao concluir follow-up'); }
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg"
                      style={{ padding: '3px 8px' }}
                    >
                      Concluir
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
