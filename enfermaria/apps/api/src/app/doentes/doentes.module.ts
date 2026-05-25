import { Module } from '@nestjs/common';
import { DoenteService } from './doentes.service';
import { DoenteController } from './doentes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, NotificacoesModule],
  controllers: [DoenteController],
  providers: [DoenteService, PdfService],
  exports: [DoenteService],
})
export class DoenteModule {}
