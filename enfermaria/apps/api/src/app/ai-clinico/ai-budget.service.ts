import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const BUDGET_TOKENS_DIA = 500_000;
const COST_PER_1K_INPUT = 0.00025;
const COST_PER_1K_OUTPUT = 0.00125;

@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificacoesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async verificarBudgetDiario(): Promise<void> {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const metricas = await this.prisma.aiMetrica.findMany({
      where: { criadoEm: { gte: hoje } },
      select: { inputTokens: true, outputTokens: true },
    });

    if (metricas.length === 0) return;

    const totalInput = metricas.reduce((a, m) => a + m.inputTokens, 0);
    const totalOutput = metricas.reduce((a, m) => a + m.outputTokens, 0);
    const totalTokens = totalInput + totalOutput;

    if (totalTokens > BUDGET_TOKENS_DIA) {
      const custo = (totalInput / 1000 * COST_PER_1K_INPUT + totalOutput / 1000 * COST_PER_1K_OUTPUT).toFixed(4);
      const corpo = `Consumo diário IA: ${totalTokens.toLocaleString('pt-PT')} tokens (~$${custo}). Verificar módulo IA.`;
      this.logger.warn(`Budget IA excedido: ${totalTokens} tokens`);
      await Promise.all([
        this.notif.enviarParaRole('ti', 'Budget IA excedido', corpo, { tipo: 'ia_budget' }),
        this.notif.enviarParaRole('direcao', 'Budget IA excedido', corpo, { tipo: 'ia_budget' }),
      ]).catch(() => null);
    }
  }
}
