import { Module } from '@nestjs/common';
import { FisioterapiaController } from './fisioterapia.controller';
import { FisioterapiaService } from './fisioterapia.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FisioterapiaController],
  providers: [FisioterapiaService],
})
export class FisioterapiaModule {}
