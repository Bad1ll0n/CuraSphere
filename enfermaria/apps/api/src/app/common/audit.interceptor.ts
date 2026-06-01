import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const METODOS_AUDITADOS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const CAMPOS_SENSIVEIS = new Set([
  'password', 'passwordAtual', 'novaPassword', 'passwordHash',
  'mfaSecret', 'secret', 'code', 'token', 'passwordExpiredToken', 'mfaSetupToken',
]);

function redactirBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    redacted[k] = CAMPOS_SENSIVEIS.has(k) ? '[REDACTED]' : v;
  }
  try { return JSON.stringify(redacted); } catch { return undefined; }
}

function extrairEntidadeId(url: string): string | undefined {
  const partes = url.split('?')[0].split('/').filter(Boolean);
  for (let i = 1; i < partes.length; i++) {
    if (/^[0-9a-f-]{8,}$/i.test(partes[i])) return partes[i];
  }
  return undefined;
}

function extrairEntidadeTipo(url: string): string | undefined {
  return url.split('?')[0].split('/').filter(Boolean)[0] ?? undefined;
}

function anonimizarAcao(method: string, url: string): string {
  const tipo = extrairEntidadeTipo(url) ?? 'recurso';
  const mapa: Record<string, string> = {
    POST: `criar_${tipo}`,
    PATCH: `editar_${tipo}`,
    PUT: `editar_${tipo}`,
    DELETE: `eliminar_${tipo}`,
  };
  return mapa[method] ?? `${method.toLowerCase()}_${tipo}`;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = req;
    const userAgent: string | undefined = headers['user-agent'];

    if (!METODOS_AUDITADOS.has(method) || !user?.sub) {
      return next.handle();
    }

    const detalhes = redactirBody(req.body);

    return next.handle().pipe(
      tap({
        next: () => {
          this.audit.registar({
            utilizadorId: user.sub,
            acao: anonimizarAcao(method, url),
            entidadeId: extrairEntidadeId(url),
            entidadeTipo: extrairEntidadeTipo(url),
            detalhes,
            ip: ip ?? undefined,
            userAgent,
          });
        },
        error: (err) => {
          this.logger.warn(
            `Operação falhada — ${method} ${url} | utilizador: ${user.sub} | status: ${err?.status ?? 'erro'} | ip: ${ip}`,
          );
        },
      }),
    );
  }
}
