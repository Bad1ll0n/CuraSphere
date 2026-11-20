export interface Notificacao {
  id: string;
  titulo: string;
  corpo: string;
  tipo?: string;
  /** UX-11: crítico / aviso / informativo. */
  nivel?: 'critico' | 'aviso' | 'informativo';
  /** UX-11: o doente a que se refere (o clique abre a ficha). */
  doenteId?: string;
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
