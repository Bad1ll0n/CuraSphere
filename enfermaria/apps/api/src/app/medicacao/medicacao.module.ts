import { Module } from '@nestjs/common';
import { MedicacaoService } from './medicacao.service';
import { MedicacaoController } from './medicacao.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';
import { PdfService } from '../common/pdf.service';
import { StewardshipModule } from '../stewardship/stewardship.module';

@Module({
  imports: [NotificacoesModule, DoenteModule, StewardshipModule],
  controllers: [MedicacaoController],
  providers: [MedicacaoService, PdfService],
  exports: [MedicacaoService],
})
export class MedicacaoModule {}
