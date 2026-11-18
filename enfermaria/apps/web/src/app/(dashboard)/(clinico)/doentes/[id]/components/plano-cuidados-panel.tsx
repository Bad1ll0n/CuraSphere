'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { DiagnosticoPlano, IntervencaoPlano } from '@org/shared';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { pedirTexto } from '@/components/motivo-remocao';
import { ErroCarregamento } from '@/components/erro-carregamento';
import { useAcaoPlano, useCatalogoCuidados, useConjuntosCuidados, usePlanoCuidados } from '@/lib/hooks';
import { AvaliacaoInicialForm } from './avaliacao-inicial-form';

/**
 * PROD-07 — processo de enfermagem na ficha: avaliação inicial, sugestões a partir das escalas,
 * diagnósticos com intervenções (registos devidos no turno), execução e reavaliação.
 */
export function PlanoCuidadosPanel({ doenteId, podeEditar }: { doenteId: string; podeEditar: boolean }) {
  const t = useTranslations('carePlan');
  const toast = useToast();
  const loc = useLocale() === 'en' ? 'en-GB' : 'pt-PT';
  const hora = (d: string) => new Date(d).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const quando = (d: string) => new Date(d).toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const { data: plano, isLoading, isError, refetch } = usePlanoCuidados(doenteId);
  const [avaliar, setAvaliar] = useState(false);

  const correr = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); } catch (e: any) { toast.error(e?.response?.data?.message ?? t('error')); }
  };
  const acao = useAcaoPlano(doenteId, (f: () => Promise<unknown>) => f());
  const fazer = (f: () => Promise<unknown>, ok?: string) => correr(() => acao.mutateAsync(f), ok);

  const aplicarConjunto = (conjuntoId: string) => fazer(async () => {
    const r = await api.post(`/processo-enfermagem/doente/${doenteId}/conjuntos/${conjuntoId}`, {});
    toast.success(t('add.applied', { criados: r.data.criados.join(', ') || '—' }));
    if (r.data.ignorados.length) toast.info(t('add.alreadyActive', { ignorados: r.data.ignorados.join(', ') }));
  });
  const registar = (i: IntervencaoPlano) => fazer(() => api.post(`/processo-enfermagem/intervencoes/${i.id}/execucoes`, {}), t('interventions.recorded'));
  const naoRealizada = async (i: IntervencaoPlano) => {
    const motivo = await pedirTexto({ titulo: t('prompts.notDoneTitle'), descricao: i.termo, rotulo: t('prompts.notDoneLabel'), botao: t('prompts.confirm'), placeholder: t('prompts.notDonePlaceholder') });
    if (motivo) await fazer(() => api.post(`/processo-enfermagem/intervencoes/${i.id}/execucoes`, { realizada: false, motivoNaoRealizada: motivo }), t('interventions.recorded'));
  };
  const reavaliar = async (d: DiagnosticoPlano, evolucao: string) => {
    const nota = await pedirTexto({ titulo: t('prompts.reviewTitle'), descricao: `${d.termo} — ${t(`evolution.${evolucao}`)}`, rotulo: t('prompts.reviewLabel'), botao: t('prompts.confirm') });
    if (nota) await fazer(() => api.post(`/processo-enfermagem/diagnosticos/${d.id}/avaliacoes`, { evolucao, nota }));
  };
  const cancelar = async (d: DiagnosticoPlano) => {
    const motivo = await pedirTexto({ titulo: t('prompts.cancelTitle'), descricao: d.termo, rotulo: t('prompts.cancelLabel'), botao: t('prompts.confirm') });
    if (motivo) await fazer(() => api.patch(`/processo-enfermagem/diagnosticos/${d.id}/encerrar`, { estado: 'cancelado', motivo }));
  };

  if (isLoading) return <p role="status" className="text-sm text-slate-500" style={{ padding: '16px' }}>{t('loading')}</p>;
  if (isError || !plano) {
    return <ErroCarregamento titulo={t('loadErrorTitle')} descricao={t('loadErrorBody')} onTentarNovamente={() => refetch()} />;
  }

  const ai = plano.avaliacaoInicial;
  return (
    <section aria-labelledby="titulo-plano-cuidados" className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4" style={{ padding: '20px 24px', marginBottom: '24px' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 id="titulo-plano-cuidados" className="text-base font-bold text-slate-900">{t('title')}</h2>
        <span className={`text-xs font-semibold rounded-full ${plano.resumo.emAtraso ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`} style={{ padding: '4px 10px' }}>
          {t('summary', { devidas: plano.resumo.devidas, atraso: plano.resumo.emAtraso })}
        </span>
      </div>
      {!podeEditar && <p className="text-xs text-slate-500">{t('readOnly')}</p>}

      {/* Avaliação inicial */}
      <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg bg-slate-50" style={{ padding: '10px 12px' }}>
        <p className={`text-sm ${ai?.completa ? 'text-slate-700' : 'text-amber-800 font-semibold'}`}>
          {!ai ? t('initial.none') : t(ai.completa ? 'initial.complete' : 'initial.incomplete', { por: ai.por, quando: quando(ai.atualizadaEm) })}
        </p>
        {podeEditar && !avaliar && (
          <button type="button" onClick={() => setAvaliar(true)} className="text-sm font-semibold text-blue-700 hover:underline">
            {ai ? t('initial.edit') : t('initial.do')}
          </button>
        )}
      </div>
      {avaliar && <AvaliacaoInicialForm doenteId={doenteId} onFechar={() => setAvaliar(false)} />}

      {/* Sugestões a partir das escalas */}
      {podeEditar && plano.sugestoes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50" style={{ padding: '10px 12px' }}>
          <p className="text-sm font-semibold text-amber-900">{t('suggestions.title')}</p>
          <p className="text-xs text-amber-800" style={{ marginBottom: '6px' }}>{t('suggestions.hint')}</p>
          <ul className="flex flex-col gap-1.5">
            {plano.sugestoes.map((s) => (
              <li key={s.diagnostico} className="flex items-center justify-between flex-wrap gap-2 text-sm">
                <span><strong>{s.diagnostico}</strong> · {s.juizo} <span className="text-xs text-slate-600">({s.motivo})</span></span>
                <SugestaoAcao sugestao={s} onConjunto={aplicarConjunto}
                  onAdicionar={() => fazer(() => api.post(`/processo-enfermagem/doente/${doenteId}/diagnosticos`, { termo: s.diagnostico, juizo: s.juizo, origem: 'escala', origemRef: s.origemRef }), t('add.created'))} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Diagnósticos ativos */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700" style={{ marginBottom: '8px' }}>{t('diagnoses.title')}</h3>
        {plano.diagnosticos.length === 0 && <p className="text-sm text-slate-500">{t('diagnoses.none')}</p>}
        <ul className="flex flex-col gap-3">
          {plano.diagnosticos.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-200" style={{ padding: '12px 14px' }}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{d.termo}{d.juizo && <span className="font-normal text-slate-600"> · {d.juizo}</span>}</p>
                  <p className="text-xs text-slate-500">{t('diagnoses.by', { por: d.identificadoPor, quando: quando(d.identificadoEm) })}</p>
                  {d.ultimaAvaliacao && <p className="text-xs text-slate-600">{t('diagnoses.lastReview', { evolucao: t(`evolution.${d.ultimaAvaliacao.evolucao}`), quando: quando(d.ultimaAvaliacao.em) })}</p>}
                </div>
                {podeEditar && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <label className="sr-only" htmlFor={`rev-${d.id}`}>{t('diagnoses.review')}</label>
                    <select id={`rev-${d.id}`} defaultValue="" onChange={(e) => { if (e.target.value) void reavaliar(d, e.target.value); e.target.value = ''; }}
                      className="text-xs border border-slate-200 rounded-lg bg-white" style={{ padding: '5px 8px' }}>
                      <option value="">{t('diagnoses.review')}</option>
                      {(['melhorou', 'igual', 'piorou', 'resolvido'] as const).map((v) => <option key={v} value={v}>{t(`evolution.${v}`)}</option>)}
                    </select>
                    <button type="button" onClick={() => cancelar(d)} className="text-xs text-slate-500 hover:text-red-700">{t('diagnoses.cancel')}</button>
                  </div>
                )}
              </div>
              <ul className="flex flex-col gap-2" style={{ marginTop: '10px' }}>
                {d.intervencoes.map((i) => (
                  <li key={i.id} className="flex items-start justify-between flex-wrap gap-2 rounded-lg bg-slate-50" style={{ padding: '8px 10px' }}>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{i.termo} <span className="text-xs text-slate-500">· {/^sos$/i.test(i.frequencia) ? t('interventions.prn') : i.frequencia}</span></p>
                      <div className="flex flex-wrap gap-1" style={{ marginTop: '2px' }}>
                        {i.devidas.filter((x) => x.estado !== 'realizada').map((x) => (
                          <span key={x.hora} className={`text-xs font-semibold rounded ${x.estado === 'em_atraso' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`} style={{ padding: '1px 6px' }}>
                            {x.estado === 'em_atraso' ? t('interventions.late', { hora: hora(x.hora) }) : t('interventions.due', { hora: hora(x.hora) })}
                          </span>
                        ))}
                      </div>
                      {i.ultimaExecucao && (
                        <p className="text-xs text-slate-500">
                          {t(i.ultimaExecucao.realizada ? 'interventions.last' : 'interventions.lastNotDone', { quando: quando(i.ultimaExecucao.em), por: i.ultimaExecucao.por })}
                        </p>
                      )}
                    </div>
                    {podeEditar && (
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => registar(i)} className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" style={{ padding: '6px 10px' }}>{t('interventions.record')}</button>
                        <button type="button" onClick={() => naoRealizada(i)} className="text-xs font-semibold border border-slate-200 text-slate-700 rounded-lg" style={{ padding: '6px 10px' }}>{t('interventions.notDone')}</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {podeEditar && <AdicionarAoPlano doenteId={doenteId} onConjunto={aplicarConjunto} onDiagnostico={(corpo) => fazer(() => api.post(`/processo-enfermagem/doente/${doenteId}/diagnosticos`, corpo), t('add.created'))} />}
    </section>
  );
}

function SugestaoAcao({ sugestao, onConjunto, onAdicionar }: {
  sugestao: { conjunto: string | null }; onConjunto: (id: string) => void; onAdicionar: () => void;
}) {
  const t = useTranslations('carePlan');
  const { data: conjuntos = [] } = useConjuntosCuidados();
  const cj = sugestao.conjunto ? conjuntos.find((c) => c.nome === sugestao.conjunto) : undefined;
  return cj
    ? <button type="button" onClick={() => onConjunto(cj.id)} className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg" style={{ padding: '5px 10px' }}>{t('suggestions.applySet', { conjunto: cj.nome })}</button>
    : <button type="button" onClick={onAdicionar} className="text-xs font-semibold border border-amber-300 text-amber-900 rounded-lg" style={{ padding: '5px 10px' }}>{t('suggestions.add')}</button>;
}

function AdicionarAoPlano({ onConjunto, onDiagnostico }: {
  doenteId: string; onConjunto: (id: string) => void;
  onDiagnostico: (corpo: { termo: string; juizo?: string; intervencoes: { termo: string; frequencia: string }[] }) => Promise<unknown>;
}) {
  const t = useTranslations('carePlan');
  const { data: conjuntos = [] } = useConjuntosCuidados();
  const { data: diagnosticos = [] } = useCatalogoCuidados('diagnostico');
  const { data: intervencoes = [] } = useCatalogoCuidados('intervencao');
  const [conjunto, setConjunto] = useState('');
  const [termo, setTermo] = useState('');
  const [juizo, setJuizo] = useState('');
  const [intervencao, setIntervencao] = useState('');
  const [frequencia, setFrequencia] = useState('');

  const escolherIntervencao = (v: string) => {
    setIntervencao(v);
    const c = intervencoes.find((i) => i.termo === v);
    if (c?.frequenciaSugerida && !frequencia) setFrequencia(c.frequenciaSugerida);
  };
  const submeter = async () => {
    await onDiagnostico({ termo: termo.trim(), juizo: juizo.trim() || undefined, intervencoes: intervencao.trim() ? [{ termo: intervencao.trim(), frequencia: frequencia.trim() }] : [] });
    setTermo(''); setJuizo(''); setIntervencao(''); setFrequencia('');
  };
  const campo = 'border border-slate-200 rounded-lg text-sm bg-white';

  return (
    <div className="rounded-xl border border-dashed border-slate-300 flex flex-col gap-3" style={{ padding: '12px 14px' }}>
      <p className="text-sm font-semibold text-slate-700">{t('add.title')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs text-slate-600 gap-1">{t('add.set')}
          <select value={conjunto} onChange={(e) => setConjunto(e.target.value)} className={campo} style={{ padding: '7px 10px', minWidth: '240px' }}>
            <option value="">{t('add.setPlaceholder')}</option>
            {conjuntos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.descricao ? ` — ${c.descricao}` : ''}</option>)}
          </select>
        </label>
        <button type="button" disabled={!conjunto} onClick={() => { onConjunto(conjunto); setConjunto(''); }}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40" style={{ padding: '8px 12px' }}>{t('add.applySet')}</button>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <label className="flex flex-col text-xs text-slate-600 gap-1">{t('add.diagnosis')}
          <input list="pc-diagnosticos" value={termo} onChange={(e) => setTermo(e.target.value)} maxLength={200} className={campo} style={{ padding: '7px 10px' }} />
        </label>
        <label className="flex flex-col text-xs text-slate-600 gap-1">{t('add.judgement')}
          <input value={juizo} onChange={(e) => setJuizo(e.target.value)} maxLength={60} className={campo} style={{ padding: '7px 10px' }} />
        </label>
        <label className="flex flex-col text-xs text-slate-600 gap-1">{t('add.intervention')}
          <input list="pc-intervencoes" value={intervencao} onChange={(e) => escolherIntervencao(e.target.value)} maxLength={200} className={campo} style={{ padding: '7px 10px' }} />
        </label>
        <label className="flex flex-col text-xs text-slate-600 gap-1">{t('add.frequency')}
          <input value={frequencia} onChange={(e) => setFrequencia(e.target.value)} maxLength={40} className={campo} style={{ padding: '7px 10px' }} />
        </label>
      </div>
      <datalist id="pc-diagnosticos">{diagnosticos.map((d) => <option key={d.id} value={d.termo} />)}</datalist>
      <datalist id="pc-intervencoes">{intervencoes.map((i) => <option key={i.id} value={i.termo} />)}</datalist>
      <button type="button" onClick={submeter} disabled={!termo.trim() || (!!intervencao.trim() && !frequencia.trim())}
        className="self-start text-sm font-semibold border border-blue-300 text-blue-800 rounded-lg disabled:opacity-40" style={{ padding: '8px 12px' }}>{t('add.submit')}</button>
    </div>
  );
}
