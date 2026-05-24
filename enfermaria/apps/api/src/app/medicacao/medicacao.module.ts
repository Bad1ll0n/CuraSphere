import { Module } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { MedicacaoController } from './medicacao.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [NotificacoesModule],
  controllers: [MedicacaoController],
  providers: [MedicacaoService],
  exports: [MedicacaoService],
})
export class MedicacaoModule {}
