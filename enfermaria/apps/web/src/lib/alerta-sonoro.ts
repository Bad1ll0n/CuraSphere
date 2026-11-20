'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * UX-11 — som dos alertas críticos.
 *
 * O sino só tocava quando o contador passava de N>0 para mais: o primeiro alerta crítico com a
 * caixa vazia (0 → 1), o caso mais comum, nunca tocava. Agora:
 *  - toca sempre que o número de críticos por ler (ou de SOS por responder) SOBE, incluindo de 0;
 *  - repete a cada `INTERVALO_REPETICAO_MS` enquanto houver algum por tratar;
 *  - "Silenciar 5 min" pára a repetição (não o primeiro toque de um alerta novo), e o momento fica
 *    registado no próprio browser (`curasphere:silencio-alertas`) para se ver quando foi.
 */
export const INTERVALO_REPETICAO_MS = 60_000;
export const SILENCIO_MS = 5 * 60_000;
const CHAVE_SILENCIO = 'curasphere:silencio-alertas';

export function tocarAlerta() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    for (const [i, freq] of [880, 660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0.25, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    }
  } catch { /* política do browser (sem interação ainda) ou sem suporte */ }
}

function lerSilencio(): number {
  try { return Number(localStorage.getItem(CHAVE_SILENCIO)) || 0; } catch { return 0; }
}

/** Decide se toca agora: subiu o número de pendentes (toca sempre) ou é repetição fora do silêncio. */
export function deveTocar(anterior: number, atual: number, repeticao: boolean, silenciadoAte: number, agora = Date.now()): boolean {
  if (atual <= 0) return false;
  if (!repeticao) return atual > anterior;
  return agora >= silenciadoAte;
}

export function useAlertaSonoro(pendentes: number) {
  const anterior = useRef(0);
  const [silenciadoAte, setSilenciadoAte] = useState(0);

  useEffect(() => { setSilenciadoAte(lerSilencio()); }, []);

  useEffect(() => {
    if (deveTocar(anterior.current, pendentes, false, silenciadoAte)) tocarAlerta();
    anterior.current = pendentes;
  }, [pendentes, silenciadoAte]);

  useEffect(() => {
    if (pendentes <= 0) return;
    const id = setInterval(() => { if (deveTocar(pendentes, pendentes, true, lerSilencio())) tocarAlerta(); }, INTERVALO_REPETICAO_MS);
    return () => clearInterval(id);
  }, [pendentes]);

  const silenciar = () => {
    const ate = Date.now() + SILENCIO_MS;
    try { localStorage.setItem(CHAVE_SILENCIO, String(ate)); } catch { /* sem armazenamento: só nesta sessão */ }
    setSilenciadoAte(ate);
  };
  return { silenciadoAte, silenciar, silenciado: silenciadoAte > Date.now() };
}
