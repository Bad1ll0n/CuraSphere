'use client';

import { useEffect } from 'react';
import { ACOES_FICHA } from './paleta-comandos';

export { registarRecente } from './paleta-comandos';

/**
 * UX-18 — na ficha do doente: atalhos de uma tecla (V vitais, M medicação, N notas…, listados no
 * "?") e mudança de separador pelo endereço (#vitais), que é como a paleta de comandos lá chega.
 * Não dispara a escrever num campo, com um modal aberto ou com Ctrl/Cmd/Alt.
 */
export function useAtalhosFicha(separadores: string[], mudar: (id: string) => void) {
  useEffect(() => {
    const lerHash = () => {
      const h = window.location.hash.replace('#', '');
      if (separadores.includes(h)) mudar(h);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      const acao = ACOES_FICHA.find((a) => a.tecla === e.key.toUpperCase());
      if (!acao || !separadores.includes(acao.separador)) return;
      e.preventDefault();
      mudar(acao.separador);
      window.history.replaceState(null, '', `#${acao.separador}`);
    };
    lerHash();
    window.addEventListener('hashchange', lerHash);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('hashchange', lerHash); document.removeEventListener('keydown', onKey); };
  }, []);
}
