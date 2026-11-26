import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { AI_MODELS } from '../common/ai-models';
import { linhaCsv } from '../common/csv';
import { registarFalha } from '../common/falhas';
import { IaNucleoService, textoDaResposta, extrairArrayJson } from './ia-nucleo.service';

/** Filtro `criadoEm` entre duas datas (ISO), qualquer uma opcional. */
export function filtroPeriodo(from?: string, to?: string): { criadoEm?: { gte?: Date; lte?: Date } } {
  if (!from && !to) return {};
  return { criadoEm: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } };
}

/**
 * ARQ-06 — o que se aprende com as decisões de IA: o feedback de cada sugestão, a exportação
 * da auditoria, a taxa de rejeição por função, a correlação com outcomes e os relatórios
 * semanais (análise da rejeição e outcomes).
 */
@Injectable()
export class AiRelatoriosService {
  private readonly logger = new Logger(AiRelatoriosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaNucleoService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async registarFeedback(decisaoId: string, aceite: boolean, overrideMotivo?: string) {
    return this.prisma.aiDecisao.update({
      where: { id: decisaoId },
      data: { aceite, overrideMotivo },
    });
  }

  async relatorioAuditoria(from?: string, to?: string, tipo?: string) {
    const where: any = { ...filtroPeriodo(from, to), ...(tipo ? { tipo } : {}) };

    const decisoes = await this.prisma.aiDecisao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 1000,
      include: { utilizador: { select: { nome: true, role: true } } },
    });

    const cabecalho = 'id,tipo,doenteId,utilizador,role,aceite,overrideMotivo,criadoEm\n';
    const linhas = decisoes.map(d => linhaCsv([ // SEC-15: o motivo é texto livre — sem fórmulas
        d.id, d.tipo, d.doenteId ?? '', (d.utilizador as any).nome,
        (d.utilizador as any).role,
        d.aceite === null ? 'sem_feedback' : d.aceite ? 'aceite' : 'rejeitado',
        d.overrideMotivo ?? '',
        d.criadoEm.toISOString(),
      ])
    ).join('\n');

