import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DoenteModule } from '../doentes/doentes.module';
import { InterconsultasController } from './interconsultas.controller';
import { InterconsultasService } from './interconsultas.service';

@Module({
  imports: [PrismaModule, DoenteModule],
  controllers: [InterconsultasController],
  providers: [InterconsultasService],
})
export class InterconsultasModule {}
