'use client';

import { ReactNode } from 'react';
import { useDialogoAcessivel } from './use-dialogo-acessivel';

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

/**
 * Modal acessível reutilizável (WCAG 2.1.2 / 2.4.3 / 4.1.2): `role="dialog"` + `aria-modal`,
 * nome acessível, Escape fecha, armadilha de foco, foco inicial e devolução do foco ao gatilho.
 *
 * A mecânica vive em `useDialogoAcessivel` — o mesmo hook que torna acessíveis os painéis já
 * desenhados que não passam por este componente. Uma implementação só.
 */
export function Modal({ isOpen, onClose, titulo, children, maxWidth = '480px', fecharAoClicarFora = true }: ModalProps) {
  const { propsPainel } = useDialogoAcessivel({ aberto: isOpen, onFechar: onClose, titulo });

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={fecharAoClicarFora ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        {...propsPainel}
        className="bg-white rounded-2xl shadow-2xl w-full"
        style={{ maxWidth, margin: '0 16px', padding: '32px' }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
