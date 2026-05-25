import { Module } from '@nestjs/common';
import { SinaisVitaisService } from './sinais-vitais.service';
import { SinaisVitaisController } from './sinais-vitais.controller';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { ProtocolosModule } from '../protocolos/protocolos.module';

@Module({
  imports: [AlertasModule, NotificacoesModule, ProtocolosModule],
  controllers: [SinaisVitaisController],
  providers: [SinaisVitaisService],
})
export class SinaisVitaisModule {}
