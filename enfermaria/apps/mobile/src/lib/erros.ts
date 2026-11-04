import * as Sentry from '@sentry/react-native';

/**
 * Falha que o ecrã não trata.
 *
 * A app tinha ~25 blocos `catch {}` à volta de carregamentos de dados clínicos. Quando um
 * falha, o ecrã fica vazio — e um ecrã vazio é indistinguível de "este doente não tem
 * registos". Num contexto clínico, essa ambiguidade é o problema: o enfermeiro conclui
 * que não há alergias registadas quando, na verdade, o pedido falhou.
 *
 * Esta função NÃO resolve isso: a correcção completa é cada ecrã ter estado de erro com
 * repetição, tal como foi feito na aplicação web. O que ela garante é o passo mínimo —
 * que a falha deixe de ser invisível e apareça na telemetria, em vez de desaparecer.
 *
 * Ao corrigir um ecrã a sério, esta chamada deve desaparecer com o `catch` que a contém.
 */
export function registarFalhaSilenciosa(contexto: string, erro: unknown): void {
  if (__DEV__) {
    console.warn(`[${contexto}] falha não tratada:`, erro);
  }
  Sentry.captureException(erro, {
    level: 'warning',
    tags: { contexto, tratamento: 'silencioso' },
  });
}
