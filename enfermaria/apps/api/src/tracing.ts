/**
 * OpenTelemetry — tracing distribuído. Importado logo no início do main.ts, para que a
 * auto-instrumentação consiga patchar os módulos ANTES de serem carregados.
 *
 * Totalmente **gated por ambiente**: só arranca se `OTEL_EXPORTER_OTLP_ENDPOINT` estiver
 * definido. Sem colector configurado é um no-op — não altera comportamento nem arranque.
 * Configuração via env padrão do OTel: OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_TRACES_SAMPLER, etc.
 *
 * OPS-08 — estava inoperante para tudo menos o http/dns/net do Node. Três causas, todas
 * corrigidas e verificadas com um coletor OTLP (spans do pg, do Express e do router):
 *  1. o SDK arrancava num `async` IIFE com `import()` — tarde demais; agora é síncrono;
 *  2. o pg, o express e o ioredis vinham embutidos no bundle e nunca passavam pelo `require`;
 *  3. o próprio SDK vinha embutido, e aí o `require-in-the-middle` não resolve caminhos reais.
 * Os pontos 2 e 3 resolvem-se no webpack.config.js (externos carregados em runtime).
 * O Sentry 11 não regista um TracerProvider próprio (`enableOpenTelemetrySetup` é `false` por
 * omissão), por isso não compete com este.
 */
import { versaoDaAplicacao } from './versao';
import { sanitizarUrlParaLog } from './app/common/seguranca/sanitizar-url-log';

if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { NodeSDK, resources } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const sdk = new NodeSDK({
      resource: resources.resourceFromAttributes({
        'service.name': process.env['OTEL_SERVICE_NAME'] ?? 'curasphere-api',
        'service.version': versaoDaAplicacao(),
        'deployment.environment.name': process.env['NODE_ENV'] ?? 'development',
      }),
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // ruído
          // RGPD: os spans HTTP levam o URL completo, e há rotas com o token da família no caminho
          // ou o NIF na query do quiosque — limpos como nos logs (sanitizarUrlParaLog).
          '@opentelemetry/instrumentation-http': {
            applyCustomAttributesOnSpan: (span: { attributes?: Record<string, unknown>; setAttribute(k: string, v: string): void }) => {
              for (const chave of ['http.url', 'http.target', 'url.full', 'url.path', 'url.query']) {
                const valor = span.attributes?.[chave];
                if (typeof valor === 'string') span.setAttribute(chave, sanitizarUrlParaLog(valor) ?? '');
              }
            },
          },
        }),
      ],
    });
    sdk.start();
    // eslint-disable-next-line no-console
    console.log('[otel] tracing distribuído ativo →', process.env['OTEL_EXPORTER_OTLP_ENDPOINT']);
    process.on('SIGTERM', () => { sdk.shutdown().catch(() => undefined); });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[otel] não foi possível iniciar o tracing:', (err as Error)?.message);
  }
}
