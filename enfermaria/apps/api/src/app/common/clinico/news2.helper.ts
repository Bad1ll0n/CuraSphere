// UX-16: o cálculo do NEWS2 passou para libs/shared, para a web o mostrar em direto no formulário
// de sinais vitais com exatamente a mesma regra da API. Este módulo mantém os imports existentes.
export {
  NEWS2_PARAMETROS, NEWS2_LABELS, NEWS2_LIMIAR_ESCALADA, NEWS2_LIMIAR_CRITICO,
  calcularNEWS2Detalhado, calcularNEWS2,
} from '@org/shared';
export type { News2Params, News2Parametro, News2Detalhe } from '@org/shared';
