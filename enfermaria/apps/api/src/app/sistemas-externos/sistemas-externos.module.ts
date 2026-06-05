import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SistemasExternosController } from './sistemas-externos.controller';
import { SistemasExternosService } from './sistemas-externos.service';

@Module({
  imports: [PrismaModule],
  controllers: [SistemasExternosController],
  providers: [SistemasExternosService],
  exports: [SistemasExternosService],
})
export class SistemasExternosModule {}
