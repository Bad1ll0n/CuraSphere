import { BadRequestException } from '@nestjs/common';

/**
 * PROD-16 — hora do ATO declarada pelo cliente (registo à cabeceira, possivelmente offline).
 *
 * Um ato feito sem rede às 03:10 e sincronizado às 07:45 tem de ficar às 03:10: é dessa hora
 * que se conta a próxima dose SOS e a tendência do NEWS2, e é essa que vale no registo
 * médico-legal. Mas a hora vem do dispositivo, por isso aceita-se só dentro de uma janela:
 *  - no futuro, até 5 minutos (desvio de relógio); mais do que isso é relógio errado;
 *  - no passado, até `JANELA_REGISTO_DIFERIDO_H` horas (12 por omissão) — um turno e pouco.
 *    O que for mais antigo já não é "sincronização atrasada": é um registo retrospetivo, que
 *    se faz como nota, não com a hora reescrita.
 */
export const TOLERANCIA_RELOGIO_MS = 5 * 60_000;
/** A partir de quanto tempo de atraso o registo se mostra como "registo diferido". */
export const LIMIAR_DIFERIDO_MS = 10 * 60_000;

export function janelaRegistoDiferidoMs(): number {
  const horas = Number(process.env['JANELA_REGISTO_DIFERIDO_H'] ?? 12);
  return (Number.isFinite(horas) && horas > 0 ? horas : 12) * 3_600_000;
}

/**
 * Devolve o instante do ato (ou `agora`, se não foi declarado). Lança 400 se a hora for
 * inválida, estiver no futuro além da tolerância ou for mais antiga do que a janela.
 */
export function resolverHoraDoAto(declarada: string | Date | undefined | null, agora = new Date()): Date {
  if (declarada == null || declarada === '') return agora;
  const instante = declarada instanceof Date ? declarada : new Date(declarada);
  if (Number.isNaN(instante.getTime())) throw new BadRequestException('Hora do ato inválida.');
  if (instante.getTime() > agora.getTime() + TOLERANCIA_RELOGIO_MS) {
    throw new BadRequestException('A hora do ato está no futuro — verifique o relógio do dispositivo.');
  }
  const janela = janelaRegistoDiferidoMs();
  if (agora.getTime() - instante.getTime() > janela) {
    throw new BadRequestException(
      `A hora do ato tem mais de ${Math.round(janela / 3_600_000)} h — registe-o como nota retrospetiva, não com a hora do ato.`,
    );
  }
  return instante;
}

/** O registo chegou ao servidor bem depois do ato (offline, sincronização atrasada). */
export function eRegistoDiferido(ocorridoEm: Date, registadoEm: Date): boolean {
  return registadoEm.getTime() - ocorridoEm.getTime() > LIMIAR_DIFERIDO_MS;
}

/** Distância (em minutos) do instante à administração mais próxima — antes ou depois dele. */
export function minutosAoRegistoMaisProximo(instantes: Date[], momento: Date): number | null {
  if (!instantes.length) return null;
  return Math.min(...instantes.map((d) => Math.abs(momento.getTime() - d.getTime()))) / 60_000;
}

/**
 * PROD-16: um ato registado em diferido (offline) passa pelos mesmos 5 certos que o online.
 * A via offline enviava só `{ doenteId }` — sem leitura, etiqueta nem atestação, a
 * administração entrava como "não confirmada" horas depois, sem ninguém a ver o aviso.
 */
export function exigirCertosSeDiferido(ocorridoEm: Date, comEvidencia: boolean, agora = new Date()): void {
  if (comEvidencia || !eRegistoDiferido(ocorridoEm, agora)) return;
  throw new BadRequestException(
    'REGISTO_DIFERIDO: uma administração registada depois do ato tem de trazer os 5 certos confirmados à cabeceira (leitura, etiqueta ou atestação do enfermeiro).',
  );
}
