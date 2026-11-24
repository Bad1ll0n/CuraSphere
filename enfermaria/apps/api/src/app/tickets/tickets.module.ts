import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';

// ARQ-18: o QuiosqueController (que usa senhas E consultas) é registado no ConsultasModule —
// assim as consultas dependem das senhas e nunca o contrário (antes: ciclo com forwardRef).
@Module({
  imports: [PrismaModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
