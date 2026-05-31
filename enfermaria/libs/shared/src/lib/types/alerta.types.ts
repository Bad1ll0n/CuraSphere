export interface AlertaClinico {
  id: string;
  doenteId: string;
  tipo: string;
  mensagem: string;
  urgencia: boolean;
  lido: boolean;
  criadoEm: string;
  acusadoEm?: string | null;
  acusadoPor?: { id: string; nome: string } | null;
}
