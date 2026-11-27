/**
 * UX-20: formatação portuguesa para os dashboards. Antes havia "€0.0k", eixos "10-23" e datas
 * "Quinta-Feira, 5 De Novembro" (o `capitalize` do CSS põe maiúscula em todas as palavras).
 */

const EUROS = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EUROS_COMPACTO = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
});

/** "12 345 €"; com `compacto`, "12,3 mil €". */
export function formatarEuros(valor: number | null | undefined, opcoes: { compacto?: boolean } = {}): string {
  const v = Number.isFinite(valor) ? (valor as number) : 0;
  return (opcoes.compacto && Math.abs(v) >= 10_000 ? EUROS_COMPACTO : EUROS).format(v);
}

/** "2026-10-23" (ou ISO completo) → "23/10". */
export function formatarDiaMes(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** Só a primeira letra em maiúscula: "quinta-feira, 5 de novembro" → "Quinta-feira, 5 de novembro". */
export function capitalizarPrimeira(texto: string): string {
  return texto ? texto.charAt(0).toLocaleUpperCase('pt-PT') + texto.slice(1) : texto;
}
