import { Module } from '@nestjs/common';
import { SinalizacoesService } from './sinalizacoes.service';
import { SinalizacoesController } from './sinalizacoes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertasModule } from '../alertas/alertas.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, AlertasModule, GatewayModule],
  controllers: [SinalizacoesController],
  providers: [SinalizacoesService],
  exports: [SinalizacoesService],
})
export class SinalizacoesModule {}
