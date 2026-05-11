import { Module, forwardRef } from '@nestjs/common';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TicketsModule), NotificacoesModule],
  controllers: [ConsultasController],
  providers: [ConsultasService],
  exports: [ConsultasService],
})
export class ConsultasModule {}
