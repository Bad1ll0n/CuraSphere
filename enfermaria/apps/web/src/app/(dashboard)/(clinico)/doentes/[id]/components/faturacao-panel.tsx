'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface ItemFaturacao {
  id: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
}

interface Pagamento {
  id: string;
  metodo: string;
  referencia?: string;
  valor: number;
  criadoEm: string;
}

interface EpisodioFaturacao {
  id: string;
  estado: string;
  dataEmissao?: string;
  tipoCobertura?: string;
  totalCobrado?: number;
  itens?: ItemFaturacao[];
  pagamentos?: Pagamento[];
}

interface Props {
  doenteId: string;
  utilizador: { role: string } | null;
}

const ESTADO_BADGE: Record<string, string> = {
  pendente: 'bg-yellow-50 text-yellow-700',
  emitida: 'bg-orange-50 text-orange-700',
  paga: 'bg-green-50 text-green-700',
  isenta: 'bg-blue-50 text-blue-700',
  anulada: 'bg-slate-100 text-slate-500',
};
const ESTADO_LABEL: Record<string, string> = {
  pendente: '⏳ Pendente', emitida: '📄 Emitida', paga: '✅ Paga', isenta: '🔵 Isenta', anulada: '❌ Anulada',
};

const fmtEur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function FaturacaoPanel({ doenteId, utilizador }: Props) {
  const [faturacao, setFaturacao] = useState<EpisodioFaturacao[]>([]);

  useEffect(() => {
    api.get(`/faturacao/doente/${doenteId}`)
      .then(r => setFaturacao(r.data ?? []))
      .catch(() => setFaturacao([]));
  }, [doenteId]);

  if (!['administrativo', 'direcao'].includes(utilizador?.role ?? '')) return null;

  const pendentes = faturacao.filter(e => ['pendente', 'emitida'].includes(e.estado));
  const totalPendente = pendentes.reduce((acc, e) => {
    const pago = (e.pagamentos ?? []).reduce((s, p) => s + (p.valor ?? 0), 0);
    return acc + Math.max(0, (e.totalCobrado ?? 0) - pago);
  }, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ padding: '24px', marginBottom: '24px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-700">Faturação</span>
        {faturacao.length > 0 && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 badge-pad py-0.5 rounded-full" style={{ marginLeft: '4px' }}>
            {faturacao.length} episódio{faturacao.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800" style={{ padding: '10px 14px', marginBottom: '16px' }}>
          <span>⚠</span>
          <span>
            {pendentes.length} episódio{pendentes.length !== 1 ? 's' : ''} com pagamento pendente —{' '}
            <strong>Total: {fmtEur(totalPendente)}</strong>
          </span>
        </div>
      )}

      {faturacao.length === 0 ? (
        <p className="text-sm text-slate-400 text-center" style={{ padding: '16px 0' }}>Sem episódios de faturação</p>
      ) : (
        <div className="flex flex-col gap-3">
          {faturacao.map((e) => {
            const pago = (e.pagamentos ?? []).reduce((s, p) => s + (p.valor ?? 0), 0);
            const emFalta = Math.max(0, (e.totalCobrado ?? 0) - pago);
            return (
              <div key={e.id} className="border border-slate-100 rounded-xl" style={{ padding: '14px 16px' }}>
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '8px' }}>
                  <span className={`text-xs font-semibold badge-pad py-0.5 rounded-md ${ESTADO_BADGE[e.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ESTADO_LABEL[e.estado] ?? e.estado}
                  </span>
                  {e.dataEmissao && <span className="text-xs text-slate-500">{fmtData(e.dataEmissao)}</span>}
                  {e.tipoCobertura && <span className="text-xs text-slate-400">{e.tipoCobertura}</span>}
                  <span className="text-xs font-semibold text-slate-700" style={{ marginLeft: 'auto' }}>{fmtEur(e.totalCobrado ?? 0)}</span>
                </div>

                {(e.itens ?? []).length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Itens</p>
                    {(e.itens ?? []).map((it) => (
                      <div key={it.id} className="flex justify-between text-xs text-slate-500 py-0.5">
                        <span>{it.descricao} <span className="text-slate-400">({it.categoria})</span></span>
                        <span>{it.quantidade} × {fmtEur(it.precoUnitario)} = {fmtEur(it.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(e.pagamentos ?? []).length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ marginBottom: '4px' }}>Pagamentos</p>
                    {(e.pagamentos ?? []).map((p) => (
                      <div key={p.id} className="flex justify-between text-xs text-slate-500 py-0.5">
                        <span>{p.metodo}{p.referencia ? ` · ${p.referencia}` : ''} · {fmtData(p.criadoEm)}</span>
                        <span>{fmtEur(p.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {emFalta > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-red-600 border-t border-slate-100" style={{ paddingTop: '6px', marginTop: '4px' }}>
                    <span>Valor em falta</span>
                    <span>{fmtEur(emFalta)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
