/**
 * PROD-20 / PROD-23 — âmbito do produto: "registo clínico de enfermagem e gestão do internamento".
 *
 * Os módulos abaixo não fazem parte desse núcleo: duplicam sistemas que o hospital já tem (ERP,
 * faturação por GDH no HIS, RH, *helpdesk*), ou são especialidades em protótipo (poucos
 * endpoints, sem profundidade clínica). Não se apagam — cada um pode ser **desligado por
 * instalação** com a flag `modulo.<id>` (Configurações → flags, papel TI/direção):
 *
 * - sem flag → ligado (compatível com as instalações existentes);
 * - flag existe e `enabled = false` → a API responde 404 em todas as rotas do módulo e a web
 *   tira-o do menu e mostra "módulo desligado" a quem abrir o endereço.
 *
 * Ver docs/AMBITO-PRODUTO.md.
 */
export interface ModuloOpcional {
  id: string;
  nome: string;
  /** Prefixos de rota da API (sem `/v1/`). */
  api: string[];
  /** Prefixos de rota da web. */
  web: string[];
  /** Porque não é núcleo. */
  motivo: string;
}

export const PREFIXO_FLAG_MODULO = 'modulo.';

export const MODULOS_OPCIONAIS: readonly ModuloOpcional[] = [
  { id: 'faturacao', nome: 'Faturação e tabela de atos', api: ['faturacao', 'atos-clinicos'], web: ['/faturacao', '/relatorios-financeiros', '/tabela-atos'],
    motivo: 'No SNS o internamento é financiado por GDH a partir da codificação no HIS; pagamentos ao balcão são do ERP do privado (PROD-23).' },
  { id: 'compras', nome: 'Fornecedores e encomendas', api: ['fornecedores'], web: ['/fornecedores'], motivo: 'Compras são do ERP.' },
  { id: 'equipamentos', nome: 'Equipamentos e manutenção', api: ['equipamentos'], web: ['/equipamentos'], motivo: 'Gestão de ativos é do sistema de manutenção.' },
  { id: 'ti', nome: 'Pedidos e incidentes de TI', api: ['pedidos-ti', 'incidentes-ti'], web: ['/pedidos-ti', '/incidentes-ti'], motivo: 'O hospital tem *helpdesk* próprio.' },
  { id: 'rh', nome: 'RH: formações, avaliações, contratos e bem-estar', api: ['rh/formacoes', 'rh/avaliacoes', 'rh/pessoal', 'rh/wellbeing'], web: [],
    motivo: 'Gestão de pessoas é do sistema de RH; ficam ausências, férias e trocas de folga, que afetam a escala.' },
  { id: 'maternidade', nome: 'Maternidade (protótipo)', api: ['maternidade'], web: [], motivo: 'Especialidade em protótipo (5 endpoints).' },
  { id: 'oncologia', nome: 'Oncologia (protótipo)', api: ['oncologia'], web: [], motivo: 'Especialidade em protótipo (5 endpoints).' },
  { id: 'dialise', nome: 'Diálise (protótipo)', api: ['dialise'], web: [], motivo: 'Especialidade em protótipo (2 endpoints).' },
  { id: 'triagem-portal', nome: 'Triagem por IA no portal', api: ['triagem-portal'], web: [], motivo: 'Decisão clínica por IA, desligada por omissão (PROD-19).' },
  { id: 'population-health', nome: 'Saúde populacional', api: ['population-health'], web: [], motivo: 'Sem consumidor na web (ARQ-16).' },
  { id: 'outcomes', nome: 'Outcomes clínicos', api: ['outcomes'], web: [], motivo: 'Sem consumidor na web (ARQ-16).' },
  { id: 'regras-clinicas', nome: 'Regras clínicas configuráveis', api: ['regras-clinicas'], web: [], motivo: 'Sem consumidor na web (ARQ-16); as regras escala → ação estão em escala-acoes (PROD-21).' },
  { id: 'lista-espera', nome: 'Lista de espera de consultas', api: ['lista-espera'], web: [], motivo: 'Consulta externa, fora do internamento; sem consumidor na web (ARQ-16).' },
];

export const flagDoModulo = (id: string) => `${PREFIXO_FLAG_MODULO}${id}`;

const casaPrefixo = (caminho: string, prefixo: string) => caminho === prefixo || caminho.startsWith(`${prefixo}/`);

/** Módulo opcional a que pertence um caminho da API (`/v1/faturacao/x` ou `faturacao/x`). */
export function moduloDaRotaApi(caminho: string): ModuloOpcional | undefined {
  const c = caminho.split('?')[0].replace(/^\/+/, '').replace(/^v\d+\//, '');
  return MODULOS_OPCIONAIS.find((m) => m.api.some((p) => casaPrefixo(c, p)));
}

/** Módulo opcional a que pertence uma rota da web. */
export function moduloDaRotaWeb(pathname: string): ModuloOpcional | undefined {
  const c = pathname.split('?')[0];
  return MODULOS_OPCIONAIS.find((m) => m.web.some((p) => casaPrefixo(c, p)));
}

/**
 * Ids dos módulos desligados, a partir do mapa de flags `{chave: ligada}` (GET /feature-flags/me).
 * Só conta como desligado quem tem a flag e ela está a `false` — sem flag, o módulo está ligado.
 */
export function modulosDesligados(flags: Record<string, boolean> | undefined): Set<string> {
  const fora = new Set<string>();
  for (const m of MODULOS_OPCIONAIS) if (flags?.[flagDoModulo(m.id)] === false) fora.add(m.id);
  return fora;
}
