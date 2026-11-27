import { Injectable } from '@nestjs/common';
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
    const ctx = this.storage.getStore();
    if (ctx) ctx.tenantId = tenantId;
  }
}
