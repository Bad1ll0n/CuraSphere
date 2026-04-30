import { Module } from '@nestjs/common';
import { FaturacaoController } from './faturacao.controller';
import { FaturacaoService } from './faturacao.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FaturacaoController],
  providers: [FaturacaoService],
})
export class FaturacaoModule {}
