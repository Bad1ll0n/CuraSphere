import { Module } from '@nestjs/common';
import { EscalasService } from './escalas.service';
import { EscalasController } from './escalas.controller';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [AlertasModule, NotificacoesModule, DoenteModule],
  controllers: [EscalasController],
  providers: [EscalasService],
})
export class EscalasModule {}
