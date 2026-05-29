'use client';

import Link from 'next/link';

interface SosAlerta {
  doenteId: string;
  doenteNome: string;
  quarto: string;
  acionadoPor: string;
}

interface SosBannerProps {
  sosAlerta: SosAlerta;
  onClose: () => void;
}

export function SosBanner({ sosAlerta, onClose }: SosBannerProps) {
  return (
    <div
      className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-4 bg-red-600 text-white rounded-2xl shadow-2xl animate-pulse"
      style={{ padding: '16px 24px', minWidth: '420px', maxWidth: '600px' }}
    >
      <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">SOS — {sosAlerta.doenteNome}</p>
        <p className="text-xs text-red-100">{sosAlerta.quarto} · Por {sosAlerta.acionadoPor}</p>
      </div>
      <Link
        href={`/doentes/${sosAlerta.doenteId}`}
        onClick={onClose}
        className="shrink-0 text-xs font-semibold bg-white text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        style={{ padding: '6px 12px' }}
      >
        Ver ficha
      </Link>
      <button onClick={onClose} aria-label="Fechar alerta SOS" className="shrink-0 text-red-200 hover:text-white text-lg leading-none">✕</button>
    </div>
  );
}
