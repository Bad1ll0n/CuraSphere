import { Module } from '@nestjs/common';
import { ConsentimentosService } from './consentimentos.service';
import { ConsentimentosController } from './consentimentos.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [NotificacoesModule, DoenteModule],
  controllers: [ConsentimentosController],
  providers: [ConsentimentosService],
  exports: [ConsentimentosService],
})
export class ConsentimentosModule {}
