import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  userId: string | null;
  nome: string | null;
  role: string | null;
  ip: string | null;
  userAgent: string | null;
  correlationId: string | null;
}

/**
 * Contexto do pedido atual (quem/de-onde) propagado por AsyncLocalStorage — o mesmo mecanismo
 * do TenantContextService. Serve para atribuir a auditoria de escritas (via `SET LOCAL` para os
 * triggers) e o trilho de leituras, sem passar o contexto à mão por todas as camadas.
 *
 * Ainda NÃO é consumido por nada — é fundação. Só quando o mecanismo do "quem" estiver provado
 * é que passa a alimentar os triggers/logger.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  run<T>(ctx: RequestContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }
}
