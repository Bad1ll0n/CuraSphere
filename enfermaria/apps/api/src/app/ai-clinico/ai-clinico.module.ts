import { Module } from '@nestjs/common';
import { AiClinicoService } from './ai-clinico.service';
import { AiClinicoController } from './ai-clinico.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GuidelinesModule } from '../guidelines/guidelines.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [PrismaModule, GuidelinesModule, AlertasModule],
  providers: [AiClinicoService],
  controllers: [AiClinicoController],
  exports: [AiClinicoService],
})
export class AiClinicoModule {}
