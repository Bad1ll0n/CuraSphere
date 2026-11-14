'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export interface AlergiaResumo {
  alergenio: string;
  severidade?: string | null;
}

/**
 * UX-02 — alergias sempre à vista onde se prescreve e administra.
 *
 * Vermelho com a lista quando há alergias; âmbar quando não há nenhuma registada (o sistema
 * ainda não distingue "sem alergias conhecidas" de "não avaliado", e por isso não o afirma);
 * cinzento enquanto carrega ou se a leitura falhar — nunca uma falsa ausência.
 */
export function FaixaAlergias({
  alergias,
  erro = false,
  compacta = false,
  avaliacao,
}: {
  alergias: AlergiaResumo[] | null | undefined;
  erro?: boolean;
  compacta?: boolean;
  /** PROD-06: estado da avaliação ('sem_alergias_conhecidas' é afirmado; lista vazia sem avaliação não). */
  avaliacao?: string | null;
}) {
  const pad = compacta ? '4px 10px' : '8px 12px';

  if (erro) {
    return (
      <div role="status" className="rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700" style={{ padding: pad }}>
        ⚠️ Não foi possível carregar as alergias — confirme-as antes de prescrever ou administrar.
      </div>
    );
  }
  if (!alergias) {
    return (
      <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500" style={{ padding: pad }}>
        A carregar alergias…
      </div>
    );
  }
  if (alergias.length === 0 && avaliacao === 'sem_alergias_conhecidas') {
    return (
      <div role="status" className="rounded-lg border border-green-300 bg-green-50 text-xs font-semibold text-green-800" style={{ padding: pad }}>
        ✓ Sem alergias conhecidas (avaliado)
      </div>
    );
  }
  if (alergias.length === 0) {
    return (
      <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900" style={{ padding: pad }}>
        ⚠️ Alergias não avaliadas — pergunte ao doente/família antes de prescrever ou administrar.
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 text-xs text-red-900 flex flex-wrap items-center gap-1.5" style={{ padding: pad }}>
      <span className="font-bold uppercase tracking-wide">⛔ Alergias:</span>
      {alergias.map((a, i) => (
        <span key={`${a.alergenio}-${i}`} className="rounded-full bg-red-100 border border-red-200 font-semibold" style={{ padding: '1px 8px' }}>
          {a.alergenio}{a.severidade ? ` (${a.severidade})` : ''}
        </span>
      ))}
    </div>
  );
}

/** A mesma faixa, que carrega as alergias do doente. */
export function FaixaAlergiasDoente({ doenteId, compacta }: { doenteId: string; compacta?: boolean }) {
  const [alergias, setAlergias] = useState<AlergiaResumo[] | null>(null);
  const [avaliacao, setAvaliacao] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    setAlergias(null);
    setErro(false);
    api.get(`/alergias/${doenteId}`)
      .then((r) => { if (ativo) setAlergias(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (ativo) setErro(true); });
    api.get(`/alergias/${doenteId}/avaliacao`)
      .then((r) => { if (ativo) setAvaliacao(r.data?.estado ?? null); })
      .catch(() => { /* sem estado: mantém o aviso conservador */ });
    return () => { ativo = false; };
  }, [doenteId]);
  return <FaixaAlergias alergias={alergias} erro={erro} compacta={compacta} avaliacao={avaliacao} />;
}
