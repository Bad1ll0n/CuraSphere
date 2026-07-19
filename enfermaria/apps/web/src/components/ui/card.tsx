import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove o padding interno (para conteúdo que gere o seu próprio espaçamento). */
  flush?: boolean;
}

/**
 * Superfície/cartão primitivo. Usa `--bg-surface` + `--border` (tema-aware) em vez do
 * `bg-white border-slate-200` fixo espalhado pela app — que ficava branco em dark mode.
 */
export function Card({ flush, style, className, children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl ${className ?? ''}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        padding: flush ? 0 : '20px',
        ...style,
      }}
      {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between" style={{ marginBottom: '16px', gap: '12px' }}>
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--text-hi)', fontSize: '0.9375rem' }}>{title}</h3>
        {subtitle && <p style={{ color: 'var(--text-soft)', fontSize: '0.8125rem', marginTop: '2px' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
