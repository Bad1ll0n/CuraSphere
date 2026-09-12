import { Controller, Get, Header, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';
import { MetricsScrapeGuard } from '../common/metrics-scrape.guard';

/**
 * Endpoint Prometheus. SEC-14: deixou de ser público — protegido por `MetricsScrapeGuard`
 * (bearer `METRICS_TOKEN`, comparado em tempo constante). Não usa `JwtAuthGuard` porque o
 * Prometheus não tem sessão; em produção, sem `METRICS_TOKEN` definido, recusa.
 *
 * version VERSION_NEUTRAL: a app usa versionamento por URI (defaultVersion '1' → prefixo /v1),
 * mas o convencionado pelo Prometheus é fazer scrape a /metrics sem prefixo. O versionamento
 * neutro define-se no @Controller (o decorator @Version() é só para métodos). Fica em /metrics.
 */
@UseGuards(MetricsScrapeGuard)
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @SkipThrottle()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
