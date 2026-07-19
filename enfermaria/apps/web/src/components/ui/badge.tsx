import React from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

// rgba com os tokens semânticos para o fundo suave + a cor sólida do texto.
const TONES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'var(--bg-surface-2)', fg: 'var(--text-muted)', border: 'var(--border)' },
  accent:  { bg: 'color-mix(in srgb, var(--accent) 14%, transparent)',  fg: 'var(--accent)',  border: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  success: { bg: 'color-mix(in srgb, var(--success) 14%, transparent)', fg: 'var(--success)', border: 'color-mix(in srgb, var(--success) 30%, transparent)' },
  warning: { bg: 'color-mix(in srgb, var(--warning) 16%, transparent)', fg: 'var(--warning)', border: 'color-mix(in srgb, var(--warning) 32%, transparent)' },
  danger:  { bg: 'color-mix(in srgb, var(--danger) 14%, transparent)',  fg: 'var(--danger)',  border: 'color-mix(in srgb, var(--danger) 30%, transparent)' },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Ponto colorido à esquerda (estado). */
  dot?: boolean;
}

/**
 * Etiqueta de estado. Unifica as dezenas de `<span className="bg-green-100 text-green-700…">`
 * inline por tons semânticos ligados aos tokens — legíveis em claro e escuro.
 */
export function Badge({ tone = 'neutral', dot, style, className, children, ...rest }: BadgeProps) {
  const c = TONES[tone];
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${className ?? ''}`}
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}`, padding: '2px 10px', fontSize: '0.75rem', gap: '6px', ...style }}
      {...rest}>
      {dot && <span aria-hidden style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'currentColor' }} />}
      {children}
    </span>
  );
}
