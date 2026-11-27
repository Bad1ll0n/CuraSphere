/**
 * UX-17 — prescrição estruturada: o que chega ao `prescrever` e como se compõe a dose.
 * A dose pode vir em valor + unidade (lista fechada em @org/shared); o texto `dose` continua a
 * ser o que o MAR, os PDFs e o parser de limites leem, por isso compõe-se a partir deles.
 */
export interface EntradaPrescricao {
    doenteId: string;
    nome: string;
    dose?: string;
    doseValor?: number;
    doseUnidade?: string;
    indicacao?: string;
    duracaoDias?: number;
    via: string;
    frequencia: string;
    prescritoPorId: string;
    forcarApesarDeAlergia?: boolean;
    justificativaOverride?: string;
    forcarDoseAcimaMaximo?: boolean;
    justificativaDose?: string;
    intervaloMinimoH?: number;
    maxDosesDia?: number;
    catalogoId?: string;
    justificacaoForaCatalogo?: string;
    forcarDuplicacao?: boolean;
    justificativaDuplicacao?: string;
    forcarInteracao?: boolean;
    justificativaInteracao?: string;
}

/** O texto da dose a partir do valor e da unidade (vírgula decimal); sem estrutura, fica o texto. */
export function doseComposta(d: { dose?: string; doseValor?: number; doseUnidade?: string }): string {
  if (d.doseValor !== undefined && d.doseUnidade) {
    const valor = Number(d.doseValor.toFixed(3)).toString().replace('.', ',');
    return `${valor} ${d.doseUnidade}`;
  }
  return (d.dose ?? '').trim();
}

/** Indicação e duração; a duração dá a data de fim prevista. */
export function camposPrescricaoEstruturada(d: { indicacao?: string; duracaoDias?: number }, agora = Date.now()) {
  return {
    indicacao: d.indicacao?.trim() || null,
    duracaoDias: d.duracaoDias ?? null,
    dataFimPrevista: d.duracaoDias ? new Date(agora + d.duracaoDias * 86_400_000) : null,
  };
}
