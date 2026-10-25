'use client';

import { useEffect, useRef } from 'react';

const FOCAVEIS =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface Opcoes {
  aberto: boolean;
  onFechar: () => void;
  /** Nome acessível do diálogo. Anunciado ao abrir. */
  titulo: string;
}

/**
 * Mecânica de acessibilidade de um diálogo modal, sem opinião sobre a apresentação.
 *
 * Existe porque a app tem 118 sobreposições `fixed inset-0` em 65 ficheiros, cada uma com o
 * seu próprio painel já desenhado. Reescrever essa marcação toda para o `<Modal>` seria um
 * diff enorme e arriscado em ecrãs clínicos; este hook dá as **mesmas** garantias
 * (WCAG 2.1.2 sem armadilha de teclado, 2.4.3 ordem de foco, 4.1.2 nome e papel) espalhando
 * `propsPainel` sobre o painel que já existe.
 *
 * Não é uma segunda maneira de fazer diálogos: o `<Modal>` passou a ser construído sobre este
 * mesmo hook, por isso há uma implementação só. Use o `<Modal>` em conteúdo novo; use o hook
 * para tornar acessível um painel já desenhado.
 *
 * Garante: Escape fecha · Tab circula dentro do painel · foco inicial no primeiro focável ·
 * foco devolvido ao elemento que abriu o diálogo · `role="dialog"` + `aria-modal` + nome.
 */
export function useDialogoAcessivel({ aberto, onFechar, titulo }: Opcoes) {
  const painelRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!aberto) return;
    gatilhoRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => painelRef.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus(), 20);
    return () => {
      clearTimeout(t);
      gatilhoRef.current?.focus?.();
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFechar();
        return;
      }
      if (e.key !== 'Tab') return;
      const focaveis = Array.from(painelRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  return {
    painelRef,
    propsPainel: {
      ref: painelRef,
      role: 'dialog' as const,
      'aria-modal': true,
      'aria-label': titulo,
    },
  };
}
