export type TipoTurno = 'manha' | 'tarde' | 'noite';

export interface Turno {
  id: string;
  tipo: TipoTurno;
  dataInicio: Date;
  dataFim: Date;
  chefeTurnoId: string;           // determinado automaticamente pela ordem de experiência
  profissionaisIds: string[];     // todos os profissionais no turno
  atribuicoes: AtribuicaoDoente[];
}

export interface AtribuicaoDoente {
  doenteId: string;
  enfermeiroId: string;
}

export interface HorarioEntrada {
  id: string;
  turnoId: string;
  utilizadorId: string;
  checkInEm: Date;
  passagemTurnoVista: boolean; // confirmou que viu a passagem de turno
}

export interface NotaTurno {
  id: string;
  turnoId: string;
  doenteId: string;
  autorId: string;
  texto: string;
  criadaEm: Date;
}

export interface PassagemTurno {
  turnoAnteriorId: string;
  turnoAtualId: string;
  doenteId: string;
  tarefasPendentes: string[];  // ids de tarefas
  notas: NotaTurno[];
  estado: string;
}
