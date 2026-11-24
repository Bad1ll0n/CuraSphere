import { ForbiddenException, Injectable } from '@nestjs/common';

/** ARQ-21: uma instalação serve um hospital — ver instalacao-unica.service.ts. */
export const TENANT_UNICO = 'default';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContextService {
  // Objecto mutável: o middleware abre o contexto com o tenant por omissão e o
  // `ContextoPedidoInterceptor` define-o depois da autenticação (SEC-07).
  private readonly storage = new AsyncLocalStorage<{ tenantId: string }>();

  get tenantId(): string {
    return this.storage.getStore()?.tenantId ?? 'default';
  }

  runWithTenant<T>(tenantId: string, fn: () => T): T {
    return this.storage.run({ tenantId }, fn);
  }

  /** Define o tenant do pedido actual a partir da sessão verificada. */
  definir(tenantId: string): void {
    // ARQ-21: falha fechada — um tenant que não é o desta instalação não lê nada.
    if (tenantId !== TENANT_UNICO) throw new ForbiddenException('Sessão de outra instalação');
    const ctx = this.storage.getStore();
    if (ctx) ctx.tenantId = tenantId;
  }
}
