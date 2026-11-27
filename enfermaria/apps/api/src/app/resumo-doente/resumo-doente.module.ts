import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VigilanciaModule } from '../vigilancia/vigilancia.module';
import { ResumoDoenteController } from './resumo-doente.controller';
import { ResumoDoenteService } from './resumo-doente.service';

@Module({
  imports: [PrismaModule, VigilanciaModule],
  controllers: [ResumoDoenteController],
  providers: [ResumoDoenteService],
})
export class ResumoDoenteModule {}
