import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { AI_MODELS } from '../common/ai-models';

const ANTIBIOTICOS_BROAD: string[] = [
  'meropenem', 'imipenem', 'ertapenem', 'doripenem',
  'piperacilina', 'tazobactam',
  'vancomicina', 'linezolida', 'daptomicina', 'teicoplanina',
  'colistina', 'polimixina',
  'tigeciclina',
  'ceftriaxona', 'cefepima', 'ceftazidima', 'cefotaxima',
  'amoxicilina', 'clavulanato', 'ampicilina', 'sulbactam',
  'ciprofloxacina', 'levofloxacina', 'moxifloxacina',
  'metronidazol', 'clindamicina',
  'azitromicina', 'claritromicina', 'eritromicina',
  'gentamicina', 'amicacina', 'tobramicina',
  'trimetoprim', 'sulfametoxazol', 'cotrimoxazol',
];

const ANTIFUNGICOS: string[] = [
  'fluconazol', 'voriconazol', 'itraconazol', 'posaconazol',
  'caspofungina', 'micafungina', 'anidulafungina',
  'anfotericina',
];

function classificarAntibiotico(nome: string): string | null {
  const n = nome.toLowerCase();
  if (ANTIFUNGICOS.some((af) => n.includes(af))) return 'antifungal';
  if (ANTIBIOTICOS_BROAD.some((ab) => n.includes(ab))) return 'broad_spectrum';
  return null;
}

@Injectable()
export class StewardshipService {
  private readonly logger = new Logger(StewardshipService.name);
  private readonly claude = new Anthropic();

  constructor(private readonly prisma: PrismaService) {}

  async registarSeAntibiotico(doenteId: string, medicacaoId: string, nomeMed: string): Promise<void> {
    const categoria = classificarAntibiotico(nomeMed);
    if (!categoria) return;

    try {
      await this.prisma.stewardshipAntibiotico.upsert({
        where: { medicacaoId },
        create: { doenteId, medicacaoId, categoria, diasTerapia: 0 },
        update: {},
      });
    } catch (e: any) {
      this.logger.warn(`Stewardship: falha ao registar ${nomeMed}: ${e?.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async incrementarDOT(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('stewardship-dot', 3_600_000))) return;

    this.logger.log('Stewardship: incrementar DOT diário');

    const ativos = await this.prisma.stewardshipAntibiotico.findMany({
      where: { alertaEmitido: false },
      include: {
        medicacao: { select: { ativo: true, nome: true, doenteId: true } },
        doente: { select: { nome: true } },
      },
    });

    for (const sw of ativos) {
      if (!sw.medicacao.ativo) continue;

      const novoDia = sw.diasTerapia + 1;
      const deveAlertar = novoDia >= 3 && sw.categoria === 'broad_spectrum';

      if (deveAlertar) {
        const sugestaoIA = await this.gerarSugestaoDeescalacao(sw.medicacao.doenteId, sw.medicacao.nome, novoDia);
        await this.prisma.stewardshipAntibiotico.update({
          where: { id: sw.id },
          data: { diasTerapia: novoDia, alertaEmitido: true, sugestaoIA },
        });
        this.logger.log(`Stewardship: alerta de-escalação gerado para ${sw.medicacao.nome} (${sw.doente.nome})`);
      } else {
        await this.prisma.stewardshipAntibiotico.update({
          where: { id: sw.id },
          data: { diasTerapia: novoDia },
        });
      }
    }
  }

  private async gerarSugestaoDeescalacao(doenteId: string, nomeMed: string, diasTerapia: number): Promise<string> {
    try {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const antibiogramas = await this.prisma.resultadoAnalise.findMany({
        where: { doenteId, registadoEm: { gte: ontem } },
        select: { parametro: true, valor: true, observacoes: true },
        take: 10,
      });

      const labsTexto = antibiogramas.length > 0
        ? antibiogramas.map((l) => `${l.parametro}: ${l.valor} ${l.observacoes ?? ''}`).join('; ')
        : 'Sem resultados microbiológicos disponíveis nas últimas 24h.';

      const prompt = `Doente internado a fazer ${nomeMed} há ${diasTerapia} dias (antibiótico de amplo espectro).
Resultados microbiológicos recentes: ${labsTexto}

Como farmacêutico clínico especialista em stewardship antibiótico:
1. Avalia se é possível de-escalar para um antibiótico de espectro mais estreito
2. Sugere alternativas concretas se disponíveis
3. Recomenda duração total de terapia se padrão clínico conhecido
Resposta concisa (máx 150 palavras). Disclaimer: sugestão de apoio, decisão final cabe ao médico.`;

      const resp = await this.claude.messages.create({
        model: AI_MODELS.FAST,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      return (resp.content[0] as any).text ?? 'Sugestão indisponível.';
    } catch (e: any) {
      this.logger.warn(`Stewardship: Claude falhou: ${e?.message}`);
      return `Antibioterapia de amplo espectro há ${diasTerapia} dias. Considerar de-escalação com base em antibiograma disponível.`;
    }
  }

  async listar(doenteId: string) {
    return this.prisma.stewardshipAntibiotico.findMany({
      where: { doenteId },
      include: { medicacao: { select: { nome: true, dose: true, via: true, ativo: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async aprovar(id: string, userId: string) {
    const sw = await this.prisma.stewardshipAntibiotico.findUnique({ where: { id } });
    if (!sw) throw new NotFoundException('Registo de stewardship não encontrado');

    return this.prisma.stewardshipAntibiotico.update({
      where: { id },
      data: { aprovadoPor: userId, aprovadoEm: new Date() },
    });
  }
}
