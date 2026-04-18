import { Module } from '@nestjs/common';
import { FarmaciaController } from './farmacia.controller';
import { FarmaciaService } from './farmacia.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FarmaciaController],
  providers: [FarmaciaService],
})
export class FarmaciaModule {}
