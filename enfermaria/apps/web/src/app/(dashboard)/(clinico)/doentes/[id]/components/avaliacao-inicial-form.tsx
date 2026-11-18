'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { useAcaoPlano, useAvaliacaoInicial } from '@/lib/hooks';

/** PROD-07 — secções da avaliação inicial de enfermagem (texto estruturado por secção). */
export const SECOES_AVALIACAO = [
  'antecedentes', 'autocuidado', 'comunicacao', 'eliminacao', 'sono', 'nutricao', 'pele', 'dor', 'mobilidade', 'apoio', 'preferencias',
] as const;

type Dados = Record<string, string> & { cuidadorNome?: string; cuidadorContacto?: string };

export function AvaliacaoInicialForm({ doenteId, onFechar }: { doenteId: string; onFechar: () => void }) {
  const t = useTranslations('carePlan');
  const tc = useTranslations('common');
  const toast = useToast();
  const { data: existente } = useAvaliacaoInicial(doenteId, true);
  const [dados, setDados] = useState<Dados>({});
  const [completa, setCompleta] = useState(false);

  useEffect(() => {
    if (!existente) return;
    setDados((existente.dados ?? {}) as Dados);
    setCompleta(existente.completa);
  }, [existente]);

  const guardar = useAcaoPlano(doenteId, () =>
    api.put(`/processo-enfermagem/doente/${doenteId}/avaliacao-inicial`, { dados, completa }));

  const submeter = async () => {
    try {
      await guardar.mutateAsync(undefined);
      toast.success(t('initial.saved'));
      onFechar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('error'));
    }
  };

  const campo = (chave: string) => (
    <div key={chave}>
      <label htmlFor={`ai-${chave}`} className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>
        {t(`initial.section.${chave}`)}
      </label>
      <textarea id={`ai-${chave}`} rows={2} maxLength={2000} value={dados[chave] ?? ''}
        onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))}
        className="w-full border border-slate-200 rounded-lg text-sm resize-y" style={{ padding: '8px 10px' }} />
    </div>
  );

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col gap-3" style={{ padding: '14px 16px' }}>
      <p className="text-sm font-semibold text-blue-900">{t('initial.title')}</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {SECOES_AVALIACAO.map(campo)}
        <div>
          <label htmlFor="ai-cuidador-nome" className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>{t('initial.caregiverName')}</label>
          <input id="ai-cuidador-nome" maxLength={200} value={dados.cuidadorNome ?? ''} onChange={(e) => setDados((d) => ({ ...d, cuidadorNome: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg text-sm" style={{ padding: '8px 10px' }} />
        </div>
        <div>
          <label htmlFor="ai-cuidador-contacto" className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>{t('initial.caregiverContact')}</label>
          <input id="ai-cuidador-contacto" maxLength={60} value={dados.cuidadorContacto ?? ''} onChange={(e) => setDados((d) => ({ ...d, cuidadorContacto: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg text-sm" style={{ padding: '8px 10px' }} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={completa} onChange={(e) => setCompleta(e.target.checked)} />
        {t('initial.markComplete')}
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onFechar} className="border border-slate-200 text-slate-700 text-sm rounded-lg" style={{ padding: '8px 14px' }}>{tc('cancel')}</button>
        <button type="button" onClick={submeter} disabled={guardar.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ padding: '8px 14px' }}>
          {tc('save')}
        </button>
      </div>
    </div>
  );
}
