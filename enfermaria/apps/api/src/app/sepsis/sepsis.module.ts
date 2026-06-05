import { Module } from '@nestjs/common';
import { SepsisService } from './sepsis.service';
import { SepsisController } from './sepsis.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertasModule } from '../alertas/alertas.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, AlertasModule, GatewayModule],
  controllers: [SepsisController],
  providers: [SepsisService],
  exports: [SepsisService],
})
export class SepsisModule {}
