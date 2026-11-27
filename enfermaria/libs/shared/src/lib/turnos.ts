/**
 * UX-12 — a definição dos turnos, numa só fonte.
 *
 * Havia sete cópias com fronteiras diferentes: o MAR com a tarde até às 23 e a noite das 23 às 08,
 * a timeline de medicação com a tarde até às 24, e a api com a tarde até às 23:00, 23:30 ou 24:00
 * conforme o ficheiro. Uma toma das 23:30 caía em turnos diferentes conforme o ecrã.
 *
 * Convenção:
 *  - horas de serviço: manhã 08–16, tarde 16–24, noite 00–08;
 *  - na escala, a noite tem a data da véspera (a noite de dia 5 é das 00:00 às 08:00 de dia 6),
 *    que é como as regras da escala já a tratam ("a seguir a uma noite não faz manhã");
 *  - passagem de turno: durante os 30 minutos a seguir ao fim de um turno, quem sai ainda está
 *    "em passagem" — vê os seus doentes e acaba os registos —, mas o turno em curso já é o novo.
 */

import type { TipoTurno } from './types/turno.types.js';


export const TIPOS_TURNO: readonly TipoTurno[] = ['manha', 'tarde', 'noite'];

/** Horas de serviço (fim exclusivo). */
export const HORAS_TURNO: Record<TipoTurno, { inicio: number; fim: number }> = {
  manha: { inicio: 8, fim: 16 },
  tarde: { inicio: 16, fim: 24 },
  noite: { inicio: 0, fim: 8 },
};

/** Minutos, depois do fim do turno, em que quem sai ainda está em passagem. */
export const MINUTOS_PASSAGEM = 30;

export const ROTULO_TURNO: Record<TipoTurno, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

const hh = (h: number) => String(h % 24).padStart(2, '0');

/** "Manhã (08–16)", "Tarde (16–24)", "Noite (00–08)". */
export function rotuloTurnoComHoras(tipo: TipoTurno): string {
  const { inicio, fim } = HORAS_TURNO[tipo];
  return `${ROTULO_TURNO[tipo]} (${hh(inicio)}–${fim === 24 ? '24' : hh(fim)})`;
}

/** O turno a que pertence uma hora do dia (0–23), sem passagem. */
export function turnoDaHora(hora: number): TipoTurno {
  if (hora >= HORAS_TURNO.manha.inicio && hora < HORAS_TURNO.manha.fim) return 'manha';
  if (hora >= HORAS_TURNO.tarde.inicio) return 'tarde';
  return 'noite';
}

export interface TurnoDeEscala {
  tipo: TipoTurno;
  /** Dias a subtrair ao dia de calendário para obter a data do turno na escala (0 ou 1). */
  diasAtras: 0 | 1;
}

/**
 * O turno de escala em curso e, durante a passagem, o que está a sair — a partir dos minutos
 * desde a meia-noite na hora do hospital.
 */
export function turnoDeEscalaEmCurso(minutosDoDia: number): { emCurso: TurnoDeEscala; emPassagem: TurnoDeEscala | null } {
  const tipo = turnoDaHora(Math.floor(minutosDoDia / 60));
  const emCurso: TurnoDeEscala = { tipo, diasAtras: tipo === 'noite' ? 1 : 0 };
  const desdeInicio = minutosDoDia - HORAS_TURNO[tipo].inicio * 60;
  let emPassagem: TurnoDeEscala | null = null;
  if (desdeInicio >= 0 && desdeInicio < MINUTOS_PASSAGEM) {
    // manhã ← noite (da véspera); tarde ← manhã (de hoje); noite ← tarde (de ontem).
    emPassagem = tipo === 'manha' ? { tipo: 'noite', diasAtras: 1 }
      : tipo === 'tarde' ? { tipo: 'manha', diasAtras: 0 }
      : { tipo: 'tarde', diasAtras: 1 };
  }
  return { emCurso, emPassagem };
}

/**
 * Até quando um registo feito a uma dada hora pode ser editado: o fim do turno em que foi feito,
 * mais a passagem. Devolve os minutos a somar à meia-noite do dia do registo (pode passar de 24 h).
 */
export function minutosLimiteEdicao(minutosDoDia: number): number {
  const tipo = turnoDaHora(Math.floor(minutosDoDia / 60));
  return HORAS_TURNO[tipo].fim * 60 + MINUTOS_PASSAGEM;
}
