'use client';

import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  titulo: string;
  mensagem: string;
  labelConfirmar?: string;
  labelCancelar?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirmar: () => void;
  onCancelar: () => void;
}

const variantStyles = {
  danger:  'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  warning: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400',
  info:    'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
};

export function ConfirmModal({
  isOpen,
  titulo,
  mensagem,
  labelConfirmar = 'Confirmar',
  labelCancelar = 'Cancelar',
  variant = 'danger',
  onConfirmar,
  onCancelar,
}: ConfirmModalProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const titleId = 'confirm-modal-title';
  const descId = 'confirm-modal-desc';

  // Focus inicial no botão Cancelar (acção mais segura)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelarRef.current?.focus(), 20);
    }
  }, [isOpen]);

  // Escape fecha
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancelar]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = [cancelarRef.current, confirmarRef.current].filter(Boolean) as HTMLElement[];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 mb-2">{titulo}</h2>
        <p id={descId} className="text-sm text-slate-600 mb-6">{mensagem}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelarRef}
            onClick={onCancelar}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {labelCancelar}
          </button>
          <button
            ref={confirmarRef}
            onClick={onConfirmar}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantStyles[variant]}`}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
