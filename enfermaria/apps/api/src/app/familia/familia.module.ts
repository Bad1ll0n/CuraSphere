import { Module } from '@nestjs/common';
import { FamiliaService } from './familia.service';
import { FamiliaController } from './familia.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FamiliaController],
  providers: [FamiliaService],
  exports: [FamiliaService],
})
export class FamiliaModule {}
