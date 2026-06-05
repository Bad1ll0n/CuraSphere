'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { useToast } from './toast';

interface Props {
  decisaoId?: string | null;
  className?: string;
}

export function AiFeedback({ decisaoId, className = '' }: Props) {
  const toast = useToast();
  const [estado, setEstado] = useState<'idle' | 'rejeitado' | 'enviado'>('idle');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!decisaoId) return null;
  if (estado === 'enviado') {
    return (
      <p className={`text-xs text-slate-400 italic ${className}`}>Feedback registado. Obrigado.</p>
    );
  }

  const enviar = async (aceite: boolean) => {
    setEnviando(true);
    try {
      await api.patch(`/ai-clinico/decisao/${decisaoId}/feedback`, {
        aceite,
        overrideMotivo: aceite ? undefined : motivo,
      });
      setEstado('enviado');
      toast.success('Feedback registado');
    } catch {
      toast.error('Erro ao registar feedback');
    } finally { setEnviando(false); }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {estado === 'idle' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Esta sugestão foi útil?</span>
          <button
            onClick={() => enviar(true)}
            disabled={enviando}
            title="Útil"
            className="w-7 h-7 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 flex items-center justify-center transition-colors disabled:opacity-50 text-sm"
          >
            👍
          </button>
          <button
            onClick={() => setEstado('rejeitado')}
            disabled={enviando}
            title="Não útil"
            className="w-7 h-7 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-50 text-sm"
          >
            👎
          </button>
        </div>
      )}
      {estado === 'rejeitado' && (
        <div className="flex flex-col gap-2">
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)..."
            rows={2}
            className="w-full text-xs border border-red-200 rounded-lg bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            style={{ padding: '6px 8px' }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEstado('idle')}
              className="flex-1 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              style={{ padding: '5px' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => enviar(false)}
              disabled={enviando}
              className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ padding: '5px' }}
            >
              {enviando ? 'A enviar...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
