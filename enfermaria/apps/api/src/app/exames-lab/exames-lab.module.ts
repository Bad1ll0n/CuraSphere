import { Module } from '@nestjs/common';
import { ExamesLabService } from './exames-lab.service';
import { ExamesLabController } from './exames-lab.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [ExamesLabController],
  providers: [ExamesLabService],
  exports: [ExamesLabService],
})
export class ExamesLabModule {}
