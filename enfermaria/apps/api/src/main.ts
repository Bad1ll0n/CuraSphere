import './tracing'; // deve ser o PRIMEIRO import — inicia o OpenTelemetry antes de tudo
import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { join } from 'path';
import { RedisIoAdapter } from './app/gateway/redis-io.adapter';
import { mkdirSync } from 'fs';
import { AppModule } from './app/app.module';
import { problemaConfigJitsi } from './app/common/jitsi';
import { configurarApp } from './app/configurar-app';

// placeholder conhecido, usado só para RECUSAR arrancar com ele
const JWT_SECRET_PADRAO = 'substitui_por_um_secret_seguro_em_producao'; // nosemgrep

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    // RGPD / dados clínicos: no Sentry v11, `dataCollection` por omissão envia corpos HTTP,
    // queries à BD, inputs/outputs da IA clínica, cookies e dados do utilizador — também nos
    // spans de tracing, onde o `beforeSend` abaixo não chega. Tudo desligado explicitamente
    // (baseline restritivo da v10, e sem query params, que podem levar IDs de doentes).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user', 'authorization', 'cookie'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user', 'set-cookie'] },
      },
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    beforeSend: (event) => {
      // RGPD: não enviar corpo do request nem cookies
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });
}

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === JWT_SECRET_PADRAO) {
    throw new Error('SEGURANÇA: JWT_SECRET não está configurado. Define um valor seguro no ficheiro .env antes de iniciar.');
  }
  if (jwtSecret.length < 32) {
    throw new Error('SEGURANÇA: JWT_SECRET deve ter pelo menos 32 caracteres.');
  }
  // SEC-16: nunca arrancar em produção com a teleconsulta no Jitsi público ou sem token.
  const problemaJitsi = problemaConfigJitsi();
  if (problemaJitsi) throw new Error(`SEGURANÇA: ${problemaJitsi}`);

  const uploadsDir = join(process.cwd(), 'uploads', 'mensagens');
  mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  configurarApp(app);

  // Swagger só em dev — evita expor superfície de ataque + estrutura de endpoints em produção
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CuraSphere API')
      .setDescription('API de Gestão Hospitalar CuraSphere')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  } else {
    Logger.log('Swagger desativado em produção');
  }

  // socket.io com adaptador Redis (broadcast entre instâncias em produção; fail-safe se Redis down).
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(`API a correr em: http://localhost:${port}`);
  Logger.log(`Swagger docs em: http://localhost:${port}/api/docs`);
}

bootstrap();
