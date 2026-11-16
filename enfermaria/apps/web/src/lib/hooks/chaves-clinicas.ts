/**
 * Chaves de react-query dos dados clínicos do turno. Ficheiro sem dependências do browser para
 * poder ser usado também nos Server Components que pré-carregam os dados (PERF-12).
 */
export const chavesClinicas = {
  meuTurno: ['resumo', 'meu-turno'] as const,
  faixa: (doenteId: string) => ['resumo', 'faixa', doenteId] as const,
  pulseira: (doenteId: string) => ['resumo', 'pulseira', doenteId] as const,
  etiqueta: (medicacaoId: string) => ['medicacao', 'etiqueta', medicacaoId] as const,
  mar: ['medicacao', 'mar'] as const,
};
