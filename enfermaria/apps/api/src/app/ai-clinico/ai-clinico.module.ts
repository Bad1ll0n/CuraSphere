import { Module } from '@nestjs/common';
import { AiClinicoService } from './ai-clinico.service';
import { AiClinicoController } from './ai-clinico.controller';
import { AiMetricsService } from './ai-metrics.service';
import { AiBudgetService } from './ai-budget.service';
import { IaNucleoService } from './ia-nucleo.service';
import { AiVigilanciaService } from './ai-vigilancia.service';
import { AiRelatoriosService } from './ai-relatorios.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GuidelinesModule } from '../guidelines/guidelines.module';
import { AlertasModule } from '../alertas/alertas.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [PrismaModule, GuidelinesModule, AlertasModule, NotificacoesModule],
  // ARQ-06: o antigo serviço único dividido por responsabilidade (núcleo LLM, apoio clínico,
  // vigilância, relatórios); a escalação de alertas, sem IA, passou para o AlertasModule.
  providers: [IaNucleoService, AiClinicoService, AiVigilanciaService, AiRelatoriosService, AiMetricsService, AiBudgetService],
  controllers: [AiClinicoController],
  exports: [AiClinicoService, AiVigilanciaService, AiMetricsService],
})
export class AiClinicoModule {}
