import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlertasService } from '../alertas/alertas.service';
import { AI_MODELS } from '../common/ia/ai-models';
import { iaPermitida } from '../common/ia/funcoes-ia';
import { doentesComOposicaoIA, exigirTratamentoPermitido } from '../common/clinico/consentimento-tratamento';
import { falhaTratada } from '../common/infra/falhas';
import { alertasDeLabs } from './labs-criticos';
import { IaNucleoService, PSEUDONIMO_DOENTE, textoDaResposta } from './ia-nucleo.service';
import { parseWithSchema, WatchdogDeterioracaoSchema, ReadmissaoSchema } from './ai-response-schemas';

/** Declive (por medição) da recta de mínimos quadrados do NEWS2; 0 com menos de 3 medições. */
export function declivNews2(sinais: { news2: number | null }[]): number {
  const ys = sinais.map((s) => s.news2).filter((v): v is number => v !== null);
  if (ys.length < 3) return 0;
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * ARQ-06 — vigilância por IA em segundo plano: o watchdog de deterioração (pré-filtro
 * determinístico — NEWS2, estado, tendência, análises críticas — e só depois o modelo) e o risco
 * de readmissão no fim do internamento. Ambos respeitam a oposição do doente (SEC-19) e o portão
 * PROD-19, que está em `IaNucleoService.callAI`.
 */
@Injectable()
export class AiVigilanciaService {
  private readonly logger = new Logger(AiVigilanciaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaNucleoService,
    private readonly alertasService: AlertasService,
  ) {}

  // ── 8. Watchdog IA — análise proactiva de todos os doentes internados ─────────

  /** ARQ-23: análises das últimas 48 h de TODOS os doentes numa consulta (era uma por doente). */
  private async labsCriticosPorDoente(ids: string[]): Promise<Map<string, string[]>> {
    const porDoente = new Map<string, any[]>();
    try {
      const labs = await (this.prisma as any).resultadoAnalise.findMany({ where: { doenteId: { in: ids }, registadoEm: { gte: new Date(Date.now() - 48 * 3600_000) } }, orderBy: { registadoEm: 'desc' } });
      for (const l of labs) { const a = porDoente.get(l.doenteId) ?? []; if (a.length < 50) a.push(l); porDoente.set(l.doenteId, a); }
    } catch (e) { falhaTratada('ia:labs-criticos', e); } // ARQ-07: antes `catch { return [] }` em silêncio
    return new Map(ids.map((id) => [id, alertasDeLabs(porDoente.get(id) ?? [])]));
  }

  @Cron('0 */30 * * * *')
  async watchdogDeterioration(): Promise<void> {
    if (!iaPermitida('watchdog')) return; // PROD-19: desligada por omissão
    if (!(await this.prisma.tryBecomeLeader('watchdog-deterioracao', 1_500_000))) return; // 25min < 30min

    const todos = await this.prisma.doente.findMany({
      where: { ativo: true, estadoRegisto: 'internado' },
      select: { id: true, nome: true, estado: true, diagnosticoPrincipal: true },
    });
    // SEC-19: sem IA para quem se opôs.
    const oposicao = await doentesComOposicaoIA(this.prisma, todos.map((d) => d.id));
    const doentes = todos.filter((d) => !oposicao.has(d.id));

    if (doentes.length === 0) return;

    let flagged = 0;
    const vintequatroHorasAtras = new Date(Date.now() - 24 * 3600_000);

    // ARQ-23: sinais vitais e análises de todos os doentes em 2 consultas (eram 2 por doente).
    const ids = doentes.map((d) => d.id);
    const [sinaisTodos, labsPorDoente] = await Promise.all([
      this.prisma.sinalVital.findMany({ where: { doenteId: { in: ids }, data: { gte: vintequatroHorasAtras } }, orderBy: { data: 'asc' }, select: { doenteId: true, news2: true, data: true, pressaoSistolica: true, saturacaoO2: true, pulso: true } }),
      this.labsCriticosPorDoente(ids),
    ]);
    const sinaisPorDoente = new Map<string, typeof sinaisTodos>();
    for (const sv of sinaisTodos) sinaisPorDoente.set(sv.doenteId, [...(sinaisPorDoente.get(sv.doenteId) ?? []), sv]);

    for (const doente of doentes) {
      try {
        const sinais24h = sinaisPorDoente.get(doente.id) ?? [];

        const ultimoSinal = sinais24h.at(-1);
        const slopeNews2 = declivNews2(sinais24h);

        const labsAlertas = labsPorDoente.get(doente.id) ?? [];

        const requerAnalise =
          (ultimoSinal?.news2 ?? 0) >= 5 ||
          doente.estado === 'grave' ||
          doente.estado === 'critico' ||
          slopeNews2 >= 0.4 ||
          labsAlertas.length > 0;

        if (!requerAnalise) continue;

        const alertasAtivos = await this.prisma.alertaClinico.count({
          where: { doenteId: doente.id, lido: false, urgencia: true },
        });

        const labsInfo = labsAlertas.length > 0 ? ` | Labs críticos: ${labsAlertas.join('; ')}` : '';
        const contextoCompacto = `Doente: ${PSEUDONIMO_DOENTE} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'desconhecido'} | Estado: ${doente.estado} | NEWS2 atual: ${ultimoSinal?.news2 ?? 'sem registo'} | Tendência NEWS2 (slope/medição): ${slopeNews2.toFixed(2)} | Medições 24h: ${sinais24h.length} | SpO2: ${ultimoSinal?.saturacaoO2 ?? '?'}% | FC: ${ultimoSinal?.pulso ?? '?'} | Alertas urgentes: ${alertasAtivos}${labsInfo}`;

        const msg = await this.ia.callAI('watchdog', {
          model: AI_MODELS.FAST,
          max_tokens: 100,
          temperature: 0.1 as any,
          system: [{ type: 'text' as const, text: 'És um sistema de vigilância clínica hospitalar. Analisa dados e responde APENAS com JSON válido, sem texto adicional: {"deterioracao": boolean, "razao": "máx 80 chars"}', cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: contextoCompacto }],
        });

        const texto = textoDaResposta(msg, '{}');
        const resultado = parseWithSchema(texto, WatchdogDeterioracaoSchema, { deterioracao: false, razao: '' });

        if (resultado.deterioracao) {
          await this.alertasService.criarAlerta(
            doente.id,
            'ia_watchdog',
            `[IA Watchdog] ${resultado.razao || 'Padrão de deterioração detectado'}`,
          );
          flagged++;
        }
      } catch (err) {
        this.logger.warn(`Watchdog: erro no doente ${doente.id}`, (err as any)?.message);
      }
    }

    this.logger.log(`Watchdog IA: ${doentes.length} doentes analisados, ${flagged} sinalizados`);
  }

  // ── 9. Score de Readmissão Pós-Alta ─────────────────────────────────────────

  async calcularRiscoReadmissao(doenteId: string): Promise<void> {
    await exigirTratamentoPermitido(this.prisma, doenteId, 'ia_clinica'); // SEC-19: oposição do doente
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        diagnosticoPrincipal: true,
        dataAdmissao: true,
        dataNascimento: true,
        estado: true,
        sinaisVitais: { orderBy: { data: 'desc' }, take: 3, select: { news2: true } },
        medicacoes: { where: { ativo: true }, select: { nome: true }, take: 10 },
        problemas: { where: { estado: 'ativo' }, select: { descricao: true }, take: 5 },
        escalasClinicas: { orderBy: { registadaEm: 'desc' }, take: 2, select: { tipo: true, pontuacao: true } },
      },
    });

    if (!doente) return;

    const dias = Math.floor((Date.now() - new Date(doente.dataAdmissao).getTime()) / 86_400_000);
    const idade = doente.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 86_400_000))
      : null;

    const contexto = JSON.stringify({
      diagnostico: doente.diagnosticoPrincipal ?? 'não registado',
      diasInternamento: dias,
      idade,
      estadoSaida: doente.estado,
      ultimoNEWS2: doente.sinaisVitais[0]?.news2 ?? null,
      medicacaoSaida: doente.medicacoes.map(m => m.nome),
      comorbilidades: doente.problemas.map(p => p.descricao),
      escalas: doente.escalasClinicas.map(e => `${e.tipo}: ${e.pontuacao}`),
    });

    const msg = await this.ia.callAI('readmissao', {
      model: AI_MODELS.CLINICAL,
      max_tokens: 350,
      temperature: 0.15 as any,
      system: [{ type: 'text' as const, text: 'Avalia risco de readmissão hospitalar nos 30 dias pós-alta com base em dados clínicos portugueses. Responde APENAS com JSON: { "risco": "baixo|medio|alto", "factores": ["string",...], "recomendacoes": ["string",...] }', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: contexto }],
    });

    const texto = textoDaResposta(msg, '{}');
    const resultado = parseWithSchema(texto, ReadmissaoSchema, { risco: 'baixo' as const, factores: [], recomendacoes: [] });

    const ultimoSumario = await this.prisma.sumarioAlta.findFirst({ where: { doenteId }, orderBy: { criadoEm: 'desc' }, select: { id: true } });
    if (!ultimoSumario) return;
    await this.prisma.sumarioAlta.update({
      where: { id: ultimoSumario.id },
      data: {
        riscReadmissao: resultado.risco,
        fatoresReadmissao: JSON.stringify(resultado.factores ?? []),
        recomendacoesAlta: JSON.stringify(resultado.recomendacoes ?? []),
      },
    }).catch(err => this.logger.warn('Erro ao guardar risco readmissão', (err as any)?.message));
  }
}
