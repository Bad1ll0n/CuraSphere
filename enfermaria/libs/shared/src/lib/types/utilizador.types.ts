export type Role =
  | 'medico'
  | 'enfermeiro'
  | 'auxiliar'
  | 'tecnico_saude'
  | 'farmaceutico'
  | 'administrativo'
  | 'operacional'
  | 'ti'
  | 'qualidade'
  | 'direcao';

export interface Utilizador {
  id: string;
  nome: string;
  numeroFuncionario: string;
  email?: string;
  role: Role | string;
  subRole?: string | null;
  servico?: string | null;
  mfaAtivo?: boolean;
  ativo?: boolean;
  criadoEm?: string;
}
