import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcessoEnfermagemController } from './processo-enfermagem.controller';
import { ProcessoEnfermagemService } from './processo-enfermagem.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProcessoEnfermagemController],
  providers: [ProcessoEnfermagemService],
  exports: [ProcessoEnfermagemService],
})
export class ProcessoEnfermagemModule {}
