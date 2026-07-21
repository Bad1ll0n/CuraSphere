import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Histogram, Counter } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<string>;
  readonly httpTotal: Counter<string>;

  constructor() {
    this.registry.setDefaultLabels({ app: 'curasphere-api' });
    collectDefaultMetrics({ register: this.registry }); // CPU, memória, event loop, GC…

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração dos pedidos HTTP em segundos',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
    this.httpTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total de pedidos HTTP',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
  }
}
