import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<string>();

  get tenantId(): string {
    return this.storage.getStore() ?? 'default';
  }

  runWithTenant<T>(tenantId: string, fn: () => T): T {
    return this.storage.run(tenantId, fn);
  }
}
