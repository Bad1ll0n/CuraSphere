import { Module } from '@nestjs/common';
import { UrgenciaController } from './urgencia.controller';
import { UrgenciaService } from './urgencia.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UrgenciaController],
  providers: [UrgenciaService],
})
export class UrgenciaModule {}
