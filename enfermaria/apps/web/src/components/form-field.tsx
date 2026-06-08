import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, error, required, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600" style={{ marginBottom: '4px' }}>
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <div className={error ? 'ring-1 ring-red-400 rounded-lg' : undefined}>
        {children}
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
