export interface Medicacao {
  id: string;
  doenteId: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  prescritoPorId?: string | null;
  estado?: string | null;
  ativo: boolean;
  iniciadoEm?: string | null;
  terminadoEm?: string | null;
  observacoes?: string | null;
}

export interface RegistoMedicacao {
  id: string;
  medicacaoId: string;
  doenteId: string;
  administradoPorId: string;
  administradoEm: string;
  observacoes?: string | null;
}
