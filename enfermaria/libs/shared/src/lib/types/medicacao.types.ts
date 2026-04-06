export interface Medicacao {
  id: string;
  doenteId: string;
  nome: string;
  dose: string;
  via: string; // ex: oral, intravenosa, subcutânea
  frequencia: string; // ex: 8/8h, 12/12h
  prescritoPorId: string; // id do médico
  ativo: boolean;
  iniciadoEm: Date;
  terminadoEm?: Date;
}

export interface RegistoMedicacao {
  id: string;
  medicacaoId: string;
  doenteId: string;
  administradoPorId: string; // id do enfermeiro
  administradoEm: Date;
  observacoes?: string;
}
