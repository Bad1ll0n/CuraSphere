import { Logger } from '@nestjs/common';
import { Counter } from 'prom-client';

/**
 * ARQ-07 — falhas tratadas, mas nunca em silêncio.
 *
 * Havia dezenas de catches que devolviam null sem mais nada: um passo acessório falhava (registo de uma decisão de IA,
 * métricas de IA, um webhook, a criação de um alerta de sépsis, um lembrete…) e ninguém sabia —
 * nem no log, nem nas métricas. Continuam a não interromper o fluxo principal, mas agora cada uma
 * fica no log com o contexto e conta em `curasphere_falhas_tratadas_total{contexto}` (com um alerta
 * no Prometheus quando cresce). Ver o MetricsService, que regista o contador.
 */
export const contadorFalhas = new Counter({
  name: 'curasphere_falhas_tratadas_total',
  help: 'Falhas de passos acessórios que não interromperam o pedido (por contexto) — ARQ-07',
  labelNames: ['contexto', 'gravidade'],
  registers: [],
});

const logger = new Logger('FalhaTratada');

/** Severidade: `erro` para o que tem impacto clínico ou de auditoria; `aviso` para o resto. */
export type GravidadeFalha = 'erro' | 'aviso';

/** Para `.catch(...)`: regista a falha (log + métrica) e devolve `null`. */
export function registarFalha(contexto: string, gravidade: GravidadeFalha = 'aviso') {
  return (erro: unknown): null => {
    falhaTratada(contexto, erro, gravidade);
    return null;
  };
}

/** Para blocos `try/catch`: o mesmo, sem devolver nada. */
export function falhaTratada(contexto: string, erro: unknown, gravidade: GravidadeFalha = 'aviso'): void {
  contadorFalhas.inc({ contexto, gravidade });
  const msg = `${contexto}: ${(erro as Error)?.message ?? String(erro)}`;
  if (gravidade === 'erro') logger.error(msg, (erro as Error)?.stack);
  else logger.warn(msg);
}
