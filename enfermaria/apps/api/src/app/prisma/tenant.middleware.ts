import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let tenantId = 'default';
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && typeof payload['tenantId'] === 'string') {
        tenantId = payload['tenantId'];
      }
    }

    this.tenantContext.runWithTenant(tenantId, () => next());
  }
}
