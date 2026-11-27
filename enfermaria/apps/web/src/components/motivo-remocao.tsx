'use client';

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui';

const MAX = 500;

interface OpcoesTexto {
  titulo: string;
  descricao: string;
  rotulo: string;
  botao: string;
  minimo?: number;
  placeholder?: string;
}

function DialogoMotivo({ titulo, descricao, rotulo, botao, minimo = 10, placeholder, onFim }: OpcoesTexto & { onFim: (m: string | null) => void }) {
  const MIN = minimo;
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= MIN;
  return (
    <Modal isOpen titulo={titulo} onClose={() => onFim(null)} maxWidth="460px">
      <p className="text-sm text-slate-600" style={{ marginBottom: '12px' }}>
        {descricao}
      </p>
      <label htmlFor="motivo-remocao" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ marginBottom: '6px' }}>
        {rotulo} *
      </label>
      <textarea
        id="motivo-remocao"
        autoFocus
        rows={3}
        maxLength={MAX}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        style={{ padding: '10px 12px' }}
      />
      <p className="text-xs text-slate-500" style={{ marginTop: '4px' }}>Mínimo {MIN} caracteres.</p>
      <div className="flex gap-3" style={{ marginTop: '16px' }}>
        <Button variant="secondary" className="flex-1" onClick={() => onFim(null)}  style={{ padding: '10px' }}>
          Cancelar
        </Button>
        <Button variant="danger" className="flex-1"
          onClick={() => valido && onFim(motivo.trim())}
          disabled={!valido}
          
          style={{ padding: '10px' }}
        >
          {botao}
        </Button>
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
  return pedirTexto({
    titulo,
    descricao: descricao ?? 'O registo deixa de aparecer, mas fica no processo clínico com o seu nome, a hora e o motivo.',
    rotulo: 'Motivo da remoção',
    botao: 'Remover',
    placeholder: 'Ex.: registado no doente errado',
  });
}

interface OpcoesConfirmacao { titulo: string; descricao: string; confirmar: string; cancelar: string }

function DialogoConfirmacao({ titulo, descricao, confirmar, cancelar, onFim }: OpcoesConfirmacao & { onFim: (ok: boolean) => void }) {
  return (
    <Modal isOpen titulo={titulo} onClose={() => onFim(false)} maxWidth="460px">
      <p className="text-sm text-slate-700" role="alert">{descricao}</p>
      <div className="flex gap-3" style={{ marginTop: '16px' }}>
        <Button variant="secondary" className="flex-1" autoFocus onClick={() => onFim(false)}  style={{ padding: '10px' }}>
          {cancelar}
        </Button>
        <Button variant="danger" className="flex-1" onClick={() => onFim(true)}  style={{ padding: '10px' }}>
          {confirmar}
        </Button>
      </div>
    </Modal>
  );
}

/** Pede uma confirmação explícita (o foco começa em "cancelar"). Resolve com `true` só se confirmar. */
export function pedirConfirmacao(opcoes: OpcoesConfirmacao): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const fim = (ok: boolean) => {
      resolve(ok);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(<DialogoConfirmacao {...opcoes} onFim={fim} />);
  });
}

/** Pede um texto obrigatório (justificação, motivo…) num diálogo. Resolve com o texto ou `null`. */
export function pedirTexto(opcoes: OpcoesTexto): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const fim = (m: string | null) => {
      resolve(m);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(<DialogoMotivo {...opcoes} onFim={fim} />);
  });
}
