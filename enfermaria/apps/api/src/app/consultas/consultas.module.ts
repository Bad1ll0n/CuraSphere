import { Module } from '@nestjs/common';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsModule } from '../tickets/tickets.module';
import { QuiosqueController } from '../tickets/quiosque.controller';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [PrismaModule, TicketsModule, NotificacoesModule, DoenteModule],
  // ARQ-18: o quiosque vive aqui (usa senhas e consultas) — sem ciclo com o TicketsModule.
  controllers: [ConsultasController, QuiosqueController],
  providers: [ConsultasService],
  exports: [ConsultasService],
})
export class ConsultasModule {}
