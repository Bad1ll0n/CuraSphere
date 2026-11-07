import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VigilanciaController } from './vigilancia.controller';
import { VigilanciaService } from './vigilancia.service';

@Module({
  imports: [PrismaModule],
  controllers: [VigilanciaController],
  providers: [VigilanciaService],
  exports: [VigilanciaService],
})
export class VigilanciaModule {}
