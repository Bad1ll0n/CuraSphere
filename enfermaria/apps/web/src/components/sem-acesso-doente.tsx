'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';

/** O 403 de "sem atribuição" (break-glass necessário) — para a ficha mostrar o ecrã certo. */
export function eSemAtribuicao(err: any): boolean {
  const d = err?.response?.data;
  return err?.response?.status === 403 && (d?.errorCode === 'BREAK_GLASS_REQUIRED' || String(d?.message ?? '').includes('break_glass'));
}

const MOTIVOS = ['emergencia', 'chamado', 'cobertura', 'transferencia', 'outro'] as const;

/**
 * UX-10 / ARQ-28 — quem abre a ficha de um doente a que não está atribuído via "Doente não
 * encontrado" (o 403 era mostrado como 404), e o acesso de emergência era um `window.prompt`
 * dentro do interceptor do axios (que nem funciona em alguns browsers embutidos). Agora:
 *  - "Pedir atribuição" — avisa a chefia (não urgente);
 *  - "Acesso de emergência" — modal com o tipo de motivo e a justificação (≥ 20 caracteres),
 *    que fica registado e é revisto.
 */
export function SemAcessoDoente({ doenteId, onConcedido }: { doenteId: string; onConcedido: () => void }) {
  const t = useTranslations('noAccess');
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [tipo, setTipo] = useState<(typeof MOTIVOS)[number]>('emergencia');
  const [texto, setTexto] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  const pedir = async () => {
    try {
      const r = await api.post('/break-glass/pedido-atribuicao', { doenteId });
      toast.success(r.data?.enviado ? t('requestSent', { n: r.data.destinatarios }) : t('requestNoManager'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('error'));
    }
  };

  const emergencia = async () => {
    setAEnviar(true);
    try {
      await api.post('/break-glass', { doenteId, motivo: `[${t(`reason.${tipo}`)}] ${texto.trim()}` });
      setModal(false);
      onConcedido();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('error'));
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl border border-amber-200 shadow-sm" style={{ marginTop: '80px', padding: '28px' }}>
      <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
      <p className="text-sm text-slate-600" style={{ marginTop: '6px' }}>{t('body')}</p>
      <div className="flex flex-wrap gap-3" style={{ marginTop: '20px' }}>
        <Button variant="primary" type="button" onClick={pedir}  style={{ padding: '10px 16px' }}>
          {t('requestAssignment')}
        </Button>
        <button type="button" onClick={() => setModal(true)} className="border border-red-300 text-red-700 hover:bg-red-50 text-sm font-semibold rounded-lg" style={{ padding: '10px 16px' }}>
          {t('emergency')}
        </button>
      </div>

      {modal && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="bg-titulo" className="bg-white rounded-2xl shadow-2xl w-full flex flex-col gap-3" style={{ maxWidth: '520px', padding: '24px', margin: '0 16px' }}>
            <h2 id="bg-titulo" className="text-base font-bold text-slate-900">{t('emergencyTitle')}</h2>
            <p className="text-xs text-slate-600">{t('emergencyHint')}</p>
            <label htmlFor="bg-tipo" className="text-xs font-semibold text-slate-600">{t('reasonType')}</label>
            <select id="bg-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as (typeof MOTIVOS)[number])} className="border border-slate-200 rounded-lg text-sm" style={{ padding: '8px' }}>
              {MOTIVOS.map((m) => <option key={m} value={m}>{t(`reason.${m}`)}</option>)}
            </select>
            <label htmlFor="bg-texto" className="text-xs font-semibold text-slate-600">{t('justification')}</label>
            <textarea id="bg-texto" rows={3} value={texto} maxLength={500} onChange={(e) => setTexto(e.target.value)}
              className="border border-slate-200 rounded-lg text-sm" style={{ padding: '8px' }} />
            <p className="text-xs text-slate-500">{t('minChars', { n: texto.trim().length })}</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(false)} className="border border-slate-200 text-sm rounded-lg" style={{ padding: '8px 14px' }}>{t('cancel')}</button>
              <Button variant="danger" type="button" disabled={texto.trim().length < 20 || aEnviar} onClick={emergencia}
                 style={{ padding: '8px 14px' }}>
                {t('confirmEmergency')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
