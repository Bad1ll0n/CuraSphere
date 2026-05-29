export type TipoTarefa = 'clinica' | 'logistica';

export type PrioridadeTarefa = 'baixa' | 'media' | 'alta' | 'urgente';

export type EstadoTarefa = 'pendente' | 'em_progresso' | 'concluida' | 'cancelada';

export interface Tarefa {
  id: string;
  doenteId: string;
  descricao: string;
  tipo: TipoTarefa | string;
  prioridade: PrioridadeTarefa | string;
  estado: EstadoTarefa | string;
  prazo?: string | null;
  criadaEm: string;
  concluidaEm?: string | null;
  responsavel?: { id: string; nome: string; role: string } | null;
  criadoPor?: { id: string; nome: string; role: string } | null;
  doente?: { id: string; nome: string } | null;
}
