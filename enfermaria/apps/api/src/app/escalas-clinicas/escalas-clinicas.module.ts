import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EscalasClinicasController } from './escalas-clinicas.controller';
import { EscalasClinicasService } from './escalas-clinicas.service';

@Module({
  imports: [PrismaModule],
  controllers: [EscalasClinicasController],
  providers: [EscalasClinicasService],
})
export class EscalasClinicasModule {}
