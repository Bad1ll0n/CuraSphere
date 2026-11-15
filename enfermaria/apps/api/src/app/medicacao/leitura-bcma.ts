/**
 * UX-08 — leitura por código de barras à cabeceira (BCMA).
 *
 * Funções puras: interpretar o que um leitor (USB em modo teclado, câmara do tablet, app)
 * devolve. A verificação contra a prescrição e o doente faz-se no serviço, no servidor.
 */

/** Conteúdo da pulseira: `CSP1|<processo>|<AAAAMMDD>`; aceita também só o n.º de processo (Code128). */
export const PREFIXO_PULSEIRA = 'CSP1';

export function conteudoPulseira(numeroProcesso: string, dataNascimento: Date | null): string {
  const nasc = dataNascimento ? dataNascimento.toISOString().slice(0, 10).replace(/-/g, '') : '';
  return `${PREFIXO_PULSEIRA}|${numeroProcesso}|${nasc}`;
}

export function lerPulseira(codigo: string): { processo: string; nascimento: string | null } | null {
  const c = (codigo ?? '').trim();
  if (!c) return null;
  if (c.startsWith(`${PREFIXO_PULSEIRA}|`)) {
    const [, processo, nasc] = c.split('|');
    if (!processo) return null;
    return { processo, nascimento: nasc && /^\d{8}$/.test(nasc) ? `${nasc.slice(0, 4)}-${nasc.slice(4, 6)}-${nasc.slice(6, 8)}` : null };
  }
  // Pulseiras antigas/Code128: só o n.º de processo.
  return /^[\w-]{3,40}$/.test(c) ? { processo: c, nascimento: null } : null;
}

export interface Gs1 { gtin?: string; lote?: string; validade?: Date; serie?: string }

const GS = '\u001d';
/** AIs de comprimento fixo que interessam (sem FNC1 a seguir). */
const FIXOS: Record<string, number> = { '01': 14, '17': 6, '11': 6, '15': 6 };

function dataGs1(aammdd: string): Date | undefined {
  if (!/^\d{6}$/.test(aammdd)) return undefined;
  const ano = 2000 + Number(aammdd.slice(0, 2));
  const mes = Number(aammdd.slice(2, 4));
  const dia = Number(aammdd.slice(4, 6));
  if (mes < 1 || mes > 12) return undefined;
  // Dia 00 = último dia do mês (regra GS1).
  return dia === 0 ? new Date(Date.UTC(ano, mes, 0, 23, 59, 59)) : new Date(Date.UTC(ano, mes - 1, dia, 23, 59, 59));
}

/**
 * GS1 (DataMatrix das embalagens, Directiva de Medicamentos Falsificados): GTIN (01),
 * validade (17), lote (10), série (21). Aceita a forma legível "(01)…(17)…" e a forma em bruto
 * com separador FNC1/GS (e o prefixo de simbologia "]d2" que alguns leitores enviam).
 */
export function lerGs1(codigo: string): Gs1 | null {
  let c = (codigo ?? '').trim();
  if (!c) return null;
  const r: Gs1 = {};
  if (c.includes('(')) {
    for (const m of c.matchAll(/\((\d{2,4})\)([^(]+)/g)) aplicar(r, m[1], m[2].trim());
    return r.gtin ? r : null;
  }
  c = c.replace(/^\]d2|^\]C1|^\]Q3/, '');
  if (!/^(01|17|10|21)/.test(c)) return null;
  let i = 0;
  while (i < c.length) {
    const ai = c.slice(i, i + 2);
    i += 2;
    if (FIXOS[ai]) { aplicar(r, ai, c.slice(i, i + FIXOS[ai])); i += FIXOS[ai]; continue; }
    if (ai === '10' || ai === '21') {
      const fim = c.indexOf(GS, i);
      const valor = fim < 0 ? c.slice(i) : c.slice(i, fim);
      aplicar(r, ai, valor);
      i = fim < 0 ? c.length : fim + 1;
      continue;
    }
    break; // AI desconhecido: pára (o que já se leu continua válido)
  }
  return r.gtin ? r : null;
}

function aplicar(r: Gs1, ai: string, valor: string) {
  if (ai === '01' && /^\d{14}$/.test(valor)) r.gtin = valor;
  else if (ai === '17') r.validade = dataGs1(valor);
  else if (ai === '10') r.lote = valor;
  else if (ai === '21') r.serie = valor;
}

/** GTIN-14 e EAN-13 identificam o mesmo produto ("0" à esquerda). */
export function variantesGtin(gtin: string): string[] {
  const g = gtin.replace(/\D/g, '');
  const v = new Set([g]);
  if (g.length === 14 && g.startsWith('0')) v.add(g.slice(1));
  if (g.length === 13) v.add(`0${g}`);
  return [...v];
}

/** Um código só com dígitos (EAN-13 sem GS1, ou código CHNM). */
export function eNumerico(codigo: string): boolean {
  return /^\d{6,14}$/.test((codigo ?? '').trim());
}
