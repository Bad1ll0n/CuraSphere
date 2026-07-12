import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AiMetricEntry {
  feature: string;
  modelo: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  erro?: string;
}

@Injectable()
export class AiMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async registar(entry: AiMetricEntry): Promise<void> {
    await this.prisma.aiMetrica.create({ data: entry }).catch(() => null);
  }

  async resumo(dias = 7) {
    const desde = new Date(Date.now() - dias * 86_400_000);
    const metricas = await this.prisma.aiMetrica.findMany({
      where: { criadoEm: { gte: desde } },
      select: { feature: true, modelo: true, latencyMs: true, inputTokens: true, outputTokens: true, success: true },
    });

    const porFeature: Record<string, { total: number; erros: number; latSum: number; tokensIn: number; tokensOut: number }> = {};

    for (const m of metricas) {
      if (!porFeature[m.feature]) {
        porFeature[m.feature] = { total: 0, erros: 0, latSum: 0, tokensIn: 0, tokensOut: 0 };
      }
      const f = porFeature[m.feature];
      f.total++;
      if (!m.success) f.erros++;
      f.latSum += m.latencyMs;
      f.tokensIn += m.inputTokens;
      f.tokensOut += m.outputTokens;
    }

    return Object.entries(porFeature).map(([feature, f]) => ({
      feature,
      total: f.total,
      taxaSucesso: f.total > 0 ? ((f.total - f.erros) / f.total * 100).toFixed(1) + '%' : '0%',
      latenciaMediaMs: f.total > 0 ? Math.round(f.latSum / f.total) : 0,
      totalTokens: f.tokensIn + f.tokensOut,
    }));
  }
}
