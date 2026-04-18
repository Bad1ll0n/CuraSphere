import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SalaEsperaController } from './sala-espera.controller';
import { SalaEsperaService } from './sala-espera.service';

@Module({
  imports: [PrismaModule],
  controllers: [SalaEsperaController],
  providers: [SalaEsperaService],
})
export class SalaEsperaModule {}
