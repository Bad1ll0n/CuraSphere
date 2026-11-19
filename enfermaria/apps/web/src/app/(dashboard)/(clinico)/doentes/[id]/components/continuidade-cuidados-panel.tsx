'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ReferenciacaoContinuidade } from '@org/shared';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { pedirTexto } from '@/components/motivo-remocao';
import { useAcaoPlaneamento, useCatalogoPlaneamentoAlta, usePlaneamentoAlta } from '@/lib/hooks/use-planeamento-alta';

/** Espelho das transições da API (planeamento-alta.regras.ts) — só para mostrar os botões certos. */
const PROXIMOS: Record<ReferenciacaoContinuidade['estado'], ReferenciacaoContinuidade['estado'][]> = {
  proposta: ['enviada', 'cancelada'],
  enviada: ['aceite', 'recusada', 'cancelada'],
  aceite: ['vaga_atribuida', 'cancelada'],
  vaga_atribuida: ['cancelada'],
  recusada: [],
  cancelada: [],
};
const COR_ESTADO: Record<string, string> = {
  proposta: 'bg-slate-100 text-slate-700', enviada: 'bg-blue-100 text-blue-800', aceite: 'bg-indigo-100 text-indigo-800',
  vaga_atribuida: 'bg-green-100 text-green-800', recusada: 'bg-red-100 text-red-800', cancelada: 'bg-slate-100 text-slate-500',
};
const COR_COMPREENSAO: Record<string, string> = {
  compreendeu: 'bg-green-100 text-green-800', parcial: 'bg-amber-100 text-amber-800', nao_compreendeu: 'bg-red-100 text-red-800',
};
const EQUIPA = ['medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_turno'];
const ENFERMAGEM = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno'];
const campo = 'w-full border border-slate-200 rounded-lg text-sm';
const quando = (d: string) => new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * PROD-13 — continuidade de cuidados: sinalização precoce, alta clínica (e os dias de alta
 * protelada), referenciação para a RNCCI/CSP com estado, e ensinos com teach-back.
 */
