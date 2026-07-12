import { Module } from '@nestjs/common';
import { AiClinicoService } from './ai-clinico.service';
import { AiClinicoController } from './ai-clinico.controller';
import { AiMetricsService } from './ai-metrics.service';
import { AiBudgetService } from './ai-budget.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GuidelinesModule } from '../guidelines/guidelines.module';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, GuidelinesModule, AlertasModule, NotificacoesModule],
  providers: [AiClinicoService, AiMetricsService, AiBudgetService],
  controllers: [AiClinicoController],
  exports: [AiClinicoService, AiMetricsService],
})
export class AiClinicoModule {}
