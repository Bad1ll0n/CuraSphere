import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * SEC-14 — `/metrics` estava acessível sem autenticação nenhuma.
 *
 * O endpoint serve o registry do `prom-client` com `collectDefaultMetrics` activo, mais o
 * `MetricsInterceptor`, que regista `http_requests_total{method,route,status}`. Sem
 * autenticação, qualquer pessoa obtinha o mapa completo de rotas da API, os volumes por
 * rota e status (útil para calibrar um ataque e para inferir actividade clínica), e ainda
 * métricas do processo — memória, event loop, GC, uptime.
 *
 * O Prometheus não consegue autenticar-se com o `JwtAuthGuard`, por isso a protecção é um
 * bearer token de scraping dedicado (`METRICS_TOKEN`), comparado em tempo constante.
 *
 * Política quando `METRICS_TOKEN` não está definido:
 *   - produção → recusa (fail-closed). Esquecer a variável não pode reabrir o endpoint;
 *   - fora de produção → permite, para não obrigar cada programador a configurá-la.
 */
@Injectable()
export class MetricsScrapeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const esperado = this.config.get<string>('METRICS_TOKEN');

    if (!esperado) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException('Métricas indisponíveis');
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const fornecido = this.extrairToken(req);
    if (!fornecido) throw new UnauthorizedException('Métricas indisponíveis');

    const a = Buffer.from(fornecido, 'utf8');
    const b = Buffer.from(esperado, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Métricas indisponíveis');
    }
    return true;
  }

  private extrairToken(req: any): string | null {
    const auth = req.headers?.authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim() || null;
    }
    const header = req.headers?.['x-metrics-token'];
    return typeof header === 'string' && header ? header : null;
  }
}
