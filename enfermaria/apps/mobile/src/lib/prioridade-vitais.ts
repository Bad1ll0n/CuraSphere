/**
 * Ordem da lista de registo rápido de vitais (A7).
 *
 * A lista ordenava por NEWS2 descendente com `?? -1`: um doente sem NEWS2 — nunca avaliado,
 * ou cujos vitais não carregaram — ia para o FIM, abaixo dos doentes estáveis. Sem dados não
 * é baixo risco; é risco desconhecido. E como o ecrã pedia os vitais a uma rota que não
 * existe, era o caso de todos os doentes: a ordem nunca pôs ninguém à frente.
 *
 * Ordem:
 *  1. NEWS2 ≥ 7, depois 5–6 — risco alto conhecido;
 *  2. sem NEWS2 (nunca avaliado, ou vitais que não carregaram) — risco desconhecido;
 *  3. NEWS2 ≤ 4.
 * Dentro de cada grupo, primeiro quem está há mais tempo sem registo.
 */
export interface EstadoVitais {
  ultimoNews2?: number | null;
  ultimosVitaisEm?: string | null;
}

function grupo(d: EstadoVitais): number {
  const s = d.ultimoNews2;
  if (s == null) return 2;
  if (s >= 7) return 0;
  if (s >= 5) return 1;
  return 3;
}

// Nunca registado conta como o registo mais antigo possível.
function instante(d: EstadoVitais): number {
  return d.ultimosVitaisEm ? new Date(d.ultimosVitaisEm).getTime() : Number.NEGATIVE_INFINITY;
}

function comparar(a: EstadoVitais, b: EstadoVitais): number {
  const porGrupo = grupo(a) - grupo(b);
  if (porGrupo !== 0) return porGrupo;

  const ia = instante(a);
  const ib = instante(b);
  if (ia !== ib) return ia < ib ? -1 : 1;

  return (b.ultimoNews2 ?? 0) - (a.ultimoNews2 ?? 0);
}

export function ordenarParaRegistoRapido<T extends EstadoVitais>(doentes: T[]): T[] {
  return [...doentes].sort(comparar);
}
