import { Module } from '@nestjs/common';
import { TrocasService } from './trocas.service';
import { TrocasController } from './trocas.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, NotificacoesModule],
  controllers: [TrocasController],
  providers: [TrocasService],
})
export class TrocasModule {}
