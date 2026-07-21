import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Ícone opcional à esquerda do label. */
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const PADDING: Record<Size, string> = {
  sm: '6px 12px',
  md: '8px 18px',
  lg: '11px 24px',
};
const FONT: Record<Size, string> = { sm: '0.8125rem', md: '0.875rem', lg: '0.9375rem' };

// Cores por variante, ligadas aos tokens do design system (funcionam em claro/escuro).
function variantStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { background: 'var(--accent)', color: '#ffffff', border: '1px solid transparent' };
    case 'danger':
      return { background: 'var(--danger)', color: '#ffffff', border: '1px solid transparent' };
    case 'secondary':
      return { background: 'var(--bg-surface-2)', color: 'var(--text-hi)', border: '1px solid var(--border)' };
    case 'ghost':
      return { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' };
  }
}

/**
 * Botão primitivo do design system CuraSphere. Substitui os `<button className="bg-blue-600…">`
 * duplicados por toda a app (fonte de inconsistências e de bugs de dark mode). Usa os tokens
 * CSS (`--accent`, `--danger`, `--border`…), por isso adapta-se a claro/escuro/alto-contraste.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, leftIcon, fullWidth, disabled, children, style, className, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-semibold rounded-xl transition-colors ${className ?? ''}`}
      style={{
        ...variantStyle(variant),
        padding: PADDING[size],
        fontSize: FONT[size],
        gap: '8px',
        width: fullWidth ? '100%' : undefined,
        opacity: isDisabled ? 0.55 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      aria-busy={loading || undefined}
      {...rest}>
      {loading ? (
        <span
          aria-hidden
          className="inline-block rounded-full animate-spin"
          style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent' }}
        />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
});
