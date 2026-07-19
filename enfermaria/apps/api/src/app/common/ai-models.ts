/**
 * Fonte de verdade única para os IDs dos modelos de IA usados em toda a API.
 *
 * Centralizado para evitar "model drift" — antes o mesmo ID estava espalhado por
 * ~6 serviços e ficava para trás do estado-da-arte sem ninguém dar conta. Ao subir
 * de modelo, altera-se só aqui.
 *
 * Decisão de produto: raciocínio clínico usa Sonnet 5 (sem escalonar para Opus);
 * tarefas rápidas/estruturadas usam Haiku 4.5.
 */
export const AI_MODELS = {
  /** Raciocínio clínico (triagem, LOS, readmissão, carta de alta, análise de feridas…). */
  CLINICAL: 'claude-sonnet-5',
  /** Tarefas rápidas e de baixo risco (interações, sugestões estruturadas, resumos curtos). */
  FAST: 'claude-haiku-4-5-20251001',
} as const;

export type AiModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];
