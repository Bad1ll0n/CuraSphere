import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Regista duração e contagem de cada pedido HTTP. Usa o PADRÃO da rota (ex.: /doentes/:id)
 * em vez do URL concreto, para não explodir a cardinalidade das labels do Prometheus.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const method: string = req.method ?? 'GET';
    const route: string = req.route?.path ?? 'other';
    const start = process.hrtime.bigint();
    const registar = () => {
      const res = context.switchToHttp().getResponse();
      const status = String(res.statusCode ?? 0);
      const sec = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.httpDuration.observe({ method, route, status }, sec);
      this.metrics.httpTotal.inc({ method, route, status });
    };
    return next.handle().pipe(tap({ next: registar, error: registar }));
  }
}
