import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, error, required, className, children }: FormFieldProps) {
  // O controlo fica dentro do <label> → associação implícita (WCAG 1.3.1), sem precisar de id.
  return (
    <div className={className}>
      <label>
        <span className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </span>
        <div className={error ? 'ring-1 ring-red-400 rounded-lg' : undefined}>
          {children}
        </div>
      </label>
      {error && (
        <p className="text-xs text-red-600 mt-1" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
