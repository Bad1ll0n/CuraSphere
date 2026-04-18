import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InterconsultasController } from './interconsultas.controller';
import { InterconsultasService } from './interconsultas.service';

@Module({
  imports: [PrismaModule],
  controllers: [InterconsultasController],
  providers: [InterconsultasService],
})
export class InterconsultasModule {}
