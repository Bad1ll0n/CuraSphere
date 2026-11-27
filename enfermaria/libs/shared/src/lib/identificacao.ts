/**
 * UX-23 — identificação do utente na admissão administrativa (web e api usam a mesma regra).
 *
 * Antes o NIF e o nº SNS eram obrigatórios e o NIF só tinha de ter 9 dígitos: o doente não
 * identificado ou o estrangeiro sem SNS não se conseguia registar, e o contorno era inventar
 * "999999999" — que passava. Agora são opcionais, mas quando vêm são verificados a sério.
 */

/** NIF português: 9 dígitos, prefixo válido e dígito de controlo (módulo 11). */
export function nifValido(nif: string): boolean {
  const n = String(nif ?? '').replace(/\s/g, '');
  if (!/^\d{9}$/.test(n)) return false;
  // 1–3 e 5 singulares/coletivos, 6 Estado, 7x/8x/9x entidades e não residentes.
  if (!/^[1235689]|^45|^7[0-9]|^8[0-9]|^9[0-9]/.test(n)) return false;
  const soma = [...n.slice(0, 8)].reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === Number(n[8]);
}

/** Nº de utente do SNS: 9 dígitos. */
export function numeroSnsValido(sns: string): boolean {
  return /^\d{9}$/.test(String(sns ?? '').replace(/\s/g, ''));
}

/** Telefone nacional: 9 dígitos a começar por 2, 3 ou 9. */
export function telefoneValido(tel: string): boolean {
  return /^[239]\d{8}$/.test(String(tel ?? '').replace(/\s/g, ''));
}

/** Nome provisório de um utente não identificado: "Desconhecido 2026-11-05 #3". */
export function nomeProvisorio(dia: string, ordem: number): string {
  return `Desconhecido ${dia} #${ordem}`;
}

export const PREFIXO_PROVISORIO = 'Desconhecido ';
