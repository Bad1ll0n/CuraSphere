export enum Role {
  enfermeiro = 'enfermeiro',
  auxiliar = 'auxiliar',
  medico = 'medico',
  chefe_turno = 'chefe_turno',
  chefe_enfermeiros = 'chefe_enfermeiros',
  chefe_medicos = 'chefe_medicos',
  administrativo = 'administrativo',
}

export enum EstadoDoente {
  estavel = 'estavel',
  grave = 'grave',
  critico = 'critico',
  alta_prevista = 'alta_prevista',
}

export enum EstadoCama {
  livre = 'livre',
  ocupada = 'ocupada',
  em_limpeza = 'em_limpeza',
  reservada = 'reservada',
}

export enum TipoTarefa {
  clinica = 'clinica',
  logistica = 'logistica',
}

export enum PrioridadeTarefa {
  baixa = 'baixa',
  media = 'media',
  alta = 'alta',
  urgente = 'urgente',
}

export enum EstadoTarefa {
  pendente = 'pendente',
  em_progresso = 'em_progresso',
  concluida = 'concluida',
  cancelada = 'cancelada',
}

export enum TipoTurno {
  manha = 'manha',
  tarde = 'tarde',
  noite = 'noite',
}
