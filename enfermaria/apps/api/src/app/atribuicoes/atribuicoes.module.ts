import { Module } from '@nestjs/common';
import { AtribuicoesService } from './atribuicoes.service';
import { AtribuicoesController } from './atribuicoes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, NotificacoesModule],
  controllers: [AtribuicoesController],
  providers: [AtribuicoesService],
  exports: [AtribuicoesService],
})
export class AtribuicoesModule {}
