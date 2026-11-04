import { Module } from '@nestjs/common';
import { FicheirosController } from './ficheiros.controller';
import { ComunicacaoController } from './comunicacao.controller';
import { ComunicacaoService } from './comunicacao.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ComunicacaoController, FicheirosController],
  providers: [ComunicacaoService],
})
export class ComunicacaoModule {}
