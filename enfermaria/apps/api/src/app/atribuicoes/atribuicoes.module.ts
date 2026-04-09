import { Module } from '@nestjs/common';
import { AtribuicoesService } from './atribuicoes.service';
import { AtribuicoesController } from './atribuicoes.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AtribuicoesController],
  providers: [AtribuicoesService],
})
export class AtribuicoesModule {}
