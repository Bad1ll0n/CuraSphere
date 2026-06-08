import { Module } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { DoenteController } from './doentes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { AiClinicoModule } from '../ai-clinico/ai-clinico.module';

@Module({
  imports: [PrismaModule, NotificacoesModule, AiClinicoModule],
  controllers: [DoenteController],
  providers: [DoenteService, PdfService],
  exports: [DoenteService],
})
export class DoenteModule {}
