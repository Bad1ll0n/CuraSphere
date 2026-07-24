import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AcessoLeituraService } from './acesso-leitura.service';

const DOENTE_ID_RE = /^\/(?:v\d+\/)?doentes\/([0-9a-f-]{8,})/i;

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

  constructor(
    private anomaly: AnomalyDetectionService,
    private acessoLeitura: AcessoLeituraService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user, ip, headers } = req;

    // Leitura de dados sensíveis (ver ficha de doente) → trilho de acessos (assíncrono).
    if (method === 'GET' && user?.sub) {
      const m = DOENTE_ID_RE.exec(url.split('?')[0]);
      if (m) {
        this.anomaly.rastrearAcessoDoente(user.sub, m[1]);
        this.acessoLeitura.registar({
          utilizadorId: user.sub, utilizadorNome: user.nome ?? null, utilizadorRole: user.role ?? null,
          entidadeTipo: 'doentes', entidadeId: m[1], rota: url.split('?')[0],
          ip: ip ?? null, correlationId: (headers?.['x-correlation-id'] as string) ?? null,
        });
      }
    }

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
