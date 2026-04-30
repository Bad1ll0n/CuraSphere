import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { QuiosqueController } from './quiosque.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TicketsController, QuiosqueController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
