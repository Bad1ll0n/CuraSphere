import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotasClinicasController } from './notas-clinicas.controller';
import { NotasClinicasService } from './notas-clinicas.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotasClinicasController],
  providers: [NotasClinicasService],
})
export class NotasClinicasModule {}
