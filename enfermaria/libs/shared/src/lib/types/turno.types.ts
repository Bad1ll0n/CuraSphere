export type TipoTurno = 'manha' | 'tarde' | 'noite';

export interface Turno {
  id: string;
  tipo: TipoTurno | string;
  dataInicio: string;
  dataFim: string;
  chefeTurnoId?: string | null;
  profissionaisIds?: string[];
  atribuicoes?: AtribuicaoDoente[];
}

export interface AtribuicaoDoente {
  doenteId: string;
  enfermeiroId: string;
}

export interface HorarioEntrada {
  id: string;
  turnoId: string;
  utilizadorId: string;
  checkInEm: string;
  passagemTurnoVista: boolean;
}

export interface NotaTurno {
  id: string;
  turnoId: string;
  doenteId: string;
  autorId: string;
  texto: string;
  criadaEm: string;
}

export interface PassagemTurno {
  turnoAnteriorId: string;
  turnoAtualId: string;
  doenteId: string;
  tarefasPendentes: string[];
  notas: NotaTurno[];
  estado: string;
}
