// Role e SubRole são agora geridas dinamicamente via RoleConfig / SubRoleConfig na BD.
// As constantes abaixo são as 10 roles-categoria fixas usadas nos guards da API.

export const ROLES = {
  medico:         'medico',
  enfermeiro:     'enfermeiro',
  auxiliar:       'auxiliar',
  tecnico_saude:  'tecnico_saude',
  farmaceutico:   'farmaceutico',
  administrativo: 'administrativo',
  operacional:    'operacional',
  ti:             'ti',
  qualidade:      'qualidade',
  direcao:        'direcao',
} as const;

export type RoleKey = typeof ROLES[keyof typeof ROLES];

// Sub-roles privilegiados usados em guards específicos
export const SUBROLES = {
  it_admin:              'it_admin',
  medico_gestor:         'medico_gestor',
  supervisor_enfermagem: 'supervisor_enfermagem',
  cardiologista:         'cardiologista',
  neurologista:          'neurologista',
  chefe_enfermeiros:     'chefe_enfermeiros',
  tae:                   'tae',        // Técnico Ambulância Emergência
  tec_rad:               'tec_rad',    // Técnico Radiologia
} as const;

export type SubRoleKey = typeof SUBROLES[keyof typeof SUBROLES];

export enum Servico {
  internamento = 'internamento',
  urgencia = 'urgencia',
  bloco_operatorio = 'bloco_operatorio',
  consultas_externas = 'consultas_externas',
  farmacia = 'farmacia',
  fisioterapia = 'fisioterapia',
  transporte = 'transporte',
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
