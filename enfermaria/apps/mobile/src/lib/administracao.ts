/**
 * PROD-16 — o corpo de uma administração registada na app, online ou offline.
 *
 * Antes, a via offline punha na fila só `{ doenteId }`: sem dose, via, leitura nem atestação, a
 * administração chegava ao servidor horas depois como "não confirmada" — e datada da
 * sincronização, não do ato. Uma morfina dada às 03:10 e sincronizada às 07:45 ficava às 07:45,
 * e a próxima dose SOS contava-se a partir daí.
 *
 * Agora, as duas vias levam o mesmo corpo:
 *  - `ocorridoEm`: a hora do ATO, capturada quando o enfermeiro confirma à cabeceira — não
 *    quando a fila é enviada. O servidor aceita-a dentro de uma janela (12 h) e guarda à parte
 *    a hora a que o registo chegou, para o mostrar como "registo diferido".
 *  - `atestadoPeloEnfermeiro` (lista dos 5 certos percorrida) ou `qrPayload` (etiqueta lida): o
 *    servidor recusa um registo diferido sem um dos dois.
 */
export interface CorpoAdministracao {
  doenteId: string;
  ocorridoEm: string;
  atestadoPeloEnfermeiro?: true;
  qrPayload?: string;
  observacoes?: string;
}

export function corpoAdministracao(
  doenteId: string,
  verificacao: { atestado: true } | { qrPayload: string; observacoes?: string },
  agora: Date = new Date(),
): CorpoAdministracao {
  const base = { doenteId, ocorridoEm: agora.toISOString() };
  if ('atestado' in verificacao) return { ...base, atestadoPeloEnfermeiro: true };
  return { ...base, qrPayload: verificacao.qrPayload, ...(verificacao.observacoes ? { observacoes: verificacao.observacoes } : {}) };
}

/** Os 5 certos, pela ordem em que se confirmam à cabeceira. */
export const CINCO_CERTOS = ['doente', 'medicamento', 'dose', 'via', 'hora'] as const;
export type Certo = (typeof CINCO_CERTOS)[number];

export const todosConfirmados = (marcados: Partial<Record<Certo, boolean>>): boolean =>
  CINCO_CERTOS.every((c) => marcados[c] === true);
