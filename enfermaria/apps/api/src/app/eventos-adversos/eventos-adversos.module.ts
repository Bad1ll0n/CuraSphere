import { Module } from '@nestjs/common';
import { EventosAdversosController } from './eventos-adversos.controller';
import { EventosAdversosService } from './eventos-adversos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EventosAdversosController],
  providers: [EventosAdversosService],
  exports: [EventosAdversosService],
})
export class EventosAdversosModule {}
