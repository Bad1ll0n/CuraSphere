import { Module } from '@nestjs/common';
import { PlanoAltaService } from './plano-alta.service';
import { PlanoAltaController } from './plano-alta.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PlanoAltaController],
  providers: [PlanoAltaService],
  exports: [PlanoAltaService],
})
export class PlanoAltaModule {}
