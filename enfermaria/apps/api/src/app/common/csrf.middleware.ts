import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    if (SAFE_METHODS.has(req.method)) return next();

    const cookieToken: string | undefined = req.cookies?.['csrf-token'];
    // Mobile / Postman / server-to-server: no cookie means not a browser — skip
    if (!cookieToken) return next();

    const headerToken: string | undefined = req.headers['x-csrf-token'];
    if (!headerToken || headerToken !== cookieToken) {
      throw new ForbiddenException('CSRF token inválido');
    }
    next();
  }
}
