import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const METODOS_AUDITADOS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Extrai o id da entidade do path: /doentes/abc-123/... → "abc-123"
function extrairEntidadeId(url: string): string | undefined {
  const partes = url.split('?')[0].split('/').filter(Boolean);
  // partes: ['doentes', 'abc-123', 'medicacoes', ...]
  // Procura a primeira parte que pareça um UUID ou id após o recurso
  for (let i = 1; i < partes.length; i++) {
    if (/^[0-9a-f-]{8,}$/i.test(partes[i])) return partes[i];
  }
  return undefined;
}

function extrairEntidadeTipo(url: string): string | undefined {
  const partes = url.split('?')[0].split('/').filter(Boolean);
  return partes[0] ?? undefined;
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
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip } = req;

    if (!METODOS_AUDITADOS.has(method) || !user?.sub) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.audit.registar({
          utilizadorId: user.sub,
          acao: anonimizarAcao(method, url),
          entidadeId: extrairEntidadeId(url),
          entidadeTipo: extrairEntidadeTipo(url),
          ip: ip ?? undefined,
        });
      }),
    );
  }
}
