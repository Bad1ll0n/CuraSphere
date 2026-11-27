'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LeituraMonitorPendente } from '@org/shared';
import { useToast } from '@/components/toast';
import { useDecidirLeituras, useLeiturasMonitor } from '@/lib/hooks/use-leituras-monitor';
import { Button } from '@/components/ui';

const ROLES_VALIDAM = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno'];

function resumoValores(v: LeituraMonitorPendente['valores']): string {
  const partes: string[] = [];
  if (v.pressaoSistolica != null) partes.push(`TA ${v.pressaoSistolica}/${v.pressaoDiastolica ?? '—'}`);
  if (v.pulso != null) partes.push(`FC ${v.pulso}`);
  if (v.saturacaoO2 != null) partes.push(`SpO₂ ${v.saturacaoO2}%`);
  if (v.frequenciaRespiratoria != null) partes.push(`FR ${v.frequenciaRespiratoria}`);
  if (v.temperatura != null) partes.push(`T ${v.temperatura.toFixed(1)}`);
  if (v.avpu) partes.push(`AVPU ${v.avpu}`);
  return partes.join(' · ');
}

/**
 * PROD-15 — leituras dos monitores à espera de validação. Só depois de validadas entram nos
 * sinais vitais (NEWS2, tendência, alertas), com quem valida como autor. Uma leitura que não é
 * verdadeira (sensor solto, doente em movimento) rejeita-se como artefacto, com o motivo.
 */
export function LeiturasMonitorPanel({ doenteId, role, onValidadas }: { doenteId: string; role?: string; onValidadas: () => void }) {
  const t = useTranslations('monitorReadings');
  const toast = useToast();
  const { data: leituras, isError, refetch } = useLeiturasMonitor(doenteId);
  const decidir = useDecidirLeituras(doenteId);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [aRejeitar, setARejeitar] = useState(false);
  const podeValidar = !!role && ROLES_VALIDAM.includes(role);

  useEffect(() => {
    // Seleção limpa quando a lista muda (outra pessoa validou entretanto).
    setSelecionadas((s) => new Set([...s].filter((id) => leituras?.some((l) => l.id === id))));
  }, [leituras]);

  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 text-sm text-red-700" style={{ padding: '10px 14px', marginBottom: '12px' }}>
        {t('loadError')}{' '}
        <button type="button" className="underline font-semibold" onClick={() => refetch()}>{t('retry')}</button>
      </div>
    );
  }
  if (!leituras?.length) return null;

  const alternar = (id: string) => setSelecionadas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const todas = selecionadas.size === leituras.length;
  const ids = [...selecionadas];

  const validar = async () => {
    try {
      const r = await decidir.mutateAsync({ acao: 'validar', ids });
      if (r.falhas.length) toast.error(t('partial', { ok: r.validadas, falhas: r.falhas.length, motivo: r.falhas[0].motivo }));
      else toast.success(t('validated', { n: r.validadas }));
      setSelecionadas(new Set());
      onValidadas();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('error'));
    }
  };

  const rejeitar = async () => {
    try {
      const r = await decidir.mutateAsync({ acao: 'rejeitar', ids, motivo });
      toast.success(t('rejected', { n: r.rejeitadas ?? 0 }));
      setSelecionadas(new Set());
      setARejeitar(false);
      setMotivo('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('error'));
    }
  };

  return (
    <section aria-label={t('title')} className="rounded-xl border border-amber-200 bg-amber-50/50" style={{ padding: '12px 14px', marginBottom: '12px' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-amber-900">{t('heading', { n: leituras.length })}</p>
        {podeValidar && (
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={todas} onChange={() => setSelecionadas(todas ? new Set() : new Set(leituras.map((l) => l.id)))} />
            {t('selectAll')}
          </label>
        )}
      </div>
      <p className="text-xs text-slate-600" style={{ margin: '4px 0 8px' }}>{t('hint')}</p>
      <ul className="flex flex-col gap-1">
        {leituras.map((l) => (
          <li key={l.id} className={`flex items-center gap-2 text-sm rounded-lg ${l.critica ? 'bg-red-50 text-red-800' : 'bg-white text-slate-700'}`} style={{ padding: '6px 10px' }}>
            {podeValidar && (
              <input type="checkbox" aria-label={t('select', { hora: new Date(l.medidoEm).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) })}
                checked={selecionadas.has(l.id)} onChange={() => alternar(l.id)} />
            )}
            <span className="text-xs text-slate-500 tabular-nums">{new Date(l.medidoEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="font-semibold">{resumoValores(l.valores)}</span>
            {l.critica && <span className="text-[11px] font-bold uppercase">{t('critical')}</span>}
          </li>
        ))}
      </ul>
      {podeValidar ? (
        <div className="flex flex-wrap items-center gap-2" style={{ marginTop: '10px' }}>
          <Button variant="primary" type="button" disabled={!ids.length || decidir.isPending} onClick={validar}
             style={{ padding: '6px 12px' }}>
            {t('validate', { n: ids.length })}
          </Button>
          {!aRejeitar ? (
            <Button variant="secondary" type="button" disabled={!ids.length} onClick={() => setARejeitar(true)}
               style={{ padding: '6px 12px' }}>
              {t('reject')}
            </Button>
          ) : (
            <>
              <label htmlFor="lm-motivo" className="sr-only">{t('reasonLabel')}</label>
              <input id="lm-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder={t('reasonPlaceholder')}
                className="border border-slate-300 rounded-lg text-sm flex-1" style={{ padding: '6px 10px', minWidth: '200px' }} />
              <button type="button" disabled={motivo.trim().length < 5 || decidir.isPending} onClick={rejeitar}
                className="bg-slate-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '6px 12px' }}>
                {t('confirmReject')}
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500" style={{ marginTop: '8px' }}>{t('readOnly')}</p>
      )}
    </section>
  );
}
