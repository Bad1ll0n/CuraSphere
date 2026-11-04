'use client';

import Link from 'next/link';

interface SosAlerta {
  doenteId: string;
  // S-09: só a equipa do doente recebe o nome. Os restantes profissionais recebem o alerta
  // com a localização — como um código anunciado no hospital — e o banner serve os dois.
  doenteNome?: string;
  quarto: string;
  acionadoPor?: string;
  acionadoPorNome?: string;
  tipo?: 'sos' | 'sepsis';
}

interface SosBannerProps {
  sosAlerta: SosAlerta;
  onClose: () => void;
}

export function SosBanner({ sosAlerta, onClose }: SosBannerProps) {
  const rotulo = sosAlerta.tipo === 'sepsis' ? 'Alerta de sépsis' : 'SOS';
  // Sem nome, é a localização que identifica o alerta.
  const identificacao = sosAlerta.doenteNome ?? sosAlerta.quarto;
  // "Por" mostrava o id de quem accionou. Sem nome (a sépsis é automática), não se mostra.
  const detalhe = [
    sosAlerta.doenteNome ? sosAlerta.quarto : null,
    sosAlerta.acionadoPorNome ? `Por ${sosAlerta.acionadoPorNome}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    // O alerta clínico mais crítico da aplicação não era anunciado a leitores de ecrã:
    // sem `role`/`aria-live`, um enfermeiro com leitor de ecrã não sabia que ele existia.
    // Assertivo de propósito — interromper é o comportamento correcto para um SOS.
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-4 bg-red-600 text-white rounded-2xl shadow-2xl animate-pulse"
      style={{ padding: '16px 24px', minWidth: '420px', maxWidth: '600px' }}
    >
      <svg className="w-6 h-6 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{rotulo} — {identificacao}</p>
        {detalhe && <p className="text-xs text-red-100">{detalhe}</p>}
      </div>
      <Link
        href={`/doentes/${sosAlerta.doenteId}`}
        onClick={onClose}
        className="shrink-0 text-xs font-semibold bg-white text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        style={{ padding: '8px 14px', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}
      >
        Ver ficha
      </Link>
      <button
        onClick={onClose}
        aria-label={`Fechar ${rotulo} — ${identificacao}`}
        className="shrink-0 text-red-200 hover:text-white text-lg leading-none"
        style={{ minWidth: '44px', minHeight: '44px' }}
      >✕</button>
    </div>
  );
}
