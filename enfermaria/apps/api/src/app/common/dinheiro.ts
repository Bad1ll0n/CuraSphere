import { Prisma } from '../../generated/prisma';

/**
 * ARQ-22 — dinheiro. As colunas monetárias são `DECIMAL(12,2)` (eram `Float`, e 0,1 + 0,2 ≠ 0,3).
 * O Prisma devolve-as como `Prisma.Decimal`; somar um Decimal com `+` concatena texto em silêncio
 * quando o tipo é `any`. Por isso toda a aritmética de dinheiro passa por aqui: converte para
 * número e arredonda ao cêntimo depois de cada operação.
 */
export type ValorMonetario = Prisma.Decimal | number | string | null | undefined;

/** Valor em euros como número, arredondado ao cêntimo (`null`/`undefined` → 0). */
export function euros(v: ValorMonetario): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v.toString());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Soma de valores monetários, arredondada ao cêntimo. */
export function somarEuros(valores: Iterable<ValorMonetario>): number {
  let centimos = 0;
  for (const v of valores) centimos += Math.round(euros(v) * 100);
  return centimos / 100;
}

/** Preço × quantidade, ao cêntimo. */
export function multiplicarEuros(preco: ValorMonetario, quantidade: number): number {
  return Math.round(euros(preco) * quantidade * 100) / 100;
}

/**
 * Na resposta JSON, o dinheiro continua a ser um número (o contrato da API não muda): sem isto,
 * um `Decimal` serializa como texto ("12.50") e a web somaria texto.
 */
export function serializarDecimalComoNumero(): void {
  (Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON = function (this: Prisma.Decimal) {
    return this.toNumber();
  };
}
serializarDecimalComoNumero();
