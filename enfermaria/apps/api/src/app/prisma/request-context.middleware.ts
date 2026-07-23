import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Popula o RequestContext (quem/de-onde) a partir do JWT (sub/nome/role já vêm no payload) e do
 * pedido (IP, user-agent, correlation-id). Corre em middleware — antes dos guards — mas descodifica
 * o próprio token, tal como o TenantMiddleware já faz. Envolve todo o pedido no ALS para o contexto
 * estar disponível durante as escritas na BD.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    const payload = token ? decodeJwtPayload(token) : null;

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    this.ctx.run({
      userId: (payload?.['sub'] as string) ?? null,
      nome: (payload?.['nome'] as string) ?? null,
      role: (payload?.['role'] as string) ?? null,
      ip,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      correlationId: (req.headers['x-correlation-id'] as string) ?? null,
    }, () => next());
  }
}
