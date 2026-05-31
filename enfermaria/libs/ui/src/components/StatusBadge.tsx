import React from 'react';

export interface StatusBadgeProps {
  status: string;
  colorMap: Record<string, string>;
  labelMap?: Record<string, string>;
  dotMap?: Record<string, string>;
  withDot?: boolean;
}

export function StatusBadge({ status, colorMap, labelMap, dotMap, withDot = false }: StatusBadgeProps) {
  const badgeClass = colorMap[status] ?? 'bg-slate-100 text-slate-600 border border-slate-200';
  const label = labelMap?.[status] ?? status;
  const dotColor = dotMap?.[status] ?? 'bg-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
      {withDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {label}
    </span>
  );
}
