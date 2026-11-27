'use client';

import { useEffect, useState } from 'react';

/**
 * UX-30 — modos de trabalho à cabeceira.
 *
 * - **Cabeceira**: alvos de 48 px, letra base de 18 px e barra lateral escondida, para o tablet
 *   à cabeceira do doente.
 * - **Noturno**: tema escuro de baixa luminância, sem brancos puros nem animações de pulso.
 *   Em "automático", liga sozinho no turno da noite (00–08).
 *
 * São preferências do posto (localStorage) aplicadas como classes no `<html>`.
 */
export type ModoNoturno = 'desligado' | 'ligado' | 'automatico';
const CHAVE_CABECEIRA = 'curasphere_modo_cabeceira';
const CHAVE_NOTURNO = 'curasphere_modo_noturno';
const EVENTO = 'curasphere:modos';

const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

export function noturnoAtivo(modo: ModoNoturno, agora = new Date()): boolean {
  if (modo === 'ligado') return true;
  if (modo === 'desligado') return false;
  const h = agora.getHours();
  return h < 8;
}

/** Aplica as classes ao `<html>` a partir das preferências guardadas. */
export function aplicarModos() {
  if (typeof document === 'undefined') return;
  const cabeceira = ler(CHAVE_CABECEIRA) === 'sim';
  const noturno = noturnoAtivo((ler(CHAVE_NOTURNO) as ModoNoturno) ?? 'desligado');
  document.documentElement.classList.toggle('cabeceira', cabeceira);
  document.documentElement.classList.toggle('noite', noturno);
}

export function useModosTurno(): {
  cabeceira: boolean; setCabeceira: (v: boolean) => void;
  noturno: ModoNoturno; setNoturno: (v: ModoNoturno) => void;
} {
  const [cabeceira, setC] = useState(false);
  const [noturno, setN] = useState<ModoNoturno>('desligado');
  useEffect(() => {
    const sync = () => {
      setC(ler(CHAVE_CABECEIRA) === 'sim');
      setN(((ler(CHAVE_NOTURNO) as ModoNoturno) ?? 'desligado'));
    };
    sync();
    window.addEventListener(EVENTO, sync);
    return () => window.removeEventListener(EVENTO, sync);
  }, []);
  const notificar = () => { aplicarModos(); window.dispatchEvent(new Event(EVENTO)); };
  return {
    cabeceira,
    setCabeceira: (v) => { gravar(CHAVE_CABECEIRA, v ? 'sim' : 'nao'); notificar(); },
    noturno,
    setNoturno: (v) => { gravar(CHAVE_NOTURNO, v); notificar(); },
  };
}
