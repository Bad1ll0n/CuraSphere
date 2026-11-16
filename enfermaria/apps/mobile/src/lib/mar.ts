import type { LinhaMar } from '@org/shared';

/**
 * Administrada hoje = há um registo de hoje que não é uma não-administração (recusa,
 * contraindicação…). Calculado a partir dos registos que a api devolve (contrato LinhaMar).
 */
export function administradaHoje(m: Pick<LinhaMar, 'registos'>, agora = new Date()): boolean {
  const hoje = agora.toDateString();
  return m.registos.some((r) => !r.naoAdministrada && new Date(r.administradoEm).toDateString() === hoje);
}
