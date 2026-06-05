import { Module } from '@nestjs/common';
import { BaselinesService } from './baselines.service';
import { BaselinesController } from './baselines.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [PrismaModule, AlertasModule],
  controllers: [BaselinesController],
  providers: [BaselinesService],
  exports: [BaselinesService],
})
export class BaselinesModule {}
