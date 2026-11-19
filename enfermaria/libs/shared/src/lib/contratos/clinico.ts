/**
 * ARQ-12 — contrato tipado entre a api e os clientes (web, mobile) para as respostas clínicas
 * mais usadas. A api declara o tipo de retorno com estes tipos (D = Date) e os clientes leem
 * com os mesmos tipos (D = string, como chega em JSON). Se a api mudar a forma de uma resposta
 * sem mudar o contrato, a compilação da api falha; se o contrato mudar, falham os clientes que
 * dependem do campo. Antes, cada ecrã redeclarava a sua `interface` à mão.
 *
 * `D` é o tipo das datas: `Date` no servidor, `string` (ISO 8601) depois de serializado.
 */

export type Tendencia = 'sobe' | 'desce' | 'igual';

export interface CamaResumo {
  numero: string;
  quarto: string;
  servico?: string | null;
}

export interface News2Resumo<D = string> {
  valor: number | null;
  em: D;
  tendencia: Tendencia | null;
}

/** GET /resumo/doente/:id/faixa — faixa de identificação (UX-29). */
export interface FaixaDoente<D = string> {
  id: string;
  nome: string;
  numeroProcesso: string;
  idade: number | null;
  dataNascimento: D | null;
  sexo: string | null;
  estado: string;
  cama: CamaResumo | null;
  pesoKg: number | null;
  alergias: { estado: string; lista: { alergenio: string; severidade: string }[] };
  isolamento: string | null;
  naoReanimar: { em: D | null } | null;
  riscoQueda: { risco: string; pontuacao: number } | null;
  riscoUlcera: { risco: string; pontuacao: number } | null;
  news2: News2Resumo<D> | null;
  sinalizacoes: { motivo: string; nivelUrgencia: string }[];
}

/** Uma linha de "O meu turno" (UX-30). */
export interface LinhaMeuTurno<D = string> {
  doente: {
    id: string;
    nome: string;
    numeroProcesso: string;
    idade: number | null;
    estado: string;
    cama: CamaResumo | null;
    isolamento: boolean;
    naoReanimar: boolean;
    /** null = alergias não avaliadas; [] = sem alergias conhecidas. */
    alergias: string[] | null;
  };
  medicacao: { devidas: number; emAtraso: number };
  /** PROD-07: intervenções do plano de cuidados devidas / em atraso no turno. */
  cuidados: { devidas: number; emAtraso: number };
  observacoesEmAtraso: { tipo: string; motivo: string; atrasoMinutos: number }[];
  news2: News2Resumo<D> | null;
  tarefas: { pendentes: number; urgentes: number };
}

/** GET /resumo/meu-turno */
export interface MeuTurno<D = string> {
  doentes: LinhaMeuTurno<D>[];
}

/** GET /resumo/doente/:id/pulseira (UX-08). */
export interface PulseiraDoente<D = string> {
  conteudo: string;
  nome: string;
  numeroProcesso: string;
  dataNascimento: D | null;
  sexo: string | null;
  temAlergias: boolean;
  alergiasAvaliadas: boolean;
}

/** Resultado de uma leitura à cabeceira (UX-08). */
export interface ResultadoLeitura<D = string> {
  ok: boolean;
  motivo: string;
  origem?: 'etiqueta' | 'gs1' | 'codigo';
  lote?: string | null;
  validade?: D | null;
}

/** POST /medicacao/:id/verificar-leitura */
export interface VerificacaoLeitura<D = string> {
  pulseira?: ResultadoLeitura<D>;
  medicamento?: ResultadoLeitura<D>;
}

/** GET /medicacao/:id/etiqueta — etiqueta de unidose com QR assinado (UX-08). */
export interface EtiquetaUnidose {
  qrPayload: string;
  medicacaoId: string;
  doenteId: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  doente: { nome: string; numeroProcesso: string };
  emitidoEm: string;
}

/** Um registo de administração (ou de não-administração) como o MAR o mostra. */
export interface RegistoMar<D = string> {
  id: string;
  /** PROD-16: hora do ato (declarada à cabeceira). */
  administradoEm: D;
  /** PROD-16: hora a que o registo chegou ao servidor — se for bem depois do ato, é "registo diferido". */
  registadoEm: D;
  administradoPor: { nome: string };
  observacoes: string | null;
  verificacao5Certas: boolean;
  naoAdministrada: boolean;
  motivoNaoAdmin: string | null;
}

/** GET /medicacao/mar — uma prescrição ativa de um doente do turno, com os últimos 5 registos. */
export interface LinhaMar<D = string> {
  id: string;
  nome: string;
  dose: string;
  via: string;
  frequencia: string;
  iniciadoEm: D;
  estadoValidacao: string | null;
  doente: { id: string; nome: string; cama: { numero: string; quarto: string } | null };
  prescritoPor: { nome: string } | null;
  /** Mais recentes primeiro. */
  registos: RegistoMar<D>[];
}

// ─── PROD-07 — processo de enfermagem ─────────────────────────────────────────

