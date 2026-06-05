'use client';
import { useEffect, useRef, useState } from 'react';
import { HELP } from '@/lib/help-content';

interface Props {
  chave: keyof typeof HELP;
}

export function HelpTooltip({ chave }: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const content = HELP[chave];
  if (!content) return null;

  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  return (
    <div ref={ref} className="relative inline-flex items-center" style={{ marginLeft: '4px' }}>
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        aria-label={`Ajuda: ${content.titulo}`}
        className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors text-xs font-bold leading-none"
      >
        ?
      </button>
      {aberto && (
        <div
          role="tooltip"
          className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-lg text-sm"
          style={{ top: '24px', left: '0', width: '280px', padding: '12px 14px' }}
        >
          <p className="font-semibold text-slate-800" style={{ marginBottom: '6px' }}>{content.titulo}</p>
          <p className="text-slate-500 text-xs leading-relaxed">{content.descricao}</p>
        </div>
      )}
    </div>
  );
}
