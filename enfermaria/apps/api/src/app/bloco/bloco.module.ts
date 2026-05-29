import { Module } from '@nestjs/common';
import { BlocoController } from './bloco.controller';
import { BlocoService } from './bloco.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [BlocoController],
  providers: [BlocoService],
})
export class BlocoModule {}