export type EstadoRegistoDevido = 'devida' | 'em_atraso' | 'realizada';

export interface IntervencaoPlano<D = string> {
  id: string;
  termo: string;
  frequencia: string;
  estado: string;
  iniciadaEm: D;
  /** Registos devidos na janela do turno (4 h para trás, 1 h para a frente). SOS: vazio. */
  devidas: { hora: D; estado: EstadoRegistoDevido }[];
  ultimaExecucao: { em: D; por: string; realizada: boolean; nota: string | null } | null;
}

export interface DiagnosticoPlano<D = string> {
  id: string;
  termo: string;
  juizo: string | null;
  origem: string;
  estado: string;
  resultadoEsperado: string | null;
  identificadoEm: D;
  identificadoPor: string;
  intervencoes: IntervencaoPlano<D>[];
  ultimaAvaliacao: { evolucao: string; em: D; nota: string | null } | null;
}

export interface SugestaoCuidados {
  diagnostico: string;
  juizo: string;
  conjunto: string | null;
  motivo: string;
  origemRef: string;
}

/** GET /processo-enfermagem/doente/:id/plano */
export interface PlanoCuidados<D = string> {
  avaliacaoInicial: { id: string; completa: boolean; atualizadaEm: D; por: string } | null;
  diagnosticos: DiagnosticoPlano<D>[];
  sugestoes: SugestaoCuidados[];
  resumo: { devidas: number; emAtraso: number };
}

export interface ItemCatalogoCuidados {
  id: string;
  tipo: 'diagnostico' | 'intervencao';
  termo: string;
  foco: string | null;
  codigoCipe: string | null;
  frequenciaSugerida: string | null;
}

export interface ConjuntoCuidadosResumo {
  id: string;
  nome: string;
  descricao: string | null;
}

/** PROD-15 — GET /monitorizacao/doente/:doenteId/leituras-pendentes: leitura de monitor à espera de validação. */
export interface LeituraMonitorPendente<D = string> {
  id: string;
  dispositivoId: string;
  canal: 'monitor' | 'fhir' | string;
  medidoEm: D;
  recebidaEm: D;
  valores: Partial<Record<'pressaoSistolica' | 'pressaoDiastolica' | 'pulso' | 'temperatura' | 'saturacaoO2' | 'frequenciaRespiratoria', number>> & { avpu?: string };
  /** Algum valor na banda crítica — já gerou alerta a pedir confirmação à cabeceira. */
  critica: boolean;
}

/** PROD-15 — resposta da validação em lote. */
export interface ResultadoValidacaoLeituras {
  validadas: number;
  falhas: { id: string; motivo: string }[];
}

/** PROD-13 — referenciação para a continuidade de cuidados (RNCCI, CSP, apoio social). */
export interface ReferenciacaoContinuidade<D = string> {
  id: string;
  destino: string;
  estado: 'proposta' | 'enviada' | 'aceite' | 'vaga_atribuida' | 'recusada' | 'cancelada';
  motivo: string;
  nota: string | null;
  criadaEm: D;
  enviadaEm: D | null;
  aceiteEm: D | null;
  vagaEm: D | null;
  fechadaEm: D | null;
  criadaPor: { id: string; nome: string };
}

/** PROD-13 — ensino ao doente/cuidador, com a verificação da compreensão (teach-back). */
export interface EnsinoDoente<D = string> {
  id: string;
  tema: string;
  titulo: string;
  destinatario: 'doente' | 'cuidador' | 'ambos';
  cuidadorNome: string | null;
  compreensao: 'compreendeu' | 'parcial' | 'nao_compreendeu';
  nota: string | null;
  realizadoEm: D;
  realizadoPor: { id: string; nome: string };
}

/** PROD-13 — GET /planeamento-alta/doente/:doenteId */
export interface ResumoPlaneamentoAlta<D = string> {
  internado: boolean;
  altaClinicaEm: D | null;
  diasAposAltaClinica: number | null;
  barthel: { pontuacao: number | null; registadaEm: D } | null;
  sinalizacao: { motivo: 'dependencia' | 'sem_cuidador' | 'ensino_nao_compreendido' | 'sem_avaliacao_inicial'; detalhe: string }[];
  referenciacoes: ReferenciacaoContinuidade<D>[];
  ensinos: EnsinoDoente<D>[];
}

/** PROD-13 — GET /planeamento-alta/catalogo */
export interface CatalogoPlaneamentoAlta {
  destinos: { codigo: string; nome: string }[];
  temasEnsino: { codigo: string; titulo: string; pontos: string[] }[];
}

/** PROD-13 — GET /planeamento-alta/altas-proteladas */
export interface AltasProteladas<D = string> {
  doentes: number;
  diasTotal: number;
  linhas: {
    doenteId: string; nome: string; numeroProcesso: string; cama: string | null; servico: string | null;
    altaClinicaEm: D; dias: number; aguarda: { destino: string; estado: string }[];
  }[];
}
