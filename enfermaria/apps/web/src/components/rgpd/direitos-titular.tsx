'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { SeletorDoente } from '@/components/seletor-doente';
import { Button } from '@/components/ui';

interface Retencao {
  politica: { anosProcessoClinico: number; diasDadosQuiosque: number; anonimizacaoAutomatica: boolean };
  elegiveis: { id: string; numeroProcesso: string; dataAlta: string }[];
}

/**
 * SEC-20 — direitos do titular, do lado do DPO: exportar os dados de um titular que o pediu ao
 * balcão (art.º 15.º/20.º) e decidir a anonimização dos processos fora do prazo de retenção.
 */
export function DireitosTitular() {
  const t = useTranslations('dataSubjectRights');
  const { utilizador } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const podeAnonimizar = utilizador?.role === 'qualidade';
  const [doenteId, setDoenteId] = useState('');
  const [aExportar, setAExportar] = useState(false);
  const [aAnonimizar, setAAnonimizar] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  const retencao = useQuery<Retencao>({ queryKey: ['rgpd', 'retencao'], queryFn: () => api.get('/rgpd/retencao').then((r) => r.data) });

  const exportar = async () => {
    if (!doenteId) return;
    setAExportar(true);
    try {
      const dados = await qc.fetchQuery({ queryKey: ['rgpd', 'exportacao', doenteId], queryFn: () => api.get(`/rgpd/titular/${doenteId}/exportacao`).then((r) => r.data), staleTime: 0 });
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados-titular-${doenteId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('exported'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('error'));
    } finally {
      setAExportar(false);
    }
  };

  const anonimizar = useMutation({
    mutationFn: (id: string) => api.post(`/rgpd/titular/${id}/anonimizar`, { motivo }),
    onSuccess: () => { toast.success(t('anonymized')); setAAnonimizar(null); setMotivo(''); qc.invalidateQueries({ queryKey: ['rgpd', 'retencao'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? t('error')),
  });

  const p = retencao.data?.politica;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ padding: '24px', marginTop: '24px' }} aria-labelledby="rgpd-titular">
      <h2 id="rgpd-titular" className="text-lg font-bold text-slate-900">{t('title')}</h2>

      <h3 className="text-sm font-semibold text-slate-700" style={{ marginTop: '16px' }}>{t('exportTitle')}</h3>
      <p className="text-xs text-slate-500" style={{ marginBottom: '8px' }}>{t('exportHint')}</p>
      <div className="flex flex-wrap items-start gap-2">
        <div style={{ flex: '1 1 320px' }}><SeletorDoente id="rgpd-doente" value={doenteId} onChange={(id) => setDoenteId(id)} /></div>
        <Button variant="primary" type="button" disabled={!doenteId || aExportar} onClick={exportar}
           style={{ padding: '10px 16px' }}>
          {aExportar ? t('exporting') : t('export')}
        </Button>
      </div>

      <h3 className="text-sm font-semibold text-slate-700" style={{ marginTop: '24px' }}>{t('retentionTitle')}</h3>
      {p && (
        <p className="text-xs text-slate-500">
          {t('policy', { anos: p.anosProcessoClinico, dias: p.diasDadosQuiosque })} {p.anonimizacaoAutomatica ? t('automatic') : t('manual')}
        </p>
      )}
      {retencao.isError && <p className="text-sm text-red-700" style={{ marginTop: '8px' }}>{t('loadError')}</p>}
      {retencao.data && retencao.data.elegiveis.length === 0 && <p className="text-sm text-slate-500" style={{ marginTop: '8px' }}>{t('noneEligible')}</p>}
      <ul className="flex flex-col gap-2" style={{ marginTop: '8px' }}>
        {retencao.data?.elegiveis.map((e) => (
          <li key={e.id} className="border border-slate-200 rounded-xl text-sm" style={{ padding: '10px 12px' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t('eligibleRow', { processo: e.numeroProcesso, alta: new Date(e.dataAlta).toLocaleDateString('pt-PT') })}</span>
              {podeAnonimizar && aAnonimizar !== e.id && (
                <button type="button" onClick={() => { setAAnonimizar(e.id); setMotivo(''); }} className="border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg" style={{ padding: '6px 10px' }}>
                  {t('anonymize')}
                </button>
              )}
            </div>
            {aAnonimizar === e.id && (
              <div className="flex flex-col gap-2" style={{ marginTop: '8px' }}>
                <label htmlFor={`motivo-${e.id}`} className="text-xs font-semibold text-slate-600">{t('reasonLabel')}</label>
                <input id={`motivo-${e.id}`} value={motivo} maxLength={500} onChange={(ev) => setMotivo(ev.target.value)} className="border border-slate-200 rounded-lg text-sm" style={{ padding: '8px' }} />
                <p className="text-xs text-red-700">{t('irreversible')}</p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" type="button" disabled={motivo.trim().length < 10 || anonimizar.isPending} onClick={() => anonimizar.mutate(e.id)}
                     style={{ padding: '6px 10px' }}>
                    {t('confirmAnonymize')}
                  </Button>
                  <button type="button" onClick={() => setAAnonimizar(null)} className="border border-slate-200 text-xs rounded-lg" style={{ padding: '6px 10px' }}>{t('cancel')}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
