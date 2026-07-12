import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PopulationHealthController } from './population-health.controller';
import { PopulationHealthService } from './population-health.service';

@Module({
  imports: [PrismaModule],
  controllers: [PopulationHealthController],
  providers: [PopulationHealthService],
})
export class PopulationHealthModule {}
