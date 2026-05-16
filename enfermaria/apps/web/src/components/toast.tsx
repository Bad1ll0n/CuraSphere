'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#16a34a', text: '#15803d', icon: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#d97706', text: '#b45309', icon: '#d97706' },
  info:    { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8', icon: '#2563eb' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const c = COLORS[toast.type];
  return (
    <div
      role="alert"
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
        animation: 'toast-in 0.2s ease',
      }}
    >
      <span style={{ color: c.icon, fontWeight: 700, fontSize: '15px', marginTop: '1px', flexShrink: 0 }}>
        {ICONS[toast.type]}
      </span>
      <span style={{ color: c.text, fontSize: '14px', lineHeight: '1.4', flex: 1 }}>
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
          padding: '0 2px',
          flexShrink: 0,
        }}
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    success: (m) => addToast(m, 'success'),
    error:   (m) => addToast(m, 'error'),
    warning: (m) => addToast(m, 'warning'),
    info:    (m) => addToast(m, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <style>{`@keyframes toast-in { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }`}</style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
