export type EstadoDoente = 'estavel' | 'critico' | 'grave' | 'alta_prevista';

export type EstadoCama = 'livre' | 'ocupada' | 'em_limpeza' | 'reservada';

export interface Cama {
  id: string;
  numero: string;
  quarto: string;
  estado: EstadoCama;
  doenteId?: string;
}

export interface Doente {
  id: string;
  nome: string;
  dataNascimento: Date;
  numeroProcesso: string;
  estado: EstadoDoente;
  diagnosticoPrincipal: string;
  camaId: string;
  enfermeirosAtribuidos: string[]; // ids dos enfermeiros
  medicoAtribuido?: string;        // id do médico
  dataAdmissao: Date;
  dataAltaPrevista?: Date;
  dataAlta?: Date;
  administrativoAdmissaoId: string;
  ativo: boolean;
}
