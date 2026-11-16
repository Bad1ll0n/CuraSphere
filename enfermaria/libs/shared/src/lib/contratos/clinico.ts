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
  administradoEm: D;
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
