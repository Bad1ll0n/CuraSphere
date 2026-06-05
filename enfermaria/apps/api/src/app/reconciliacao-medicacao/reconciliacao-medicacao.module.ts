import { Module } from '@nestjs/common';
import { ReconciliacaoMedicacaoService } from './reconciliacao-medicacao.service';
import { ReconciliacaoMedicacaoController } from './reconciliacao-medicacao.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReconciliacaoMedicacaoController],
  providers: [ReconciliacaoMedicacaoService],
  exports: [ReconciliacaoMedicacaoService],
})
export class ReconciliacaoMedicacaoModule {}
