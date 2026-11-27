'use client';
import { useTranslations } from 'next-intl';
import type { News2Detalhe, News2Parametro } from '@org/shared';

/**
 * UX-16: o formulário de sinais vitais mostrava "120 / 80 / 72…" como placeholder, a AVPU vinha
 * pré-selecionada e o NEWS2 só aparecia depois de gravar. Aqui fica o NEWS2 previsto enquanto se
 * escreve, calculado com a mesma regra da API (`calcularNEWS2Detalhado`, libs/shared).
 */

/** Campo do formulário → parâmetro NEWS2. */
export const CAMPO_NEWS2: Record<string, News2Parametro | undefined> = {
  pressaoS: 'pressaoSistolica', pulso: 'pulso', temp: 'temperatura', spO2: 'saturacaoO2', freqResp: 'frequenciaRespiratoria',
};

/** UX-07: devolve a chave (vitals.interval.*) em vez do texto. */
export function news2Intervalo(score: number): { chave: 'high' | 'medium' | 'low'; cor: string } {
  if (score >= 7) return { chave: 'high', cor: 'text-red-600' };
  if (score >= 5) return { chave: 'medium', cor: 'text-amber-600' };
  return { chave: 'low', cor: 'text-green-600' };
}

/** Cor de um valor pelos seus pontos NEWS2: vermelho = 3, âmbar = 1–2. */
export const corPontosNews2 = (p: number | undefined) => (p === 3 ? 'text-red-600' : p ? 'text-amber-600' : 'text-slate-700');

export function News2Previsto({ previsao }: { previsao: News2Detalhe }) {
  const t = useTranslations('vitals');
  const { score } = previsao;
  const estilo = score == null ? 'bg-slate-50 border-slate-100 text-slate-500'
    : score >= 7 ? 'bg-red-50 border-red-200 text-red-800'
    : score >= 5 || previsao.parametroIsoladoTres ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-green-50 border-green-200 text-green-800';
  return (
    <div role="status" aria-live="polite" className={`rounded-xl text-sm border ${estilo}`} style={{ padding: '10px 14px', marginBottom: '16px' }}>
      {score == null ? (
        <span className="text-xs">{t('previewNone')}</span>
      ) : (
        <>
          <p className="font-semibold" style={{ margin: 0 }}>
            {t('previewScore', { score })}
            {!previsao.completo && <span className="font-normal text-xs"> · {t('previewPartial', { n: previsao.parametrosEmFalta.length })}</span>}
          </p>
          <p className="text-xs" style={{ margin: 0, marginTop: '2px' }}>{t(`interval.${news2Intervalo(score).chave}`)}</p>
          {previsao.parametroIsoladoTres && score < 7 && (
            <p className="text-xs font-semibold" style={{ margin: 0, marginTop: '2px' }}>{t('previewRed')}</p>
          )}
        </>
      )}
    </div>
  );
}
