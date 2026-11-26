/**
 * SEC-15 — células CSV seguras.
 *
 * Um nome de doente, uma nota ou um motivo começado por `=`, `+`, `-`, `@`, tab ou CR é lido pelo
 * Excel/LibreOffice como fórmula (`=HYPERLINK(...)`, `=cmd|...`) quando se abre a exportação —
 * injeção de fórmulas (CWE-1236). A célula leva um apóstrofo à frente (fica texto) e vai entre
 * aspas sempre que tem separador, aspas, quebra de linha ou espaços nas pontas. Números
 * (incluindo negativos) ficam como estão.
 *
 * Cópia da API (apps/api/src/app/common/infra/csv.ts) — as duas têm de ficar iguais.
 */
const INICIO_PERIGOSO = /^[=+\-@\t\r]/;
const NUMERO = /^-?\d+([.,]\d+)?$/;

export function celulaCsv(valor: unknown, separador = ','): string {
  let s = valor == null ? '' : valor instanceof Date ? valor.toISOString() : typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  if (INICIO_PERIGOSO.test(s) && !NUMERO.test(s)) s = `'${s}`;
  return s.includes(separador) || /["\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function linhaCsv(valores: unknown[], separador = ','): string {
  return valores.map((v) => celulaCsv(v, separador)).join(separador);
}
