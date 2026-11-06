'use client';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from '@/components/ui/modal';

const MIN = 10;
const MAX = 500;

function DialogoMotivo({ titulo, descricao, onFim }: { titulo: string; descricao?: string; onFim: (m: string | null) => void }) {
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= MIN;
  return (
    <Modal isOpen titulo={titulo} onClose={() => onFim(null)} maxWidth="460px">
      <p className="text-sm text-slate-600" style={{ marginBottom: '12px' }}>
        {descricao ?? 'O registo deixa de aparecer, mas fica no processo clínico com o seu nome, a hora e o motivo.'}
      </p>
      <label htmlFor="motivo-remocao" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
        Motivo da remoção *
      </label>
      <textarea
        id="motivo-remocao"
        autoFocus
        rows={3}
        maxLength={MAX}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ex.: registado no doente errado"
        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        style={{ padding: '10px 12px' }}
      />
      <p className="text-xs text-slate-400" style={{ marginTop: '4px' }}>Mínimo {MIN} caracteres.</p>
      <div className="flex gap-3" style={{ marginTop: '16px' }}>
        <button onClick={() => onFim(null)} className="flex-1 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50" style={{ padding: '10px' }}>
          Cancelar
        </button>
        <button
          onClick={() => valido && onFim(motivo.trim())}
          disabled={!valido}
          className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40"
          style={{ padding: '10px' }}
        >
          Remover
        </button>
      </div>
    </Modal>
  );
}

/**
 * ARQ-04 — pede o motivo de remoção de um registo clínico. Resolve com o motivo, ou `null`
 * se o utilizador cancelar. Funciona em qualquer componente, sem estado nem JSX extra:
 *
 *   const motivo = await pedirMotivoRemocao('Remover registo');
 *   if (!motivo) return;
 *   await api.delete(url, { data: { motivo } });
 */
export function pedirMotivoRemocao(titulo: string, descricao?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const fim = (m: string | null) => {
      resolve(m);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(<DialogoMotivo titulo={titulo} descricao={descricao} onFim={fim} />);
  });
}
