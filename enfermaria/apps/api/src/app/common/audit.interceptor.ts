import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * A auditoria de ESCRITAS deixou de ser feita aqui: passou para triggers na BD
 * (curasphere_fn_audit), que registam cada INSERT/UPDATE/DELETE na mesma transação —
 * bypass-proof, atribuído via SET LOCAL, append-only. O interceptor guardava uma
 * aproximação ao nível HTTP (adivinhava entidade/ação pela rota) que duplicaria os triggers.
 *
 * O interceptor mantém: deteção de anomalias em leituras (acesso bulk a doentes) e o log de
 * operações falhadas. Eventos que NÃO são escritas na BD (ex.: login falhado) são auditados
 * explicitamente onde ocorrem (AuditService.registar), não aqui.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip } = req;

    // SEC-09: o trilho de leituras (e a deteção de acesso em massa) passou para o
    // AcessoDoenteInterceptor, que resolve o doente de TODAS as rotas, não só /doentes/:id.

    return next.handle().pipe(
      tap({
        error: (err) => {
          if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && user?.sub) {
            this.logger.warn(
              `Operação falhada — ${method} ${url} | utilizador: ${user.sub} | status: ${err?.status ?? 'erro'} | ip: ${ip}`,
            );
          }
        },
      }),
    );
  }
}
