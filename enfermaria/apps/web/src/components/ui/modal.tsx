'use client';

import { useEffect, useId, useRef, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  children: ReactNode;
  /** Largura máxima do painel (ex.: '480px'). */
  maxWidth?: string;
  /** Fechar ao clicar no fundo (backdrop). Default: true. */
  fecharAoClicarFora?: boolean;
}

// Elementos focáveis para a armadilha de foco (focus trap).
const FOCAVEIS =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal acessível reutilizável (WCAG 2.1.2 / 2.4.3 / 4.1.2):
 * `role="dialog"` + `aria-modal`, `aria-labelledby` no título, Escape fecha, armadilha de foco
 * sobre todos os focáveis, foco inicial no primeiro elemento e devolução do foco ao gatilho ao
 * fechar. Envolve conteúdo arbitrário; fornece cabeçalho com título + botão "Fechar".
 */
export function Modal({ isOpen, onClose, titulo, children, maxWidth = '480px', fecharAoClicarFora = true }: ModalProps) {
  const painelRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Guarda o elemento com foco ao abrir e devolve-lho ao fechar; foco inicial no 1º focável.
  useEffect(() => {
    if (!isOpen) return;
    gatilhoRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => painelRef.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus(), 20);
    return () => {
      clearTimeout(t);
      gatilhoRef.current?.focus?.();
    };
  }, [isOpen]);

  // Escape fecha + armadilha de foco no Tab.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={fecharAoClicarFora ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-2xl w-full"
        style={{ maxWidth, margin: '0 16px', padding: '32px' }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <h2 id={titleId} className="text-lg font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
