'use client';

import { useTranslations } from 'next-intl';

/** Igual ao limiar da API (common/clinico/hora-do-ato.ts): mais de 10 min entre o ato e o registo. */
const LIMIAR_DIFERIDO_MS = 10 * 60_000;

/**
 * PROD-16 — marca um registo feito depois do ato (à cabeceira sem rede, sincronizado mais tarde).
 * A hora mostrada no registo é a do ato; esta etiqueta diz quando chegou ao sistema.
 */
export function RegistoDiferido({ ocorridoEm, registadoEm }: { ocorridoEm?: string | null; registadoEm?: string | null }) {
  const t = useTranslations('deferredRecord');
  if (!ocorridoEm || !registadoEm) return null;
  const registo = new Date(registadoEm);
  if (registo.getTime() - new Date(ocorridoEm).getTime() <= LIMIAR_DIFERIDO_MS) return null;
  const quando = registo.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <span className="inline-block text-[11px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200"
      style={{ padding: '0 6px', marginLeft: '6px' }} title={t('hint', { quando })}>
      {t('badge', { quando })}
    </span>
  );
}
