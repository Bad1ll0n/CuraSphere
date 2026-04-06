export type TipoTarefa = 'clinica' | 'logistica';

export type PrioridadeTarefa = 'baixa' | 'media' | 'alta' | 'urgente';

export type EstadoTarefa = 'pendente' | 'em_progresso' | 'concluida' | 'cancelada';

export interface Tarefa {
  id: string;
  doenteId: string;
  tipo: TipoTarefa;
  descricao: string;
  prioridade: PrioridadeTarefa;
  estado: EstadoTarefa;
  prazo?: Date;
  responsavelId: string;      // id do enfermeiro ou auxiliar responsável
  criadoPorId: string;        // id de quem criou (médico, enfermeiro ou auxiliar)
  turnoId: string;            // turno em que foi criada
  transitouDeTurno: boolean;  // se veio do turno anterior
  criadaEm: Date;
  concluidaEm?: Date;
}
