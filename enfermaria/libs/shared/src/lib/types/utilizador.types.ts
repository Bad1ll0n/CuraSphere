export type Role =
  | 'enfermeiro'
  | 'auxiliar'
  | 'medico'
  | 'chefe_turno'
  | 'chefe_enfermeiros'
  | 'administrativo';

export interface Utilizador {
  id: string;
  numeroFuncionario: string;
  nome: string;
  role: Role;
  ordemExperiencia?: number; // definida pela chefe de enfermeiros (para determinar chefe de turno)
  ativo: boolean;
  criadoEm: Date;
}
