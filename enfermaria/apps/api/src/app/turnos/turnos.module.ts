import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { TurnosController } from './turnos.controller';
import { TarefasModule } from '../tarefas/tarefas.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [TarefasModule, PrismaModule, NotificacoesModule, GatewayModule],
  controllers: [TurnosController],
  providers: [TurnosService, PdfService],
  exports: [TurnosService],
})
export class TurnosModule {}
