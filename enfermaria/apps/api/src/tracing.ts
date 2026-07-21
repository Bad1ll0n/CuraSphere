/**
 * OpenTelemetry — tracing distribuído. Iniciado ANTES de qualquer outro import (ver main.ts),
 * para que a auto-instrumentação consiga patchar os módulos antes de serem carregados.
 *
 * Totalmente **gated por ambiente**: só arranca se `OTEL_EXPORTER_OTLP_ENDPOINT` estiver
 * definido. Sem colector configurado é um no-op — não altera comportamento nem arranque.
 * Configuração via env padrão do OTel: OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT,
 * OTEL_TRACES_SAMPLER, etc.
 *
 * Nota: no bundle webpack do Docker, os módulos userland (pg, ioredis) ficam embutidos e a
 * instrumentação deles pode não aplicar; a instrumentação de `http` (módulo core do Node) e a
 * propagação de contexto W3C funcionam à mesma — que é o essencial do tracing distribuído.
 */
if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
  // Import dinâmico para não pagar o custo (nem exigir as deps) quando desligado.
  (async () => {
    try {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

      const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter(),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false }, // ruído
          }),
        ],
      });
      sdk.start();
      // eslint-disable-next-line no-console
      console.log('[otel] tracing distribuído ativo →', process.env['OTEL_EXPORTER_OTLP_ENDPOINT']);
      process.on('SIGTERM', () => { sdk.shutdown().catch(() => { /* noop */ }); });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[otel] não foi possível iniciar o tracing:', (err as Error)?.message);
    }
  })();
}
