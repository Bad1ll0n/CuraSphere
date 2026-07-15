import { Module } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { DoenteController } from './doentes.controller';
import { QuiosqueController } from './quiosque.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { AiClinicoModule } from '../ai-clinico/ai-clinico.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BreakGlassModule } from '../break-glass/break-glass.module';

@Module({
  imports: [PrismaModule, NotificacoesModule, AiClinicoModule, WebhooksModule, BreakGlassModule],
  controllers: [DoenteController, QuiosqueController],
  providers: [DoenteService, PdfService],
  exports: [DoenteService],
})
export class DoenteModule {}
