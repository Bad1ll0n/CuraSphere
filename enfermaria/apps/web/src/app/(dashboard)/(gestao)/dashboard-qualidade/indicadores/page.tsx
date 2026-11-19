'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { IndicadorEnfermagem, ResultadoIndicadores } from '@org/shared';
import api from '@/lib/api';
import { useToast } from '@/components/toast';

const hoje = () => new Date().toISOString().slice(0, 10);
const menos = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
const campo = 'border border-slate-200 rounded-lg text-sm';

function descarregar(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

/**
 * PROD-18 — indicadores sensíveis aos cuidados de enfermagem: valor, numerador e denominador
 * com a definição versionada à vista, drill-down até ao doente, exportação CSV, e a exportação
 * anónima dos incidentes para o NOTIFICA (classificação ICPS).
 */
export default function IndicadoresPage() {
  const t = useTranslations('indicators');
  const toast = useToast();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState({ inicio: menos(30), fim: hoje(), servico: '' });
  const [aplicado, setAplicado] = useState(filtro);
  const [aberto, setAberto] = useState<string | null>(null);
  const params = { inicio: aplicado.inicio, fim: aplicado.fim, ...(aplicado.servico ? { servico: aplicado.servico } : {}) };

  const resumo = useQuery<ResultadoIndicadores>({
    queryKey: ['indicadores', params],
    queryFn: () => api.get('/indicadores', { params }).then((r) => r.data),
  });
  const detalhe = useQuery<ResultadoIndicadores>({
    queryKey: ['indicadores', params, aberto],
    queryFn: () => api.get('/indicadores', { params: { ...params, codigo: aberto } }).then((r) => r.data),
    enabled: !!aberto,
  });

  const formatar = (i: IndicadorEnfermagem) => i.valor == null ? '—'
    : i.unidade === 'percentagem' ? `${i.valor.toLocaleString('pt-PT')} %`
      : i.unidade === 'minutos' ? t('minutes', { n: i.valor }) : i.valor.toLocaleString('pt-PT');

  const exportarCsv = async (codigo?: string) => {
    try {
      const csv = await qc.fetchQuery({
        queryKey: ['indicadores', 'csv', params, codigo ?? null],
        queryFn: () => api.get('/indicadores/exportar', { params: { ...params, ...(codigo ? { codigo } : {}) }, responseType: 'blob' }).then((r) => r.data as Blob),
        staleTime: 0,
      });
      descarregar(csv, `indicadores-${codigo ?? 'resumo'}-${aplicado.inicio}-${aplicado.fim}.csv`, 'text/csv');
    } catch { toast.error(t('exportError')); }
  };
  const exportarNotifica = async () => {
    try {
      const r = await api.post('/eventos-adversos/exportar-notifica', {}, { params: { inicio: aplicado.inicio, fim: aplicado.fim, soNovos: true } });
      descarregar(JSON.stringify(r.data, null, 2), `notifica-${aplicado.inicio}-${aplicado.fim}.json`, 'application/json');
      toast.success(t('notificaExported', { n: r.data.total }));
    } catch { toast.error(t('exportError')); }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '16px' }}>
        <Link href="/dashboard-qualidade" className="text-sm text-slate-500 hover:underline">{t('back')}</Link>
        <h1 className="text-xl font-bold text-slate-800">{t('title')}</h1>
      </div>
      <p className="text-sm text-slate-600" style={{ marginBottom: '16px' }}>{t('intro')}</p>

      <form className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-slate-100" style={{ padding: '14px 16px', marginBottom: '16px' }}
        onSubmit={(e) => { e.preventDefault(); setAberto(null); setAplicado(filtro); }}>
        <label className="text-xs text-slate-600 flex flex-col gap-1">{t('from')}
          <input type="date" className={campo} style={{ padding: '6px 8px' }} value={filtro.inicio} onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value })} />
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1">{t('to')}
          <input type="date" className={campo} style={{ padding: '6px 8px' }} value={filtro.fim} onChange={(e) => setFiltro({ ...filtro, fim: e.target.value })} />
        </label>
        <label className="text-xs text-slate-600 flex flex-col gap-1">{t('service')}
          <input className={campo} style={{ padding: '6px 8px' }} value={filtro.servico} maxLength={60} placeholder={t('allServices')} onChange={(e) => setFiltro({ ...filtro, servico: e.target.value })} />
        </label>
        <button type="submit" className="bg-blue-600 text-white text-sm font-semibold rounded-lg" style={{ padding: '7px 14px' }}>{t('apply')}</button>
        <button type="button" onClick={() => exportarCsv()} className="border border-slate-200 text-sm rounded-lg text-slate-700" style={{ padding: '7px 14px' }}>{t('exportCsv')}</button>
        <button type="button" onClick={exportarNotifica} className="border border-slate-200 text-sm rounded-lg text-slate-700" style={{ padding: '7px 14px' }}>{t('exportNotifica')}</button>
      </form>

      {resumo.isLoading ? <p className="text-sm text-slate-500">{t('loading')}</p>
        : resumo.isError ? (
          <p role="alert" className="text-sm text-red-700">
            {t('loadError')}{' '}<button type="button" className="underline font-semibold" onClick={() => resumo.refetch()}>{t('retry')}</button>
          </p>
        ) : !resumo.data?.indicadores.length ? <p className="text-sm text-slate-500">{t('empty')}</p> : (
          <section aria-label={t('title')} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            <p className="text-xs text-slate-500" style={{ padding: '10px 16px' }}>{t('patientDays', { n: resumo.data.diasInternamento })}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th scope="col" className="text-left" style={{ padding: '8px 16px' }}>{t('col.indicator')}</th>
                  <th scope="col" className="text-right" style={{ padding: '8px 16px' }}>{t('col.value')}</th>
                  <th scope="col" className="text-right" style={{ padding: '8px 16px' }}>{t('col.fraction')}</th>
                  <th scope="col" style={{ padding: '8px 16px' }}><span className="sr-only">{t('col.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {resumo.data.indicadores.map((i) => (
                  <tr key={i.codigo} className="border-b border-slate-50 align-top">
                    <td style={{ padding: '10px 16px' }}>
                      <p className="font-medium text-slate-800">{i.nome}</p>
                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer">{t('definition', { versao: i.versao })}</summary>
                        <p><strong>{t('numerator')}</strong> {i.numerador}</p>
                        <p><strong>{t('denominator')}</strong> {i.denominador}</p>
                        <p><strong>{t('exclusions')}</strong> {i.exclusoes}</p>
                      </details>
                    </td>
                    <td className="text-right font-bold text-slate-800" style={{ padding: '10px 16px' }}>{formatar(i)}</td>
                    <td className="text-right text-xs text-slate-500" style={{ padding: '10px 16px' }}>{i.numeradorValor} / {i.denominadorValor}</td>
                    <td className="text-right whitespace-nowrap" style={{ padding: '10px 16px' }}>
                      <button type="button" className="text-xs text-blue-700 underline" onClick={() => setAberto(aberto === i.codigo ? null : i.codigo)}>
                        {aberto === i.codigo ? t('hideCases') : t(i.melhor === 'alto' ? 'showGaps' : 'showCases')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

      {aberto && (
        <section aria-label={t('casesTitle')} className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '14px 16px', marginTop: '16px' }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">{detalhe.data?.indicadores[0]?.nome ?? t('casesTitle')}</h2>
            <button type="button" onClick={() => exportarCsv(aberto)} className="text-xs text-blue-700 underline">{t('exportCsv')}</button>
          </div>
          {detalhe.isLoading ? <p className="text-sm text-slate-500">{t('loading')}</p>
            : detalhe.isError === true ? <p role="alert" className="text-sm text-red-700">{t('loadError')}</p>
              : (detalhe.data?.indicadores[0]?.casos ?? []).length === 0 ? <p className="text-sm text-slate-500">{t('noCases')}</p> : (
                <ul className="text-sm flex flex-col gap-1" style={{ marginTop: '8px' }}>
                  {(detalhe.data?.indicadores[0]?.casos ?? []).map((c, n) => (
                    <li key={`${c.doenteId}-${n}`} className="flex justify-between gap-2 border-b border-slate-50" style={{ padding: '4px 0' }}>
                      <Link href={`/doentes/${c.doenteId}`} className="text-blue-700 hover:underline">{c.nome} · {c.numeroProcesso}</Link>
                      <span className="text-xs text-slate-500">{c.quando ? new Date(c.quando).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''} — {c.detalhe}</span>
                    </li>
                  ))}
                </ul>
              )}
        </section>
      )}
    </div>
  );
}
