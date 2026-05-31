export interface Notificacao {
  id: string;
  titulo: string;
  corpo: string;
  tipo?: string;
  lida: boolean;
  criadaEm: string;
  lidaEm?: string;
  dadosExtra?: Record<string, unknown>;
}

export interface NotificacoesPaginadas {
  total: number;
  naoLidas: number;
  pagina: number;
  totalPaginas: number;
  notificacoes: Notificacao[];
}
