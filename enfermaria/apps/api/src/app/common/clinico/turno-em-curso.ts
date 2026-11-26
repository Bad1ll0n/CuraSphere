import { turnoDeEscalaEmCurso, type TipoTurno, type TurnoDeEscala } from '@org/shared';
import { chaveDiaClinico, minutosDoDiaClinico } from './dia-clinico.helper';

/**
 * UX-12 — o turno de escala em curso, numa só função (havia sete cópias, com a tarde a acabar às
 * 23:00, às 23:30 ou às 24:00 e a noite datada ora do próprio dia ora da véspera). A regra está
 * em `libs/shared/src/lib/turnos.ts`; aqui só se traduz para o filtro do `HorarioTurno`, cuja
 * `data` é a meia-noite UTC do dia da escala.
 */
export interface JanelaTurno {
  tipo: TipoTurno;
  /** Dia da escala (YYYY-MM-DD). */
  dia: string;
  data: { gte: Date; lte: Date };
}

function janela(agora: Date, t: TurnoDeEscala): JanelaTurno {
  const hoje = new Date(`${chaveDiaClinico(agora)}T00:00:00.000Z`);
  const gte = new Date(hoje.getTime() - t.diasAtras * 86_400_000);
  return { tipo: t.tipo, dia: gte.toISOString().slice(0, 10), data: { gte, lte: new Date(gte.getTime() + 86_400_000 - 1) } };
}

/** O turno em curso e, nos 30 min de passagem, o que está a sair. */
export function turnoEmCurso(agora: Date = new Date()): JanelaTurno & { emPassagem: JanelaTurno | null } {
  const { emCurso, emPassagem } = turnoDeEscalaEmCurso(minutosDoDiaClinico(agora));
  return { ...janela(agora, emCurso), emPassagem: emPassagem ? janela(agora, emPassagem) : null };
}

/** Filtro Prisma de `horarioTurno`: o turno em curso ou, durante a passagem, o que sai. */
export function filtroHorarioTurnoAtivo(agora: Date = new Date()) {
  const t = turnoEmCurso(agora);
  const janelas = [t, ...(t.emPassagem ? [t.emPassagem] : [])];
  return { OR: janelas.map((j) => ({ tipo: j.tipo, data: j.data })) };
}