export function ContinuidadeCuidadosPanel({ doenteId, role }: { doenteId: string; role?: string }) {
  const t = useTranslations('continuity');
  const toast = useToast();
  const { data: r, isLoading, isError, refetch } = usePlaneamentoAlta(doenteId);
  const { data: catalogo } = useCatalogoPlaneamentoAlta();
  const acao = useAcaoPlaneamento(doenteId, (f: () => Promise<unknown>) => f());
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ensino, setEnsino] = useState({ tema: '', titulo: '', destinatario: 'doente', cuidadorNome: '', compreensao: 'compreendeu', nota: '' });

  const fazer = async (f: () => Promise<unknown>, ok: string) => {
    try { await acao.mutateAsync(f); toast.success(ok); return true; } catch (e: any) { toast.error(e?.response?.data?.message ?? t('error')); return false; }
  };

  if (isLoading) return <p className="text-sm text-slate-500" style={{ padding: '12px 0' }}>{t('loading')}</p>;
  if (isError || !r) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 text-sm text-red-700" style={{ padding: '12px 16px' }}>
        {t('loadError')}{' '}<button type="button" className="underline font-semibold" onClick={() => refetch()}>{t('retry')}</button>
      </div>
    );
  }

  const podeEquipa = !!role && EQUIPA.includes(role) && r.internado;
  const podeEnsinar = !!role && ENFERMAGEM.includes(role) && r.internado;
  const nomeDestino = (c: string) => catalogo?.destinos.find((d) => d.codigo === c)?.nome ?? c;
  const temaSel = catalogo?.temasEnsino.find((x) => x.codigo === ensino.tema);

  const mudarEstado = async (ref: ReferenciacaoContinuidade, estado: ReferenciacaoContinuidade['estado']) => {
    let nota: string | null | undefined;
    if (estado === 'recusada' || estado === 'cancelada' || estado === 'vaga_atribuida') {
      nota = await pedirTexto({ titulo: t(`state.${estado}`), descricao: nomeDestino(ref.destino), rotulo: t(estado === 'vaga_atribuida' ? 'prompts.vacancy' : 'prompts.reason'), botao: t('prompts.confirm') });
      if (!nota) return;
    }
    await fazer(() => api.patch(`/planeamento-alta/referenciacoes/${ref.id}`, { estado, ...(nota ? { nota } : {}) }), t('referral.updated'));
  };

  return (
    <section aria-label={t('title')} className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4" style={{ padding: '20px 24px', marginTop: '24px' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t('title')}</h3>
        <div className="flex items-center gap-2">
          {r.altaClinicaEm ? (
            <span className={`text-xs font-semibold rounded-full ${(r.diasAposAltaClinica ?? 0) >= 1 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`} style={{ padding: '3px 10px' }}>
              {t('clinicalDischarge.since', { quando: quando(r.altaClinicaEm), dias: r.diasAposAltaClinica ?? 0 })}
            </span>
          ) : <span className="text-xs text-slate-500">{t('clinicalDischarge.none')}</span>}
          {role === 'medico' && r.internado && (
            <button type="button" className="text-xs font-semibold text-blue-700 underline" disabled={acao.isPending}
              onClick={() => fazer(() => api.put(`/planeamento-alta/doente/${doenteId}/alta-clinica`, { altaClinica: !r.altaClinicaEm }), t('clinicalDischarge.saved'))}>
              {r.altaClinicaEm ? t('clinicalDischarge.undo') : t('clinicalDischarge.mark')}
            </button>
          )}
        </div>
      </div>

      {r.sinalizacao.length > 0 && (
        <ul aria-label={t('flags.title')} className="rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-col gap-1" style={{ padding: '10px 14px' }}>
          {r.sinalizacao.map((s) => <li key={s.motivo}><strong>{t(`flags.${s.motivo}`)}</strong> — {s.detalhe}</li>)}
        </ul>
      )}

      {/* Referenciação */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('referral.title')}</h4>
        {r.referenciacoes.length === 0 ? <p className="text-sm text-slate-500">{t('referral.none')}</p> : (
          <ul className="flex flex-col gap-2">
            {r.referenciacoes.map((ref) => (
              <li key={ref.id} className="rounded-lg border border-slate-100 text-sm" style={{ padding: '8px 12px' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{nomeDestino(ref.destino)}</span>
                  <span className={`text-xs font-semibold rounded-full ${COR_ESTADO[ref.estado]}`} style={{ padding: '2px 8px' }}>{t(`state.${ref.estado}`)}</span>
                </div>
                <p className="text-slate-600">{ref.motivo}</p>
                {ref.nota && <p className="text-xs text-slate-500">{ref.nota}</p>}
                <p className="text-xs text-slate-400">{t('referral.by', { por: ref.criadaPor.nome, quando: quando(ref.criadaEm) })}</p>
                {podeEquipa && PROXIMOS[ref.estado].length > 0 && (
                  <div className="flex gap-2 flex-wrap" style={{ marginTop: '6px' }}>
                    {PROXIMOS[ref.estado].map((e) => (
                      <button key={e} type="button" disabled={acao.isPending} onClick={() => mudarEstado(ref, e)}
                        className="text-xs border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50" style={{ padding: '4px 10px' }}>
                        {t(`action.${e}`)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {podeEquipa && (
          <div className="flex flex-wrap gap-2 items-end">
            <div style={{ minWidth: '240px', flex: 1 }}>
              <label htmlFor="cc-destino" className="block text-xs font-semibold text-slate-600">{t('referral.destination')}</label>
              <select id="cc-destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={campo} style={{ padding: '6px 8px' }}>
                <option value="">{t('referral.choose')}</option>
                {catalogo?.destinos.map((d) => <option key={d.codigo} value={d.codigo}>{d.nome}</option>)}
              </select>
            </div>
            <div style={{ minWidth: '240px', flex: 2 }}>
              <label htmlFor="cc-motivo" className="block text-xs font-semibold text-slate-600">{t('referral.reason')}</label>
              <input id="cc-motivo" value={motivo} maxLength={1000} onChange={(e) => setMotivo(e.target.value)} className={campo} style={{ padding: '6px 8px' }} />
            </div>
            <button type="button" disabled={!destino || motivo.trim().length < 5 || acao.isPending}
              onClick={async () => { if (await fazer(() => api.post(`/planeamento-alta/doente/${doenteId}/referenciacoes`, { destino, motivo }), t('referral.created'))) { setDestino(''); setMotivo(''); } }}
              className="bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '7px 14px' }}>
              {t('referral.submit')}
            </button>
          </div>
        )}
      </div>

      {/* Ensinos */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('teaching.title')}</h4>
        {r.ensinos.length === 0 ? <p className="text-sm text-slate-500">{t('teaching.none')}</p> : (
          <ul className="flex flex-col gap-1">
            {r.ensinos.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 flex-wrap text-sm border-b border-slate-50" style={{ padding: '6px 0' }}>
                <span className="text-slate-800">
                  <strong>{e.titulo}</strong> · {t(`teaching.to.${e.destinatario}`)}{e.cuidadorNome ? ` (${e.cuidadorNome})` : ''}
                  {e.nota && <span className="text-slate-500"> — {e.nota}</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <span className={`font-semibold rounded-full ${COR_COMPREENSAO[e.compreensao]}`} style={{ padding: '2px 8px' }}>{t(`teaching.understood.${e.compreensao}`)}</span>
                  {e.realizadoPor.nome} · {quando(e.realizadoEm)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {podeEnsinar && (
          <div className="rounded-xl bg-slate-50 grid gap-2" style={{ padding: '10px 12px', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            <div>
              <label htmlFor="en-tema" className="block text-xs font-semibold text-slate-600">{t('teaching.topic')}</label>
              <select id="en-tema" value={ensino.tema} onChange={(e) => setEnsino({ ...ensino, tema: e.target.value })} className={campo} style={{ padding: '6px 8px' }}>
                <option value="">{t('teaching.choose')}</option>
                {catalogo?.temasEnsino.map((x) => <option key={x.codigo} value={x.codigo}>{x.titulo}</option>)}
                <option value="outro">{t('teaching.other')}</option>
              </select>
            </div>
            {ensino.tema === 'outro' && (
              <div>
                <label htmlFor="en-titulo" className="block text-xs font-semibold text-slate-600">{t('teaching.customTopic')}</label>
                <input id="en-titulo" value={ensino.titulo} maxLength={200} onChange={(e) => setEnsino({ ...ensino, titulo: e.target.value })} className={campo} style={{ padding: '6px 8px' }} />
              </div>
            )}
            <div>
              <label htmlFor="en-dest" className="block text-xs font-semibold text-slate-600">{t('teaching.recipient')}</label>
              <select id="en-dest" value={ensino.destinatario} onChange={(e) => setEnsino({ ...ensino, destinatario: e.target.value })} className={campo} style={{ padding: '6px 8px' }}>
                {['doente', 'cuidador', 'ambos'].map((d) => <option key={d} value={d}>{t(`teaching.to.${d}`)}</option>)}
              </select>
            </div>
            {ensino.destinatario !== 'doente' && (
              <div>
                <label htmlFor="en-cuidador" className="block text-xs font-semibold text-slate-600">{t('teaching.caregiver')}</label>
                <input id="en-cuidador" value={ensino.cuidadorNome} maxLength={200} onChange={(e) => setEnsino({ ...ensino, cuidadorNome: e.target.value })} className={campo} style={{ padding: '6px 8px' }} />
              </div>
            )}
            <div>
              <label htmlFor="en-comp" className="block text-xs font-semibold text-slate-600">{t('teaching.teachBack')}</label>
              <select id="en-comp" value={ensino.compreensao} onChange={(e) => setEnsino({ ...ensino, compreensao: e.target.value })} className={campo} style={{ padding: '6px 8px' }}>
                {['compreendeu', 'parcial', 'nao_compreendeu'].map((c) => <option key={c} value={c}>{t(`teaching.understood.${c}`)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="en-nota" className="block text-xs font-semibold text-slate-600">{t('teaching.note')}</label>
              <input id="en-nota" value={ensino.nota} maxLength={1000} onChange={(e) => setEnsino({ ...ensino, nota: e.target.value })} className={campo} style={{ padding: '6px 8px' }} />
            </div>
            {temaSel && (
              <ul className="text-xs text-slate-600 list-disc" style={{ gridColumn: '1 / -1', paddingLeft: '18px' }}>
                {temaSel.pontos.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="button" disabled={!ensino.tema || acao.isPending}
                onClick={async () => {
                  const { titulo, cuidadorNome, nota, ...resto } = ensino;
                  const corpo = { ...resto, ...(titulo ? { titulo } : {}), ...(cuidadorNome ? { cuidadorNome } : {}), ...(nota ? { nota } : {}) };
                  if (await fazer(() => api.post(`/planeamento-alta/doente/${doenteId}/ensinos`, corpo), t('teaching.saved'))) {
                    setEnsino({ tema: '', titulo: '', destinatario: 'doente', cuidadorNome: '', compreensao: 'compreendeu', nota: '' });
                  }
                }}
                className="bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '7px 14px' }}>
                {t('teaching.submit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
