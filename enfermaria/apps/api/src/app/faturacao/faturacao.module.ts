import { Module } from '@nestjs/common';
import { FaturacaoController } from './faturacao.controller';
import { FaturacaoService } from './faturacao.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, NotificacoesModule],
  controllers: [FaturacaoController],
  providers: [FaturacaoService],
})
export class FaturacaoModule {}
