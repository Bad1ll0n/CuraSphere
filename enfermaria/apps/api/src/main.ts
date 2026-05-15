import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as helmet from 'helmet';
import * as compression from 'compression';
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

  const app = await NestFactory.create(AppModule);

  app.use((compression as any)());
  app.use((helmet as any).default());

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(`API a correr em: http://localhost:${port}`);
}

bootstrap();
