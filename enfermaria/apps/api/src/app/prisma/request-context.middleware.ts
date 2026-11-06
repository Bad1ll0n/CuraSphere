import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

/**
 * Abre o RequestContext do pedido (de-onde: IP, user-agent, correlation-id) e envolve todo o
 * pedido no ALS, para o contexto estar disponível durante as escritas na BD.
 *
 * SEC-07: o "quem" NÃO é lido aqui. Este middleware corre antes da autenticação e lia o
 * `Authorization: Bearer` sem verificar a assinatura — bastava um token forjado para assinar
 * escritas em nome de outra pessoa. O utilizador é preenchido pelo `ContextoPedidoInterceptor`,
 * depois dos guards, a partir de `req.user`.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    // SEC-08: com `trust proxy` (main.ts), `req.ip` já é o IP real, resolvido pelos proxies de confiança.
    this.ctx.run({
      userId: null,
      nome: null,
      role: null,
      ip: req.ip || null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      correlationId: (req.headers['x-correlation-id'] as string) ?? null,
    }, () => next());
  }
}
