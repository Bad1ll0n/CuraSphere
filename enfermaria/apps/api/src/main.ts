import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { join, mkdirSync } from 'path';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './app/common/exception.filter';

const JWT_SECRET_PADRAO = 'substitui_por_um_secret_seguro_em_producao';

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === JWT_SECRET_PADRAO) {
    throw new Error('SEGURANÇA: JWT_SECRET não está configurado. Define um valor seguro no ficheiro .env antes de iniciar.');
  }
  if (jwtSecret.length < 32) {
    throw new Error('SEGURANÇA: JWT_SECRET deve ter pelo menos 32 caracteres.');
  }

  const uploadsDir = join(process.cwd(), 'uploads', 'mensagens');
  mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  // Esconder fingerprint Express
  app.disable('x-powered-by');

  // Servir uploads como anexos (nunca inline) para evitar XSS via SVG/HTML/PDF embutido
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  });

  app.use((compression as any).default());
  app.use((helmet as any).default({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  }));
  app.use((cookieParser as any)());

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const origensPermitidas = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (origensPermitidas) {
        return origensPermitidas.includes(origin) ? callback(null, true) : callback(new Error('Not allowed by CORS'));
      }
      // sem ALLOWED_ORIGINS definido: permite apenas localhost (dev)
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID'],
  });

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

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(`API a correr em: http://localhost:${port}`);
  Logger.log(`Swagger docs em: http://localhost:${port}/api/docs`);
}

bootstrap();
