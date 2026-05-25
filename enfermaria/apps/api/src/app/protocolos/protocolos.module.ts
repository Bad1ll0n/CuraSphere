import { Module } from '@nestjs/common';
import { ProtocolosService } from './protocolos.service';
import { ProtocolosController } from './protocolos.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [ProtocolosController],
  providers: [ProtocolosService],
  exports: [ProtocolosService],
})
export class ProtocolosModule {}
