import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { QuiosqueController } from './quiosque.controller';
import { ConsultasModule } from '../consultas/consultas.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ConsultasModule)],
  controllers: [TicketsController, QuiosqueController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
