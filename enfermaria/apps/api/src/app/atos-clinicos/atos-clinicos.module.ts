import { Module } from '@nestjs/common';
import { AtosClinicosController } from './atos-clinicos.controller';
import { AtosClinicosService } from './atos-clinicos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AtosClinicosController],
  providers: [AtosClinicosService],
  exports: [AtosClinicosService],
})
export class AtosClinicosModule {}
