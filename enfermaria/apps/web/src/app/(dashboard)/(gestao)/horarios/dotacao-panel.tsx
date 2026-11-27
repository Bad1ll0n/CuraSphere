'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { DotacaoTurno, ParametrosDotacao, RegistoDotacaoHistorico } from '@org/shared';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

const COR: Record<string, string> = {
  verde: 'bg-green-100 text-green-800', amarelo: 'bg-amber-100 text-amber-800', vermelho: 'bg-red-100 text-red-800', sem_doentes: 'bg-slate-100 text-slate-500',
};
const campo = 'border border-slate-200 rounded-lg text-sm w-20';

/**
 * PROD-17 — dotação segura: horas de cuidados necessárias (dependência dos doentes) contra as
 * disponíveis (enfermeiros escalados), por serviço, no turno em curso; histórico; parâmetros do
 * serviço; e a escala do serviço, com os mínimos e as regras laborais. Sem LLM: cada número tem
 * a origem à vista.
 */
export function DotacaoPanel({ mes, ano, podeEditar }: { mes: number; ano: number; podeEditar: boolean }) {
  const t = useTranslations('staffing');
  const toast = useToast();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState<string | null>(null);
  const [faltas, setFaltas] = useState<{ servico: string; lista: { data: string; tipo: string; motivo: string }[] } | null>(null);
  const resumo = useQuery<DotacaoTurno[]>({ queryKey: ['dotacoes'], queryFn: () => api.get('/dotacoes').then((r) => r.data), staleTime: 60_000 });

  const gerar = useMutation({
    mutationFn: (servico: string) => api.post('/horarios/gerar-automatico', { mes, ano, servico }).then((r) => r.data),
    onSuccess: (r: any, servico) => {
      toast.success(t('rosterGenerated', { n: r.turnosCriados }));
      setFaltas({ servico, lista: r.faltas ?? [] });
      qc.invalidateQueries({ queryKey: ['dotacoes'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('error')),
  });

  return (
    <section aria-label={t('title')} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '16px 24px', marginBottom: '24px' }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{t('title')}</h2>
        <p className="text-xs text-slate-500">{t('hint')}</p>
      </div>
      {resumo.isLoading ? <p className="text-sm text-slate-500" style={{ padding: '12px 0' }}>{t('loading')}</p>
        : resumo.isError ? (
          <p role="alert" className="text-sm text-red-700" style={{ padding: '12px 0' }}>
            {t('loadError')}{' '}<button type="button" className="underline font-semibold" onClick={() => resumo.refetch()}>{t('retry')}</button>
          </p>
        ) : !resumo.data?.length ? <p className="text-sm text-slate-500" style={{ padding: '12px 0' }}>{t('empty')}</p> : (
          <div className="overflow-x-auto" style={{ marginTop: '10px' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th scope="col" className="text-left py-2">{t('col.service')}</th>
                  <th scope="col" className="text-center py-2">{t('col.patients')}</th>
                  <th scope="col" className="text-center py-2">{t('col.categories')}</th>
                  <th scope="col" className="text-center py-2">{t('col.hours')}</th>
                  <th scope="col" className="text-center py-2">{t('col.nurses')}</th>
                  <th scope="col" className="text-center py-2">{t('col.status')}</th>
                  <th scope="col" className="py-2"><span className="sr-only">{t('col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {resumo.data.map((d) => (
                  <tr key={d.servico} className="border-b border-slate-50 align-top">
                    <td className="py-2 font-medium text-slate-800">{d.servico}<span className="block text-xs text-slate-400">{t(`shift.${d.turno}`)} · {d.data}</span></td>
                    <td className="py-2 text-center">{d.doentes}</td>
                    <td className="py-2 text-center text-xs text-slate-600">{t('categoriesValue', d.porCategoria)}</td>
                    <td className="py-2 text-center text-xs">{t('hoursValue', { necessarias: d.horasNecessarias, disponiveis: d.horasDisponiveis })}</td>
                    <td className="py-2 text-center">{t('nursesValue', { escalados: d.enfermeiros, necessarios: d.enfermeirosNecessarios })}</td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-semibold rounded-full ${COR[d.semaforo]}`} style={{ padding: '2px 8px' }}>{t(`status.${d.semaforo}`)}</span>
                      {!d.parametrosPersonalizados && <span className="block text-[11px] text-slate-400">{t('referenceValues')}</span>}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button type="button" className="text-xs text-blue-700 underline" onClick={() => setAberto(aberto === d.servico ? null : d.servico)}>
                        {aberto === d.servico ? t('close') : t('details')}
                      </button>
                      {podeEditar && (
                        <button type="button" disabled={gerar.isPending} onClick={() => gerar.mutate(d.servico)} className="text-xs text-blue-700 underline disabled:opacity-50" style={{ marginLeft: '10px' }}>
                          {t('generateRoster', { mes, ano })}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {faltas && (
        <div role="status" className={`rounded-xl text-sm ${faltas.lista.length ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-green-50 border border-green-200 text-green-800'}`} style={{ padding: '10px 14px', marginTop: '10px' }}>
          {faltas.lista.length ? t('gaps', { servico: faltas.servico, n: faltas.lista.length }) : t('noGaps', { servico: faltas.servico })}
          {faltas.lista.length > 0 && (
            <ul className="text-xs" style={{ marginTop: '4px' }}>
              {faltas.lista.slice(0, 12).map((f) => <li key={`${f.data}-${f.tipo}-${f.motivo}`}>{f.data} · {t(`shift.${f.tipo}`)} — {f.motivo}</li>)}
            </ul>
          )}
        </div>
      )}
      {aberto && <DetalheServico servico={aberto} podeEditar={podeEditar} />}
    </section>
  );
}

function DetalheServico({ servico, podeEditar }: { servico: string; podeEditar: boolean }) {
  const t = useTranslations('staffing');
  const toast = useToast();
  const qc = useQueryClient();
  const historico = useQuery<RegistoDotacaoHistorico[]>({ queryKey: ['dotacoes', servico, 'historico'], queryFn: () => api.get(`/dotacoes/servicos/${encodeURIComponent(servico)}/historico`, { params: { dias: 14 } }).then((r) => r.data) });
  const parametros = useQuery<ParametrosDotacao>({ queryKey: ['dotacoes', servico, 'parametros'], queryFn: () => api.get(`/dotacoes/servicos/${encodeURIComponent(servico)}/parametros`).then((r) => r.data) });
  const [rascunho, setRascunho] = useState<ParametrosDotacao | null>(null);
  const p = rascunho ?? parametros.data ?? null;
  const guardar = useMutation({
    mutationFn: (v: ParametrosDotacao) => {
      const { servico: _s, personalizados: _p, ...corpo } = v;
      return api.put(`/dotacoes/servicos/${encodeURIComponent(servico)}/parametros`, corpo);
    },
    onSuccess: () => { toast.success(t('saved')); setRascunho(null); qc.invalidateQueries({ queryKey: ['dotacoes'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('error')),
  });
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '14px' }}>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('history', { servico })}</h3>
        {historico.isError ? <p role="alert" className="text-sm text-red-700">{t('loadError')}</p>
          : (historico.data ?? []).length === 0 ? <p className="text-sm text-slate-500">{t('noHistory')}</p> : (
            <ul className="text-xs flex flex-col gap-1" style={{ marginTop: '6px' }}>
              {(historico.data ?? []).map((h) => (
                <li key={`${h.data}-${h.turno}`} className="flex justify-between gap-2">
                  <span>{h.data} · {t(`shift.${h.turno}`)}</span>
                  <span>{t('hoursValue', { necessarias: h.horasNecessarias, disponiveis: h.horasDisponiveis })}</span>
                  <span className={`font-semibold rounded-full ${COR[h.semaforo]}`} style={{ padding: '0 6px' }}>{t(`status.${h.semaforo}`)}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      {p && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('parameters')}</h3>
          <fieldset disabled={!podeEditar} className="flex flex-col gap-2 text-sm" style={{ marginTop: '6px' }}>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-600">{t('hoursPerCategory')}</span>
              {(['I', 'II', 'III', 'IV'] as const).map((c) => (
                <label key={c} className="text-xs">{c}{' '}
                  <input type="number" step="0.5" className={campo} value={p.horasPorCategoria[c]} onChange={(e) => setRascunho({ ...p, horasPorCategoria: { ...p.horasPorCategoria, [c]: num(e.target.value) } })} />
                </label>
              ))}
            </div>
            <label className="text-xs">{t('effectiveHours')}{' '}
              <input type="number" step="0.5" className={campo} value={p.horasEfetivasTurno} onChange={(e) => setRascunho({ ...p, horasEfetivasTurno: num(e.target.value) })} />
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-600">{t('minNurses')}</span>
              {(['manha', 'tarde', 'noite'] as const).map((tu) => (
                <label key={tu} className="text-xs">{t(`shift.${tu}`)}{' '}
                  <input type="number" min={0} className={campo} value={p.minimos[tu].enfermeiro} onChange={(e) => setRascunho({ ...p, minimos: { ...p.minimos, [tu]: { ...p.minimos[tu], enfermeiro: num(e.target.value) } } })} />
                </label>
              ))}
            </div>
            <label className="text-xs">{t('weeklyHours')}{' '}
              <input type="number" className={campo} value={p.horasSemanaisMax} onChange={(e) => setRascunho({ ...p, horasSemanaisMax: num(e.target.value) })} />
            </label>
            <label className="text-xs">{t('requiredSkill')}{' '}
              <input className="border border-slate-200 rounded-lg text-sm w-32" value={p.competenciaObrigatoria ?? ''} maxLength={40} onChange={(e) => setRascunho({ ...p, competenciaObrigatoria: e.target.value || null })} />
            </label>
            {podeEditar && (
              <button type="button" disabled={!rascunho || guardar.isPending} onClick={() => rascunho && guardar.mutate(rascunho)}
                className="self-start bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '6px 12px' }}>
                {t('save')}
              </button>
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
}
