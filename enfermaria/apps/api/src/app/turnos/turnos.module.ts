import { Module } from '@nestjs/common';
import { TurnosService } from './turnos.service';
import { TurnosController } from './turnos.controller';
import { TarefasModule } from '../tarefas/tarefas.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfService } from '../common/pdf.service';

@Module({
  imports: [TarefasModule, PrismaModule],
  controllers: [TurnosController],
  providers: [TurnosService, PdfService],
  exports: [TurnosService],
})
export class TurnosModule {}
