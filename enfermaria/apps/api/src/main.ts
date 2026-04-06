import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: 'http://localhost:3000', credentials: true });

  const port = process.env.PORT || 3333;
  await app.listen(port);
  Logger.log(`API a correr em: http://localhost:${port}`);
}

bootstrap();
