import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { CsrfMiddleware } from './common/csrf.middleware';
import { TenantMiddleware } from './prisma/tenant.middleware';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { GatewayModule } from './gateway/gateway.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditService } from './common/audit.service';
import { AuditController } from './common/audit.controller';
import { AuditInterceptor } from './common/audit.interceptor';
import { CspReportController } from './common/csp-report.controller';
import { ClinicalModule } from './clinical.module';
import { GestaoModule } from './gestao.module';
import { OperacionalModule } from './operacional.module';
import { StorageModule } from './common/storage.module';
import { SistemasExternosModule } from './sistemas-externos/sistemas-externos.module';
import { GuidelinesModule } from './guidelines/guidelines.module';
import { PortalDoenteModule } from './portal-doente/portal-doente.module';
import { Hl7Module } from './hl7/hl7.module';
import { DashboardConfigModule } from './dashboard-config/dashboard-config.module';
import { AnomalyDetectionModule } from './common/anomaly-detection.module';
import { MailerModule } from './mailer/mailer.module';
import { RelatoriosAgendadosModule } from './relatorios-agendados/relatorios-agendados.module';
import { Icd10Module } from './codificacao/icd10.module';
import { OutcomesModule } from './outcomes/outcomes.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PopulationHealthModule } from './population-health/population-health.module';
import { TransferenciasModule } from './transferencias/transferencias.module';
import { RegrasCliniciasModule } from './regras-clinicas/regras-clinicas.module';

@Module({
  imports: [
    // ─── Infra ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().pattern(/^\d+[smhd]$/).default('1h'),
        ENCRYPTION_KEY: Joi.string().hex().min(64).required(),
        ALLOWED_ORIGINS: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        PORT: Joi.number().default(3333),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => (req.headers['x-correlation-id'] as string) ?? randomUUID(),
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
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
            return { method: req.method, url: req.url, correlationId: req.id };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            // PII — RGPD: redactar campos sensíveis em qualquer objecto logado
            '*.password', '*.passwordHash', '*.mfaSecret', '*.secret',
            '*.contacto', '*.morada', '*.nif', '*.dataNascimento',
            '[*].contacto', '[*].morada', '[*].nif',
          ],
          censor: '[REDACTED]',
        },
        autoLogging: { ignore: (req) => req.url === '/v1/health' },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    NotificacoesModule,
    GatewayModule,
    ConfiguracoesModule,
    StorageModule,
    SistemasExternosModule,
    GuidelinesModule,
    PortalDoenteModule,
    Hl7Module,
    DashboardConfigModule,
    AnomalyDetectionModule,
    MailerModule,
    RelatoriosAgendadosModule,
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
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
