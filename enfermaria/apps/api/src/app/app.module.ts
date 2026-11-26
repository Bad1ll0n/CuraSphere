import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { CsrfMiddleware } from './common/csrf.middleware';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { TenantMiddleware } from './prisma/tenant.middleware';
import { RequestContextMiddleware } from './prisma/request-context.middleware';
import { ContextoPedidoInterceptor } from './prisma/contexto-pedido.interceptor';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerRedisStorage } from './common/throttler-redis.storage';
import { ThrottlerPorUtilizadorGuard } from './common/throttler-por-utilizador.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { sanitizarUrlParaLog } from './common/sanitizar-url-log';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { GatewayModule } from './gateway/gateway.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './common/audit.module';
import { AuditController } from './common/audit.controller';
import { AuditInterceptor } from './common/audit.interceptor';
import { CspReportController } from './common/csp-report.controller';
import { ClinicalModule } from './clinical.module';
import { GestaoModule } from './gestao.module';
import { OperacionalModule } from './operacional.module';
import { StorageModule } from './common/storage.module';
import { SistemasExternosModule } from './sistemas-externos/sistemas-externos.module';
import { GuidelinesModule } from './guidelines/guidelines.module';
import { esquemaConfiguracao } from './config/esquema-config';
import { PortalDoenteModule } from './portal-doente/portal-doente.module';
import { RgpdModule } from './rgpd/rgpd.module';
import { Hl7Module } from './hl7/hl7.module';
import { DashboardConfigModule } from './dashboard-config/dashboard-config.module';
import { AnomalyDetectionModule } from './common/anomaly-detection.module';
import { MailerModule } from './mailer/mailer.module';
import { RelatoriosAgendadosModule } from './relatorios-agendados/relatorios-agendados.module';
import { AgendaFluxoModule } from './agenda-fluxo/agenda-fluxo.module';
import { TriagemPortalModule } from './triagem-portal/triagem-portal.module';
import { ObservabilidadeModule } from './observabilidade/observabilidade.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { ModuloGuard } from './feature-flags/modulo.guard';
import { Icd10Module } from './codificacao/icd10.module';
import { OutcomesModule } from './outcomes/outcomes.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PopulationHealthModule } from './population-health/population-health.module';
import { TransferenciasModule } from './transferencias/transferencias.module';
import { RegrasCliniciasModule } from './regras-clinicas/regras-clinicas.module';
import { gerarIdCorrelacao } from './common/correlacao';
import { CAMINHOS_REDACT, CENSURA } from './common/redact-log';

@Module({
  imports: [
    // ─── Infra ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      // ARQ-20: esquema completo e fechado em produção — ver config/esquema-config.ts.
      validationSchema: esquemaConfiguracao,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: gerarIdCorrelacao, // OPS-07: validado e devolvido em X-Correlation-Id
        // LOG_LEVEL ajusta sem rebuild (ex.: `silent` nos testes de integração, `debug` num incidente).
        level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
        // pino's pretty-print transport spawns a worker thread that does its own
        // require.resolve('pino-pretty') — this doesn't work once the app is
        // bundled into a single file (webpack build, Docker image), where it
        // throws "unable to determine transport target" at boot. Explicit
        // opt-in via LOG_PRETTY, not implicit on NODE_ENV, so local
        // (non-bundled) dev can still turn it on without every bundled
        // environment inheriting the same crash.
        transport: process.env['LOG_PRETTY'] === 'true'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
          : undefined,
        // Não logar passwords ou tokens no body
        serializers: {
          req(req) {
            // O `redact` abaixo não chega ao texto do URL: ver sanitizarUrlParaLog.
            return { method: req.method, url: sanitizarUrlParaLog(req.url), correlationId: req.id };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
        // SEC-21: segredos e PII em qualquer profundidade, e o pedido agarrado aos erros do axios.
        redact: { paths: CAMINHOS_REDACT, censor: CENSURA },
        autoLogging: { ignore: (req) => req.url === '/v1/health' || (req.url ?? '').startsWith('/v1/health/') },
      },
    }),
    // Por utilizador autenticado (ThrottlerPorUtilizadorGuard), não por IP — ver PERF-02.
    // ARQ-17/OPS-09: contagem no Redis, partilhada pelas réplicas (ver ThrottlerRedisStorage).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: Number(process.env['THROTTLE_LIMIT'] ?? 600) }],
      storage: process.env['NODE_ENV'] === 'test' ? undefined : new ThrottlerRedisStorage(),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    RedisModule,
    AuthModule,
    NotificacoesModule,
    GatewayModule,
    ConfiguracoesModule,
    StorageModule,
    SistemasExternosModule,
    GuidelinesModule,
    PortalDoenteModule,
    RgpdModule,
    Hl7Module,
    DashboardConfigModule,
    AnomalyDetectionModule,
    MailerModule,
    RelatoriosAgendadosModule,
    AgendaFluxoModule,
    TriagemPortalModule,
    ObservabilidadeModule,
    FeatureFlagsModule,
    Icd10Module,
    OutcomesModule,
    WebhooksModule,
    PopulationHealthModule,
    TransferenciasModule,
    RegrasCliniciasModule,

    // ─── Domínios ─────────────────────────────────────────────────────────────
    ClinicalModule,
    GestaoModule,
    OperacionalModule,
  ],
  controllers: [AppController, AuditController, CspReportController],
  providers: [
    AppService,
    // A idempotência corre ANTES da auditoria: um reenvio reconhecido devolve a resposta
    // guardada sem executar nada, e não deve aparecer no registo como um novo acto.
    // SEC-07: primeiro de todos — preenche o "quem" e o tenant a partir de `req.user`
    // (sessão já verificada pelos guards) antes de qualquer outro interceptor ou escrita.
    { provide: APP_INTERCEPTOR, useClass: ContextoPedidoInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerPorUtilizadorGuard },
    // PROD-20: módulos opcionais desligados por instalação respondem 404.
    { provide: APP_GUARD, useClass: ModuloGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
