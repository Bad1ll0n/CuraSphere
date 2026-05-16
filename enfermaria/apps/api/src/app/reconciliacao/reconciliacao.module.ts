import { Module } from '@nestjs/common';
import { ReconciliacaoService } from './reconciliacao.service';
import { ReconciliacaoController } from './reconciliacao.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [PrismaModule, AlertasModule],
  controllers: [ReconciliacaoController],
  providers: [ReconciliacaoService],
  exports: [ReconciliacaoService],
})
export class ReconciliacaoModule {}
