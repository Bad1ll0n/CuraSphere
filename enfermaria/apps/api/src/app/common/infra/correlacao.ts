import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * OPS-07 — id de correlação do pedido.
 *
 * Antes, o `x-correlation-id` do CLIENTE era aceite tal como vinha (qualquer tamanho e
 * conteúdo, direto para os logs e para a auditoria), o nginx não gerava nenhum e a API não o
 * devolvia — quem via um erro não tinha como citá-lo ao suporte.
 *
 * Agora: aceita-se o id que vem do nginx (`$request_id`) ou do cliente só se tiver um formato
 * seguro; caso contrário gera-se um. É devolvido em `X-Correlation-Id` em todas as respostas.
 */
const FORMATO = /^[A-Za-z0-9._-]{1,64}$/;

export function idCorrelacaoValido(valor: unknown): string | null {
  return typeof valor === 'string' && FORMATO.test(valor) ? valor : null;
}

/** `genReqId` do pino-http: corre uma vez por pedido, antes de tudo o resto. */
export function gerarIdCorrelacao(req: IncomingMessage, res: ServerResponse): string {
  const id = idCorrelacaoValido(req.headers['x-correlation-id']) ?? randomUUID();
  if (!res.headersSent) res.setHeader('X-Correlation-Id', id);
  return id;
}

/** O id já atribuído ao pedido (pelo pino-http), ou um válido do cabeçalho. */
export function idCorrelacaoDoPedido(req: IncomingMessage & { id?: unknown }): string | null {
  return idCorrelacaoValido(req.id) ?? idCorrelacaoValido(req.headers['x-correlation-id']);
}
