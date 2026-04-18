import { Module } from '@nestjs/common';
import { BlocoController } from './bloco.controller';
import { BlocoService } from './bloco.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BlocoController],
  providers: [BlocoService],
})
export class BlocoModule {}
