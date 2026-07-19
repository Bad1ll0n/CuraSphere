import { Module } from '@nestjs/common';
import { SinaisVitaisService } from './sinais-vitais.service';
import { SinaisVitaisController } from './sinais-vitais.controller';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { ProtocolosModule } from '../protocolos/protocolos.module';
import { DoenteModule } from '../doentes/doentes.module';
import { SepsisModule } from '../sepsis/sepsis.module';
import { BaselinesModule } from '../baselines/baselines.module';

@Module({
  imports: [AlertasModule, NotificacoesModule, ProtocolosModule, DoenteModule, SepsisModule, BaselinesModule],
  controllers: [SinaisVitaisController],
  providers: [SinaisVitaisService],
  exports: [SinaisVitaisService],
})
export class SinaisVitaisModule {}
