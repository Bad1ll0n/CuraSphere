import { Module, forwardRef } from '@nestjs/common';
import { ConsultasController } from './consultas.controller';
import { ConsultasService } from './consultas.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TicketsModule)],
  controllers: [ConsultasController],
  providers: [ConsultasService],
  exports: [ConsultasService],
})
export class ConsultasModule {}
