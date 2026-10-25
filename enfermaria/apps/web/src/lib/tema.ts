'use client';

import { useEffect, useState } from 'react';

export type Tema = 'light' | 'dark' | 'high-contrast';

export const TEMAS: Tema[] = ['light', 'dark', 'high-contrast'];
export const CHAVE_TEMA = 'curasphere-theme';

/** Ordem de rotação do botão de tema no cabeçalho. */
export const PROXIMO_TEMA: Record<Tema, Tema> = {
  light: 'dark',
  dark: 'high-contrast',
  'high-contrast': 'light',
};

/**
 * Fonte única de verdade do tema.
 *
 * Existiam **duas** implementações sobre a mesma chave `curasphere-theme`:
 * `dark-mode-toggle.tsx` (3 temas) e `modal-configuracoes.tsx` (só claro/escuro). A segunda
 * fazia `classList.toggle('dark', ...)`, que **não remove** a classe `high-contrast` — quem
 * activasse o alto contraste no botão e depois escolhesse "Claro" nas Configurações ficava
 * com a interface presa em alto contraste, e o modal mostrava "Claro" seleccionado. Uma
 * pessoa que precise de alto contraste é exactamente quem menos pode ficar preso assim.
 */
export function lerTema(): Tema {
  if (typeof window === 'undefined') return 'light';
  try {
    const guardado = localStorage.getItem(CHAVE_TEMA) as Tema | null;
    if (guardado && TEMAS.includes(guardado)) return guardado;
  } catch { /* localStorage indisponível */ }
  // Sem preferência guardada: seguir o sistema. 'high-contrast' não tem equivalente em
  // prefers-color-scheme, por isso continua a ser sempre opt-in.
  const prefereEscuro = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefereEscuro ? 'dark' : 'light';
}

/** Aplica o tema ao `<html>` — removendo **sempre** as classes dos outros — e persiste-o. */
export function aplicarTema(tema: Tema) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('dark', 'high-contrast');
  if (tema === 'dark') document.documentElement.classList.add('dark');
  else if (tema === 'high-contrast') document.documentElement.classList.add('high-contrast');
  try { localStorage.setItem(CHAVE_TEMA, tema); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('curasphere:tema', { detail: tema }));
}

/**
 * Estado do tema partilhado entre os vários controlos. O evento `curasphere:tema` mantém o
 * botão do cabeçalho e o modal de Configurações sincronizados — antes cada um lia o
 * `localStorage` uma vez ao montar e ficava a mostrar um valor obsoleto.
 */
export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTemaEstado] = useState<Tema>('light');

  useEffect(() => {
    setTemaEstado(lerTema());
    const onTema = (e: Event) => setTemaEstado((e as CustomEvent<Tema>).detail);
    window.addEventListener('curasphere:tema', onTema);
    return () => window.removeEventListener('curasphere:tema', onTema);
  }, []);

  return [tema, (t: Tema) => { setTemaEstado(t); aplicarTema(t); }];
}
