import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * Campo de texto primitivo. Usa `--bg-input` + `--border` + `--text-hi` (tema-aware).
 * Combina com o `FormField` existente (label + erro) — este é só o controlo.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, style, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`rounded-xl outline-none transition-shadow w-full ${className ?? ''}`}
      style={{
        background: 'var(--bg-input)',
        color: 'var(--text-hi)',
        border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
        padding: '9px 12px',
        fontSize: '0.875rem',
        ...style,
      }}
      {...rest}
    />
  );
});
