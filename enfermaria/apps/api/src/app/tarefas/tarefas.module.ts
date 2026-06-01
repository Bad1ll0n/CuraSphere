import { Module } from '@nestjs/common';
import { TarefasService } from './tarefas.service';
import { TarefasController } from './tarefas.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [NotificacoesModule, DoenteModule],
  controllers: [TarefasController],
  providers: [TarefasService],
  exports: [TarefasService],
})
export class TarefasModule {}
