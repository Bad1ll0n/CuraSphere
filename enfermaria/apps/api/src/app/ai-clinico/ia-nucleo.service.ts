import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { GuidelinesService } from '../guidelines/guidelines.service';
import { AiMetricsService } from './ai-metrics.service';
import { exigirIaPermitida } from '../common/ia/funcoes-ia';
import { registarFalha, falhaTratada } from '../common/infra/falhas';

/**
 * ARQ-05 — minimização de dados (RGPD art. 5.º, 1, c). O modelo não precisa do nome para
 * analisar sinais vitais, protocolos ou o turno: os prompts usam um pseudónimo. Quando o texto
 * gerado TEM de levar o nome (carta de alta), o modelo escreve um marcador e o nome é posto
 * localmente depois da resposta. Teste estrutural: nenhum prompt leva `.nome` de um doente.
 */
export const PSEUDONIMO_DOENTE = 'Doente A';
export const MARCADOR_NOME = '[NOME_DO_DOENTE]';

const TTL_MS = 5 * 60 * 1000;

/** Texto da primeira parte da resposta, ou o valor por omissão se não for texto. */
export function textoDaResposta(msg: Anthropic.Message, omissao: string): string {
  const parte = msg.content[0];
  return parte?.type === 'text' ? parte.text : omissao;
}

/** O primeiro array JSON da resposta (o modelo às vezes junta texto à volta); [] se não houver. */
export function extrairArrayJson<T = any>(texto: string): T[] {
  try {
    const m = texto.match(/\[[\s\S]*\]/);
    const v = m ? JSON.parse(m[0]) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * ARQ-06 — o núcleo comum das funções de IA: o cliente do modelo, a cache curta, o contexto das
 * diretrizes, a chamada com métricas e o portão PROD-19 (`exigirIaPermitida`) e o registo de
 * cada decisão (`aiDecisao`). Todas as chamadas ao LLM passam por `callAI` — é aqui, e só aqui,
 * que se verifica se a função está ativa.
 */
@Injectable()
export class IaNucleoService {
  readonly client = new Anthropic();
  private readonly cache = new Map<string, { data: any; ts: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly guidelines: GuidelinesService,
    private readonly aiMetrics: AiMetricsService,
  ) {}

  async guidelinesCtx(query: string): Promise<string> {
    try {
      if (!query?.trim()) return '';
      const items = await this.guidelines.buscar(query);
      if (!items.length) return '';
      return `\nDIRETRIZES CLÍNICAS RELEVANTES:\n${items.map((g: any) => `[${g.fonte}] ${g.titulo}:\n${g.conteudo}`).join('\n\n')}`;
    } catch {
      return '';
    }
  }

  cached<T>(key: string, ttl = TTL_MS): T | null {
    const hit = this.cache.get(key);
    return hit && Date.now() - hit.ts < ttl ? hit.data : null;
  }

  store(key: string, data: any) {
    this.cache.set(key, { data, ts: Date.now() });
  }

  async callAI(feature: string, params: Parameters<typeof this.client.messages.create>[0]) {
    // PROD-19: decisão clínica por LLM só com activação explícita (ver common/ia/funcoes-ia.ts).
    exigirIaPermitida(feature);
    const t0 = Date.now();
    let success = true;
    let erro: string | undefined;
    try {
      // As chamadas são todas não-streaming → estreitar do tipo-união (Message | Stream) para Message.
      const msg = (await this.client.messages.create(params)) as Anthropic.Message;
      this.aiMetrics.registar({
        feature,
        modelo: params.model,
        latencyMs: Date.now() - t0,
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
        success: true,
      }).catch(registarFalha('ia:metricas'));
      return msg;
    } catch (err) {
      success = false;
      erro = (err as any)?.message ?? 'unknown';
      this.aiMetrics.registar({
        feature,
        modelo: params.model,
        latencyMs: Date.now() - t0,
        inputTokens: 0,
        outputTokens: 0,
        success,
        erro,
      }).catch(registarFalha('ia:metricas'));
      throw err;
    }
  }

  async logDecisao(
    tipo: string,
    payload: any,
    utilizadorId: string,
    doenteId?: string,
    inputPayload?: any,
  ): Promise<string | null> {
    try {
      const decisao = await this.prisma.aiDecisao.create({
        data: { tipo, payload, utilizadorId, doenteId, inputPayload: inputPayload ?? null },
      });
      return decisao.id;
    } catch (e) { falhaTratada('ia:registo-decisao', e, 'erro'); return null; } // ARQ-07: a decisão de IA fica sem registo — tem de se saber
  }
}
