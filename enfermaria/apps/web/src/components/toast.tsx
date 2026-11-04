'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  /** Milissegundos até desaparecer sozinho; `null` = fica até ser dispensado. */
  duracao: number | null;
}

type Opcoes = { duracao?: number | null };

interface ToastContextValue {
  success: (message: string, opcoes?: Opcoes) => void;
  error: (message: string, opcoes?: Opcoes) => void;
  warning: (message: string, opcoes?: Opcoes) => void;
  info: (message: string, opcoes?: Opcoes) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * WCAG 2.2.1 (Timing Adjustable): um aviso não pode desaparecer sozinho sem que o utilizador
 * o possa ler, e um **erro clínico não pode desaparecer de todo** — antes, os quatro tipos
 * partilhavam um `setTimeout` fixo de 4 s, pelo que "Erro ao administrar medicação" sumia em
 * quatro segundos e não deixava rasto em lado nenhum.
 *
 * - `error`   → não expira. Só sai por acção explícita.
 * - `warning` → 12 s (o dobro do informativo; é accionável).
 * - `success` / `info` → 6 s.
 *
 * Além disso, a contagem **pára enquanto o rato estiver sobre a pilha ou o foco lá dentro**,
 * e retoma o tempo que faltava — quem esteja a ler não vê o texto fugir.
 */
const DURACAO_POR_TIPO: Record<ToastType, number | null> = {
  success: 6000,
  info: 6000,
  warning: 12000,
  error: null,
};

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const PREFIXO_LEITOR: Record<ToastType, string> = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Aviso',
  info: 'Informação',
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', icon: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#d97706', text: '#b45309', icon: '#d97706' },
  info:    { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8', icon: '#2563eb' },
};

function ToastItem({
  toast,
  onRemove,
  pausado,
}: {
  toast: Toast;
  onRemove: (id: number) => void;
  pausado: boolean;
}) {
  const c = COLORS[toast.type];
  const restanteRef = useRef<number | null>(toast.duracao);
  const inicioRef = useRef(0);

  useEffect(() => {
    if (restanteRef.current == null || pausado) return;
    inicioRef.current = Date.now();
    const t = setTimeout(() => onRemove(toast.id), restanteRef.current);
    return () => {
      clearTimeout(t);
      if (restanteRef.current != null) {
        restanteRef.current = Math.max(0, restanteRef.current - (Date.now() - inicioRef.current));
      }
    };
  }, [pausado, toast.id, onRemove]);

  return (
    <div
      className="cs-toast"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '8px',
        border: `1px solid ${c.border}`,
        background: c.bg,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        minWidth: '280px',
        maxWidth: '400px',
      }}
    >
      <span aria-hidden="true" style={{ color: c.icon, fontWeight: 700, fontSize: '15px', marginTop: '1px', flexShrink: 0 }}>
        {ICONS[toast.type]}
      </span>
      <span style={{ color: c.text, fontSize: '14px', lineHeight: '1.4', flex: 1 }}>
        {/* O ícone é forma, não texto: o leitor de ecrã recebe a palavra, não o glifo. */}
        <span className="sr-only">{PREFIXO_LEITOR[toast.type]}: </span>
        {toast.message}
      </span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: c.text,
          opacity: 0.6,
          fontSize: '16px',
          lineHeight: 1,
          padding: '4px 8px',
          minWidth: '32px',
          minHeight: '32px',
          flexShrink: 0,
        }}
        aria-label={`Fechar: ${toast.message}`}
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pausado, setPausado] = useState(false);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, opcoes?: Opcoes) => {
    const id = ++counter.current;
    const duracao = opcoes && 'duracao' in opcoes ? opcoes.duracao ?? null : DURACAO_POR_TIPO[type];
    setToasts((prev) => [...prev, { id, message, type, duracao }]);
  }, []);

  const ctx: ToastContextValue = {
    success: (m, o) => addToast(m, 'success', o),
    error:   (m, o) => addToast(m, 'error', o),
    warning: (m, o) => addToast(m, 'warning', o),
    info:    (m, o) => addToast(m, 'info', o),
  };

  // Erros e avisos são assertivos (interrompem o leitor de ecrã); sucesso e info são
  // educados. As duas regiões vivem sempre no DOM — uma região criada ao mesmo tempo que o
  // conteúdo é frequentemente ignorada pelos leitores de ecrã.
  const urgentes = toasts.filter((t) => t.type === 'error' || t.type === 'warning');
  const normais = toasts.filter((t) => t.type === 'success' || t.type === 'info');

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <style>{`
        @keyframes toast-in { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        .cs-toast { animation: toast-in 0.2s ease; }
        @media (prefers-reduced-motion: reduce) { .cs-toast { animation: none; } }
      `}</style>
      <div
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onFocusCapture={() => setPausado(true)}
        onBlurCapture={() => setPausado(false)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: toasts.length ? 'all' : 'none',
        }}
      >
        <div role="alert" aria-live="assertive" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {urgentes.map((t) => (
            <ToastItem key={t.id} toast={t} onRemove={remove} pausado={pausado} />
          ))}
        </div>
        <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {normais.map((t) => (
            <ToastItem key={t.id} toast={t} onRemove={remove} pausado={pausado} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
