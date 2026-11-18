import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VigilanciaModule } from '../vigilancia/vigilancia.module';
import { ProcessoEnfermagemModule } from '../processo-enfermagem/processo-enfermagem.module';
import { ResumoDoenteController } from './resumo-doente.controller';
import { ResumoDoenteService } from './resumo-doente.service';

@Module({
  imports: [PrismaModule, VigilanciaModule, ProcessoEnfermagemModule],
  controllers: [ResumoDoenteController],
  providers: [ResumoDoenteService],
})
export class ResumoDoenteModule {}
