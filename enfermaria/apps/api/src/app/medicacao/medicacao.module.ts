import { Module } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { MedicacaoController } from './medicacao.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';
import { PdfService } from '../common/pdf.service';
import { StewardshipModule } from '../stewardship/stewardship.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AlertasModule } from '../alertas/alertas.module';
import { CatalogoModule } from '../catalogo/catalogo.module';

@Module({
  imports: [NotificacoesModule, DoenteModule, StewardshipModule, WebhooksModule, AlertasModule, CatalogoModule],
  controllers: [MedicacaoController],
  providers: [MedicacaoService, PdfService],
  exports: [MedicacaoService],
})
export class MedicacaoModule {}
