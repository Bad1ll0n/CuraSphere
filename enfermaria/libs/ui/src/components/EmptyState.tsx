import React from 'react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title = 'Sem resultados', description, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}
