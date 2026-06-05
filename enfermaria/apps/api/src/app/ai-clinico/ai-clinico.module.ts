import { Module } from '@nestjs/common';
import { AiClinicoService } from './ai-clinico.service';
import { AiClinicoController } from './ai-clinico.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AiClinicoService],
  controllers: [AiClinicoController],
})
export class AiClinicoModule {}
