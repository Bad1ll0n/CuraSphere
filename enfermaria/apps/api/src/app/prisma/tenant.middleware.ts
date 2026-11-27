import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

/**
 * Abre o contexto de tenant do pedido com o tenant por omissão.
 *
 * SEC-07: o tenant deixou de vir do `Authorization: Bearer` descodificado SEM verificação —
 * um token `alg:none` com outro `tenantId` mudava os filtros de um pedido autenticado por
 * cookie (verificado: `total=1` → `total=0`). O `ContextoPedidoInterceptor` define-o depois da
 * autenticação, a partir de `req.user`.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(_req: Request, _res: Response, next: NextFunction) {
    this.tenantContext.runWithTenant('default', () => next());
  }
}
