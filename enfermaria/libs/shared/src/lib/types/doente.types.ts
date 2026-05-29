export type EstadoDoente = 'estavel' | 'critico' | 'grave' | 'alta_prevista';

export type EstadoCama = 'disponivel' | 'ocupada' | 'em_limpeza' | 'em_manutencao' | 'reservada';

export interface Cama {
  id: string;
  numero: string;
  quarto: string;
  estado: EstadoCama | string;
  doenteId?: string | null;
}

export interface Doente {
  id: string;
  nome: string;
  dataNascimento: string;
  numeroProcesso?: string | null;
  estado: EstadoDoente | string;
  estadoRegisto?: string | null;
  diagnosticoPrincipal?: string | null;
  camaId?: string | null;
  cama?: Cama | null;
  dataAdmissao: string;
  dataAltaPrevista?: string | null;
  dataAlta?: string | null;
  ativo: boolean;
}

export interface DoenteListItem {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  estadoRegisto: string;
  diagnosticoPrincipal: string;
  dataAdmissao: string;
  cama?: { id: string; numero: string; quarto: string } | null;
}

export interface DoentesPaginados {
  data: DoenteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
}
