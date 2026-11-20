'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface AlertaCritico {
  doenteId: string;
  // S-09: só a equipa do doente recebe o nome. Os restantes profissionais recebem o alerta
  // com a localização — como um código anunciado no hospital — e o banner serve os dois.
  doenteNome?: string;
  quarto: string;
  acionadoPor?: string;
  acionadoPorNome?: string;
  tipo?: 'sos' | 'sepsis';
  /** UX-11: o alerta clínico a acusar com "Eu respondo". */
  alertaId?: string;
  ts?: number;
  /** Preenchido quando alguém da equipa respondeu. */
  respondidoPor?: string | null;
}

/** Chave de um alerta na fila: o mesmo SOS repetido não duplica; SOS e sépsis do mesmo doente são dois. */
export const chaveAlerta = (a: Pick<AlertaCritico, 'doenteId' | 'tipo' | 'alertaId'>) => a.alertaId ?? `${a.tipo ?? 'sos'}:${a.doenteId}`;

/**
 * UX-11 — fila de alertas críticos (SOS, sépsis).
 *
 * Antes: um só alerta em memória (um segundo SOS substituía o primeiro) que desaparecia ao fim
 * de 30 s sem ninguém confirmar. Agora cada alerta fica até alguém responder ("Eu respondo",
 * visível a toda a equipa) e só então pode ser fechado; os mais antigos primeiro.
 */
export function FilaAlertasCriticos({ alertas, onResponder, onFechar }: {
  alertas: AlertaCritico[];
  onResponder: (a: AlertaCritico) => void;
  onFechar: (a: AlertaCritico) => void;
}) {
  const t = useTranslations('criticalAlerts');
  if (!alertas.length) return null;
  return (
    <div className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 flex flex-col gap-2" style={{ minWidth: '420px', maxWidth: '640px' }}>
      {alertas.map((a) => {
        const rotulo = a.tipo === 'sepsis' ? t('sepsis') : t('sos');
        const identificacao = a.doenteNome ?? a.quarto;
        const detalhe = [a.doenteNome ? a.quarto : null, a.acionadoPorNome ? t('by', { nome: a.acionadoPorNome }) : null].filter(Boolean).join(' · ');
        const respondido = a.respondidoPor !== undefined && a.respondidoPor !== null;
        return (
          // O alerta clínico mais crítico da aplicação é anunciado a leitores de ecrã, de forma assertiva.
          <div key={chaveAlerta(a)} role="alert" aria-live="assertive" aria-atomic="true"
            className={`flex items-center gap-3 text-white rounded-2xl shadow-2xl ${respondido ? 'bg-slate-700' : 'bg-red-600 animate-pulse'}`}
            style={{ padding: '14px 20px' }}>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{rotulo} — {identificacao}</p>
              {detalhe && <p className="text-xs text-red-100">{detalhe}</p>}
              {respondido && <p className="text-xs font-semibold text-green-200">{t('responded', { nome: a.respondidoPor || t('someone') })}</p>}
            </div>
            <Link href={`/doentes/${a.doenteId}`}
              className="shrink-0 text-xs font-semibold bg-white text-red-600 hover:bg-red-50 rounded-lg"
              style={{ padding: '8px 12px', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
              {t('openFile')}
            </Link>
            {!respondido && a.alertaId && (
              <button type="button" onClick={() => onResponder(a)}
                className="shrink-0 text-xs font-bold bg-red-900 hover:bg-red-950 rounded-lg" style={{ padding: '8px 12px', minHeight: '44px' }}>
                {t('respond')}
              </button>
            )}
            {(respondido || !a.alertaId) && (
              <button type="button" onClick={() => onFechar(a)} aria-label={t('close', { rotulo, identificacao })}
                className="shrink-0 text-red-100 hover:text-white text-lg leading-none" style={{ minWidth: '44px', minHeight: '44px' }}>✕</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
