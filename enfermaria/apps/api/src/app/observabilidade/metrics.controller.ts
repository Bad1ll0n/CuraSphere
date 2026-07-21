import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';

/**
 * Endpoint Prometheus. Público (para scraping); em produção deve ser protegido a nível de
 * rede ou por token de scraping. Não passa por JwtAuthGuard (guards são por-controller).
 *
 * version VERSION_NEUTRAL: a app usa versionamento por URI (defaultVersion '1' → prefixo /v1),
 * mas o convencionado pelo Prometheus é fazer scrape a /metrics sem prefixo. O versionamento
 * neutro define-se no @Controller (o decorator @Version() é só para métodos). Fica em /metrics.
 */
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
