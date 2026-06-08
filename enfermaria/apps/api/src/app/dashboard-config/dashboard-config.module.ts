import { Module } from '@nestjs/common';
import { DashboardConfigService } from './dashboard-config.service';
import { DashboardConfigController } from './dashboard-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DashboardConfigService],
  controllers: [DashboardConfigController],
})
export class DashboardConfigModule {}
