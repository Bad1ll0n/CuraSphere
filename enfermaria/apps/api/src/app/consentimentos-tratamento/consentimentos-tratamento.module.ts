import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsentimentosTratamentoController } from './consentimentos-tratamento.controller';
import { ConsentimentosTratamentoService } from './consentimentos-tratamento.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConsentimentosTratamentoController],
  providers: [ConsentimentosTratamentoService],
  exports: [ConsentimentosTratamentoService],
})
export class ConsentimentosTratamentoModule {}
