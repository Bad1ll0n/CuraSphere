import { Module } from '@nestjs/common';
import { LembretesService } from './lembretes.service';
import { ListaEsperaService } from './lista-espera.service';
import { ListaEsperaController } from './lista-espera.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [NotificacoesModule, MailerModule],
  controllers: [ListaEsperaController],
  providers: [LembretesService, ListaEsperaService],
  exports: [ListaEsperaService],
})
export class AgendaFluxoModule {}
