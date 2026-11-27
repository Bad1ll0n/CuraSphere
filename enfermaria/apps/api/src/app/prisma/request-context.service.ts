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
 * O middleware abre o contexto (vazio) no início do pedido; o `ContextoPedidoInterceptor`
 * preenche o utilizador depois da autenticação, a partir de `req.user` (SEC-07) — o objecto
 * guardado no ALS é o mesmo, por isso a escrita é vista por tudo o que corre a seguir.
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

  /** Preenche o utilizador do pedido actual (sessão já verificada). Sem contexto, não faz nada. */
  definirUtilizador(u: { userId: string | null; nome: string | null; role: string | null }): void {
    const ctx = this.storage.getStore();
    if (!ctx) return;
    ctx.userId = u.userId;
    ctx.nome = u.nome;
    ctx.role = u.role;
  }
}
