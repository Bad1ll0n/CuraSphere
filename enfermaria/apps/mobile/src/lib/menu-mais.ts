import { podeVerRota, type UtilizadorComPapel } from '@org/shared';

export type ItemMais =
  | 'horarios' | 'atribuicoes' | 'camas' | 'trocas' | 'utilizadores' | 'bancosangue'
  | 'turno' | 'passagem' | 'auditoria' | 'dashboardti' | 'pedidosti'
  | 'farmacia' | 'fisioterapia' | 'consultas' | 'urgencia'
  | 'salaespera' | 'iacs' | 'mar' | 'comunicacao'
  | 'ferias' | 'pedidosInternos' | 'interconsultas' | 'worklist'
  | 'especialidades' | 'bloco' | 'catalogo' | 'dashboardqualidade'
  | 'notificacoes' | 'dietas' | 'eventosadversos' | 'equipamentos' | 'consentimentos'
  | 'rh' | 'faturacao' | 'dashexecutivo' | 'relatorios' | 'conformidade';

/**
 * ARQ-24 — cada item do menu "Mais" é a funcionalidade de uma rota da web e segue a MESMA regra
 * de acesso (libs/shared/src/lib/permissoes.ts). Antes cada item tinha a sua regra escrita à mão
 * aqui, e divergia da web — e da API, que é quem decide de facto. `null` = todos os perfis.
 */
export const ROTA_DO_ITEM: Record<ItemMais, string | null> = {
  utilizadores: '/utilizadores',
  auditoria: '/auditoria',
  dashboardti: '/dashboard-ti',
  pedidosti: '/pedidos-ti',
  notificacoes: null, // as próprias notificações: toda a gente
  comunicacao: '/comunicacao',
  turno: '/meu-turno',
  passagem: '/passagem-turno',
  horarios: '/horarios',
  atribuicoes: '/atribuicoes',
  camas: '/camas',
  bancosangue: '/banco-sangue',
  trocas: '/trocas',
  iacs: '/iacs',
  mar: '/mar',
  urgencia: '/urgencia',
  salaespera: '/sala-espera',
  consultas: '/consultas',
  farmacia: '/farmacia',
  fisioterapia: '/fisioterapia',
  ferias: '/ferias',
  pedidosInternos: '/pedidos-internos',
  interconsultas: '/interconsultas',
  worklist: '/worklist',
  especialidades: '/especialidades',
  bloco: '/bloco',
  catalogo: '/catalogo',
  dashboardqualidade: '/dashboard-qualidade',
  dietas: '/dietas',
  eventosadversos: '/eventos-adversos',
  equipamentos: '/equipamentos',
  consentimentos: '/doentes', // consentimentos dos doentes: quem trabalha com o processo
  rh: '/rh',
  faturacao: '/faturacao',
  dashexecutivo: '/dashboard-executivo',
  relatorios: '/relatorios',
  conformidade: '/conformidade',
};

export function itemMaisVisivel(item: ItemMais, u: UtilizadorComPapel): boolean {
  const rota = ROTA_DO_ITEM[item];
  return rota === null || podeVerRota(rota, u);
}
