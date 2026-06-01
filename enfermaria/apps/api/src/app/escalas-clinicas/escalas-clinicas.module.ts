import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EscalasClinicasController } from './escalas-clinicas.controller';
import { EscalasClinicasService } from './escalas-clinicas.service';
import { DoenteModule } from '../doentes/doentes.module';

@Module({
  imports: [PrismaModule, DoenteModule],
  controllers: [EscalasClinicasController],
  providers: [EscalasClinicasService],
})
export class EscalasClinicasModule {}
