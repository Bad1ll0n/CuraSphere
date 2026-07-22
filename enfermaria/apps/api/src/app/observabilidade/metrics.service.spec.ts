import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('expõe métricas Prometheus (default + histograma + contador)', async () => {
    const svc = new MetricsService();
    svc.httpTotal.inc({ method: 'GET', route: '/v1/doentes', status: '200' });
    svc.httpDuration.observe({ method: 'GET', route: '/v1/doentes', status: '200' }, 0.12);

    const texto = await svc.registry.metrics();
    expect(texto).toContain('http_requests_total');
    expect(texto).toContain('http_request_duration_seconds');
    expect(texto).toContain('app="curasphere-api"');
  });
});