    return cabecalho + linhas;
  }

  // ── 12. Insights de Rejeição IA ──────────────────────────────────────────────

  async insightsRejeicao(from?: string, to?: string) {
    const where = filtroPeriodo(from, to);

    const decisoes = await this.prisma.aiDecisao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 2000,
      select: { tipo: true, aceite: true, overrideMotivo: true, criadoEm: true },
    });

    const porTipo: Record<string, { total: number; aceites: number; rejeitados: number; semFeedback: number; motivos: string[] }> = {};

    for (const d of decisoes) {
      if (!porTipo[d.tipo]) porTipo[d.tipo] = { total: 0, aceites: 0, rejeitados: 0, semFeedback: 0, motivos: [] };
      porTipo[d.tipo].total++;
      if (d.aceite === true) porTipo[d.tipo].aceites++;
      else if (d.aceite === false) {
        porTipo[d.tipo].rejeitados++;
        if (d.overrideMotivo) porTipo[d.tipo].motivos.push(d.overrideMotivo);
      } else {
        porTipo[d.tipo].semFeedback++;
      }
    }

    const frequenciaMotivos: Record<string, number> = {};
    for (const d of decisoes) {
      if (d.aceite === false && d.overrideMotivo) {
        frequenciaMotivos[d.overrideMotivo] = (frequenciaMotivos[d.overrideMotivo] ?? 0) + 1;
      }
    }
    const topMotivos = Object.entries(frequenciaMotivos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([motivo, count]) => ({ motivo, count }));

    const totalComFeedback = decisoes.filter(d => d.aceite !== null).length;
    const taxaAceitacaoGlobal = totalComFeedback > 0
      ? Math.round((decisoes.filter(d => d.aceite === true).length / totalComFeedback) * 100)
      : null;

    return {
      total: decisoes.length,
      totalComFeedback,
      taxaAceitacaoGlobal,
      porTipo,
      topMotivosRejeicao: topMotivos,
    };
  }

  async correlacaoOutcomes(from?: Date, to?: Date) {
    const inicio = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fim = to ?? new Date();

    const outcomes = await this.prisma.outcomeClinico.findMany({
      where: { criadoEm: { gte: inicio, lte: fim } },
    });

    const outcomesComDecisao = outcomes.filter(o => o.relacionadoAiDecisaoId);
    const decisoesIds = [...new Set(outcomesComDecisao.map(o => o.relacionadoAiDecisaoId!))];

    const decisoes = decisoesIds.length > 0
      ? await this.prisma.aiDecisao.findMany({
          where: { id: { in: decisoesIds } },
          select: { id: true, tipo: true, aceite: true },
        })
      : [];

    const decisoesMap = new Map(decisoes.map(d => [d.id, d]));

    const porTipo = Object.entries(
      outcomes.reduce((acc: Record<string, number>, o) => {
        acc[o.tipo] = (acc[o.tipo] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([tipo, total]) => ({ tipo, total }));

    const aceitesComOutcomeNegativo = outcomesComDecisao.filter(o => {
      const d = decisoesMap.get(o.relacionadoAiDecisaoId!);
      return d?.aceite && ['readmissao_30d', 'obito_intra', 'complicacao'].includes(o.tipo);
    }).length;

    return {
      periodo: { inicio, fim },
      totalOutcomes: outcomes.length,
      porTipo,
      outcomesComDecisaoIA: outcomesComDecisao.length,
      aceitesComOutcomeNegativo,
      taxaOutcomeNegativoAceite: decisoesIds.length > 0
        ? Math.round((aceitesComOutcomeNegativo / decisoesIds.length) * 100)
        : 0,
    };
  }

  // ── 16. AI Feedback Analysis — cron semanal ──────────────────────────────────

  @Cron('0 8 * * 1')
  async analisarFeedbackSemanal(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('feedback-semanal', 3_600_000))) return;

    try {
      const semanaPassada = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const decisoes = await this.prisma.aiDecisao.findMany({
        where: { criadoEm: { gte: semanaPassada }, aceite: { not: null } },
        select: { tipo: true, aceite: true, overrideMotivo: true },
      });

      if (decisoes.length < 5) {
        this.logger.log('Feedback analysis: dados insuficientes para análise semanal');
        return;
      }

      const porTipo: Record<string, { total: number; rejeitados: number; motivos: string[] }> = {};
      for (const d of decisoes) {
        if (!porTipo[d.tipo]) porTipo[d.tipo] = { total: 0, rejeitados: 0, motivos: [] };
        porTipo[d.tipo].total++;
        if (d.aceite === false) {
          porTipo[d.tipo].rejeitados++;
          if (d.overrideMotivo) porTipo[d.tipo].motivos.push(d.overrideMotivo);
        }
      }

      const tiposComRejeicao = Object.entries(porTipo)
        .filter(([, v]) => v.total >= 3 && v.rejeitados / v.total > 0.2)
        .map(([tipo, v]) => ({ tipo, taxaRejeicao: v.rejeitados / v.total, motivos: v.motivos.slice(0, 5) }));

      if (tiposComRejeicao.length === 0) {
        this.logger.log('Feedback analysis: taxa de rejeição dentro dos limites aceitáveis');
        return;
      }

      const resumo = tiposComRejeicao.map(t =>
        `${t.tipo}: ${Math.round(t.taxaRejeicao * 100)}% rejeição — motivos: ${t.motivos.join('; ') || 'sem motivo'}`
      ).join('\n');

      const msg = await this.ia.callAI('feedback_analysis', {
        model: AI_MODELS.FAST,
        max_tokens: 600,
        temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: 'Analisa padrões de rejeição de sugestões IA num sistema hospitalar e sugere ajustes nos prompts. Responde com JSON: [{"tipo":"string","taxaRejeicao":0.0,"padroes":"descrição dos padrões observados","sugestao":"ajuste recomendado no prompt"}]', cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Dados de rejeição da semana:\n${resumo}` }],
      });

      const texto = textoDaResposta(msg, '[]');
      const insights = extrairArrayJson<any>(texto);

      const semana = new Date();
      semana.setHours(0, 0, 0, 0);
      semana.setDate(semana.getDate() - semana.getDay()); // início da semana (domingo)

      for (const insight of insights) {
        const existing = await this.prisma.aiPromptInsight.findFirst({
          where: { semana, tipo: insight.tipo ?? 'desconhecido' },
        });
        if (existing) {
          await this.prisma.aiPromptInsight.update({
            where: { id: existing.id },
            data: { taxaRejeicao: insight.taxaRejeicao ?? 0, padroes: insight.padroes ?? '', sugestao: insight.sugestao ?? '' },
          }).catch(registarFalha('ia:insights'));
        } else {
          await this.prisma.aiPromptInsight.create({
            data: {
              semana,
              tipo: insight.tipo ?? 'desconhecido',
              taxaRejeicao: insight.taxaRejeicao ?? 0,
              padroes: insight.padroes ?? '',
              sugestao: insight.sugestao ?? '',
            },
          }).catch(registarFalha('ia:insights'));
        }
      }

      if (insights.length > 0) {
        await this.notificacoes.enviarParaRole('ti',
          '⚠ IA: Taxa de rejeição elevada detectada',
          `${insights.length} tipo(s) com rejeição >20% na última semana. Ver insights em Auditoria IA.`,
        ).catch(registarFalha('ia:aviso-rejeicao'));
      }

      this.logger.log(`Feedback analysis semanal: ${insights.length} insights gerados`);
    } catch (err) {
      this.logger.error('Erro no feedback analysis semanal', err);
    }
  }

  @Cron('0 8 * * 1')
  async relatorioSemanalOutcomes(): Promise<void> {
    if (!(await this.prisma.tryBecomeLeader('outcomes-semanal', 3_600_000))) return;

    try {
      const correlacao = await this.correlacaoOutcomes();
      const corpo = `${correlacao.totalOutcomes} outcomes registados nos últimos 30 dias. `
        + `${correlacao.aceitesComOutcomeNegativo} decisões IA aceites resultaram em outcomes negativos `
        + `(taxa: ${correlacao.taxaOutcomeNegativoAceite}%).`;
      await this.notificacoes.enviarParaRole(
        'direcao',
        'Relatório Semanal — Correlação IA ↔ Outcomes',
        corpo,
      );
    } catch (err) {
      this.logger.error('Erro no relatório semanal de outcomes', err);
    }
  }
}
