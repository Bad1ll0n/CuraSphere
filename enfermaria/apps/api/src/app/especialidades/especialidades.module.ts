import { Module } from '@nestjs/common';
import { EspecialidadesController } from './especialidades.controller';
import { EspecialidadesService } from './especialidades.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EspecialidadesController],
  providers: [EspecialidadesService],
})
export class EspecialidadesModule {}
