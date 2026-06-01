import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '@nestjs/terminus';
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
import { ClinicalModule } from './clinical.module';
import { GestaoModule } from './gestao.module';
import { OperacionalModule } from './operacional.module';

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
        ALLOWED_ORIGINS: Joi.string().optional(),
        PORT: Joi.number().default(3333),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TerminusModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    NotificacoesModule,
    GatewayModule,
    ConfiguracoesModule,

    // ─── Domínios ─────────────────────────────────────────────────────────────
    ClinicalModule,
    GestaoModule,
    OperacionalModule,
  ],
  controllers: [AppController, AuditController],
  providers: [
    AppService,
    AuditService,
    PrismaHealthIndicator,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
