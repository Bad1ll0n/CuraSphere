'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';

interface Acesso {
  id: string;
  motivo: string;
  criadoEm: string;
  expiradoEm: string;
  ativo: boolean;
  revistoEm: string | null;
  revisaoResultado: 'justificado' | 'injustificado' | null;
  revisaoNota: string | null;
  escaladoEm?: string | null;
  utilizador: { id: string; nome: string; role: string };
  doente: { id: string; nome: string; numeroProcesso: string };
  revistoPor?: { nome: string } | null;
}

const quando = (d: string) => new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
const horasDesde = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);

/**
 * SEC-14 — revisão dos acessos de emergência (break-glass). Cada acesso é revisto por alguém da
 * direção, qualidade ou chefia que não o fez; sem revisão em 72 h, escala.
 */
export default function AcessosEmergenciaPage() {
  const t = useTranslations('emergencyAccessReview');
  const { utilizador } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [aba, setAba] = useState<'porRever' | 'historico'>('porRever');
  const [aInjustificar, setAInjustificar] = useState<string | null>(null);
  const [nota, setNota] = useState('');

  const porRever = useQuery<Acesso[]>({ queryKey: ['break-glass', 'por-rever'], queryFn: () => api.get('/break-glass/por-rever').then((r) => r.data) });
  const historico = useQuery<Acesso[]>({ queryKey: ['break-glass', 'historico'], queryFn: () => api.get('/break-glass').then((r) => r.data), enabled: aba === 'historico' });

  const rever = useMutation({
    mutationFn: ({ id, resultado, nota: n }: { id: string; resultado: 'justificado' | 'injustificado'; nota?: string }) =>
      api.patch(`/break-glass/${id}/revisao`, { resultado, nota: n }),
    onSuccess: () => {
      toast.success(t('saved'));
      setAInjustificar(null); setNota('');
      qc.invalidateQueries({ queryKey: ['break-glass'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('error')),
  });

  const consulta = aba === 'porRever' ? porRever : historico;
  const lista = consulta.data ?? [];

  return (
    <div className="max-w-5xl mx-auto" style={{ padding: '32px 24px' }}>
      <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
      <p className="text-sm text-slate-500" style={{ marginTop: '4px' }}>{t('subtitle')}</p>

      <div role="tablist" aria-label={t('title')} className="flex gap-2" style={{ marginTop: '20px', marginBottom: '16px' }}>
        {(['porRever', 'historico'] as const).map((a) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`text-sm font-semibold rounded-lg ${aba === a ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            style={{ padding: '8px 14px' }}>
            {a === 'porRever' ? t('tabPending', { n: porRever.data?.length ?? 0 }) : t('tabHistory')}
          </button>
        ))}
      </div>

      {consulta.isLoading && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {consulta.isError && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg" style={{ padding: '12px' }}>
          {t('loadError')} <button type="button" className="underline" onClick={() => consulta.refetch()}>{t('retry')}</button>
        </div>
      )}
      {!consulta.isLoading && !consulta.isError && lista.length === 0 && (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg" style={{ padding: '16px' }}>{aba === 'porRever' ? t('emptyPending') : t('emptyHistory')}</p>
      )}

      <ul className="flex flex-col gap-3">
        {lista.map((a) => {
          const proprio = a.utilizador.id === utilizador?.id;
          const atrasado = !a.revistoEm && horasDesde(a.criadoEm) >= 72;
          return (
            <li key={a.id} className={`bg-white rounded-xl border ${atrasado ? 'border-red-300' : 'border-slate-200'}`} style={{ padding: '16px' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-slate-900">
                  {t.rich('who', {
                    nome: a.utilizador.nome, papel: a.utilizador.role,
                    doente: () => <Link className="font-semibold text-blue-700 hover:underline" href={`/doentes/${a.doente.id}`}>{a.doente.nome} ({a.doente.numeroProcesso})</Link>,
                    b: (c) => <strong>{c}</strong>,
                  })}
                </p>
                <span className="text-xs text-slate-500">{quando(a.criadoEm)}</span>
              </div>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg" style={{ marginTop: '8px', padding: '8px 10px' }}>{a.motivo}</p>
              {atrasado && <p className="text-xs font-semibold text-red-700" style={{ marginTop: '6px' }}>{t('overdue', { h: horasDesde(a.criadoEm) })}</p>}

              {a.revistoEm ? (
                <p className={`text-xs font-semibold ${a.revisaoResultado === 'injustificado' ? 'text-red-700' : 'text-emerald-700'}`} style={{ marginTop: '8px' }}>
                  {t(a.revisaoResultado === 'injustificado' ? 'reviewedUnjustified' : 'reviewedJustified', { por: a.revistoPor?.nome ?? '—', quando: quando(a.revistoEm) })}
                  {a.revisaoNota ? ` — ${a.revisaoNota}` : ''}
                </p>
              ) : proprio ? (
                <p className="text-xs text-slate-500" style={{ marginTop: '8px' }}>{t('ownAccess')}</p>
              ) : aInjustificar === a.id ? (
                <div className="flex flex-col gap-2" style={{ marginTop: '10px' }}>
                  <label htmlFor={`nota-${a.id}`} className="text-xs font-semibold text-slate-600">{t('noteLabel')}</label>
                  <textarea id={`nota-${a.id}`} rows={2} value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)}
                    className="border border-slate-200 rounded-lg text-sm" style={{ padding: '8px' }} />
                  <div className="flex gap-2">
                    <button type="button" disabled={nota.trim().length < 10 || rever.isPending}
                      onClick={() => rever.mutate({ id: a.id, resultado: 'injustificado', nota })}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '8px 14px' }}>
                      {t('confirmUnjustified')}
                    </button>
                    <button type="button" onClick={() => { setAInjustificar(null); setNota(''); }} className="border border-slate-200 text-sm rounded-lg" style={{ padding: '8px 14px' }}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2" style={{ marginTop: '10px' }}>
                  <button type="button" disabled={rever.isPending} onClick={() => rever.mutate({ id: a.id, resultado: 'justificado' })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '8px 14px' }}>
                    {t('justified')}
                  </button>
                  <button type="button" onClick={() => { setAInjustificar(a.id); setNota(''); }}
                    className="border border-red-300 text-red-700 hover:bg-red-50 text-sm font-semibold rounded-lg" style={{ padding: '8px 14px' }}>
                    {t('unjustified')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
