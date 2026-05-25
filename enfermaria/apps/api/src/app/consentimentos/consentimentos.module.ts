import { Module } from '@nestjs/common';
import { ConsentimentosService } from './consentimentos.service';
import { ConsentimentosController } from './consentimentos.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [ConsentimentosController],
  providers: [ConsentimentosService],
  exports: [ConsentimentosService],
})
export class ConsentimentosModule {}
