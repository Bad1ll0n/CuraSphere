import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GuidelinesService } from '../guidelines/guidelines.service';
import { AlertasService } from '../alertas/alertas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { sanitizeForPrompt } from './prompt-sanitizer';
import { AiMetricsService } from './ai-metrics.service';
import {
  parseWithSchema,
  AnaliseClinicoSchema,
  TriagemSchema,
  ProtocoloAiSchema,
  TurnoSchema,
  LOSSchema,
  WatchdogDeterioracaoSchema,
  ReadmissaoSchema,
  NLQSchema,
} from './ai-response-schemas';

export interface EpisodioTriagem {
  queixaPrincipal: string;
  idadeAproximada?: number | null;
  sexo?: string | null;
  glasgow?: number | null;
  consciente?: boolean | null;
  mecanismo?: string | null;
  vitalsPASistolica?: number | null;
  vitalsPADiastolica?: number | null;
  vitalsFC?: number | null;
  vitalsSpO2?: number | null;
  vitalsFR?: number | null;
  news2Triagem?: number | null;
  condicaoPrevia?: string | null;
}

export interface DoenteTurno {
  nome: string;
  cama: string;
  diagnostico: string;
  news2: number | null;
  alertas: string[];
  tarefasPendentes: string[];
}

@Injectable()
export class AiClinicoService {
  private readonly logger = new Logger(AiClinicoService.name);
  private readonly client = new Anthropic();
  private readonly cache = new Map<string, { data: any; ts: number }>();
  private readonly TTL_MS = 5 * 60 * 1000;
  private readonly TTL_LOS_MS = 2 * 60 * 60 * 1000;
  private readonly MODEL_FAST = 'claude-haiku-4-5-20251001';
  private readonly MODEL_CLINICAL = 'claude-sonnet-4-6';

  constructor(
    private readonly prisma: PrismaService,
    private readonly guidelines: GuidelinesService,
    private readonly alertasService: AlertasService,
    private readonly aiMetrics: AiMetricsService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  private async guidelinesCtx(query: string): Promise<string> {
    try {
      if (!query?.trim()) return '';
      const items = await this.guidelines.buscar(query);
      if (!items.length) return '';
      return `\nDIRETRIZES CLÍNICAS RELEVANTES:\n${items.map((g: any) => `[${g.fonte}] ${g.titulo}:\n${g.conteudo}`).join('\n\n')}`;
    } catch {
      return '';
    }
  }

  private cached<T>(key: string, ttl = this.TTL_MS): T | null {
    const hit = this.cache.get(key);
    return hit && Date.now() - hit.ts < ttl ? hit.data : null;
  }

  private store(key: string, data: any) {
    this.cache.set(key, { data, ts: Date.now() });
  }

  private async callAI(feature: string, params: Parameters<typeof this.client.messages.create>[0]) {
    const t0 = Date.now();
    let success = true;
    let erro: string | undefined;
    try {
      const msg = await this.client.messages.create(params);
      this.aiMetrics.registar({
        feature,
        modelo: params.model,
        latencyMs: Date.now() - t0,
        inputTokens: msg.usage?.input_tokens ?? 0,
        outputTokens: msg.usage?.output_tokens ?? 0,
        success: true,
      }).catch(() => null);
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
      }).catch(() => null);
      throw err;
    }
  }

  private async logDecisao(
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
    } catch {
      return null;
    }
  }

  async registarFeedback(decisaoId: string, aceite: boolean, overrideMotivo?: string) {
    return this.prisma.aiDecisao.update({
      where: { id: decisaoId },
      data: { aceite, overrideMotivo },
    });
  }

  async relatorioAuditoria(from?: string, to?: string, tipo?: string) {
    const where: any = {};
    if (from || to) {
      where.criadoEm = {};
      if (from) where.criadoEm.gte = new Date(from);
      if (to) where.criadoEm.lte = new Date(to);
    }
    if (tipo) where.tipo = tipo;

    const decisoes = await this.prisma.aiDecisao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 1000,
      include: { utilizador: { select: { nome: true, role: true } } },
    });

    const cabecalho = 'id,tipo,doenteId,utilizador,role,aceite,overrideMotivo,criadoEm\n';
    const linhas = decisoes.map(d =>
      [
        d.id, d.tipo, d.doenteId ?? '', (d.utilizador as any).nome,
        (d.utilizador as any).role,
        d.aceite === null ? 'sem_feedback' : d.aceite ? 'aceite' : 'rejeitado',
        (d.overrideMotivo ?? '').replace(/,/g, ';'),
        d.criadoEm.toISOString(),
      ].join(',')
    ).join('\n');

    return cabecalho + linhas;
  }

  private parseJson(texto: string, fallback: any): any {
    try {
      const match = texto.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : fallback;
    } catch {
      return fallback;
    }
  }

  // ── 1. Análise Clínica do Doente ────────────────────────────────────────────

  private async buildContextoAnalisar(doenteId: string, roleRequerente: string): Promise<{ contexto: string; systemPrompt: string; gCtx: string } | null> {
    const [doente, ultimosSV, medicacoes, alertas, sinalizacoes, baseline, sepsis, exames] = await Promise.all([
      this.prisma.doente.findUnique({
        where: { id: doenteId },
        select: { nome: true, diagnosticoPrincipal: true, dataAdmissao: true },
      }),
      this.prisma.sinalVital.findMany({
        where: { doenteId }, orderBy: { data: 'desc' }, take: 5,
        select: { data: true, news2: true, pulso: true, pressaoSistolica: true, pressaoDiastolica: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true },
      }),
      this.prisma.medicacao.findMany({ where: { doenteId, ativo: true }, select: { nome: true, dose: true, via: true }, take: 10 }),
      this.prisma.alertaClinico.findMany({ where: { doenteId, lido: false }, select: { mensagem: true, urgencia: true }, orderBy: { criadoEm: 'desc' }, take: 5 }),
      this.prisma.sinalizacaoPreocupante.findMany({ where: { doenteId, resolvida: false }, select: { motivo: true, nivelUrgencia: true }, take: 3 }),
      this.prisma.baselineDoente.findUnique({ where: { doenteId } }),
      this.prisma.alertaSepsis.findFirst({ where: { doenteId, resolvido: false }, select: { criterio: true, score: true } }),
      (this.prisma as any).resultadoAnalise?.findMany({
        where: { doenteId }, orderBy: { registadoEm: 'desc' }, take: 10,
        select: { parametro: true, valor: true, unidade: true, alterado: true, critico: true, registadoEm: true },
      }).catch(() => []) ?? Promise.resolve([]),
    ]);

    if (!doente) return null;

    const isMedico = roleRequerente === 'medico';
    const diasInternamento = Math.floor((Date.now() - new Date(doente.dataAdmissao).getTime()) / 86_400_000);
    const formatSV = (sv: typeof ultimosSV[0]) =>
      `[${new Date(sv.data).toLocaleDateString('pt-PT')} ${new Date(sv.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}] TA ${sv.pressaoSistolica}/${sv.pressaoDiastolica} FC ${sv.pulso} SpO2 ${sv.saturacaoO2}% Temp ${sv.temperatura}°C FR ${sv.frequenciaRespiratoria} NEWS2 ${sv.news2}`;
    const examesCriticos = (exames as any[]).filter((e) => e.critico || e.alterado);

    const contexto = `
Doente: ${doente.nome} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'não registado'} | Internado há ${diasInternamento} dias

SINAIS VITAIS (últimos ${ultimosSV.length}):
${ultimosSV.map(formatSV).join('\n') || 'Sem registos'}

MEDICAÇÃO ACTIVA (${medicacoes.length} fármacos):
${medicacoes.map((m) => `${m.nome} ${m.dose} ${m.via}`).join(', ') || 'Sem medicação activa'}

${examesCriticos.length > 0 ? `ANALÍTICAS ALTERADAS:\n${examesCriticos.map((e: any) => `${e.parametro}: ${e.valor} ${e.unidade}${e.critico ? ' [CRÍTICO]' : ' [ALTERADO]'}`).join(' | ')}` : ''}

ALERTAS NÃO LIDOS: ${alertas.map((a) => `${a.urgencia ? '[URGENTE] ' : ''}${a.mensagem}`).join(' | ') || 'Nenhum'}
SINALIZAÇÕES ACTIVAS: ${sinalizacoes.map((s) => `${s.nivelUrgencia}: ${s.motivo}`).join(' | ') || 'Nenhuma'}
${sepsis ? `ALERTA SÉPSIS ACTIVO: ${sepsis.criterio.toUpperCase()} score ${sepsis.score}` : ''}
${baseline && (baseline as any).nRegistos >= 8 ? `BASELINE: FC ${(baseline as any).fcMedia}±${(baseline as any).fcSd} PAS ${(baseline as any).pasSistolicaMedia}±${(baseline as any).pasSistolicaSd}` : ''}
`.trim();

    const systemPrompt = isMedico
      ? `És um sistema de apoio à decisão clínica para médicos em contexto hospitalar português. Analisa padrões nos sinais vitais, analíticas e contexto clínico. Nunca prescrevas medicamentos específicos. Termina com disclaimer. Para cada observação, inclui em evidencias[] os dados específicos que a suportam. JSON: { "observacoes": ["..."], "padroesDetectados": ["..."], "investigacoesAConsiderar": ["..."], "evidencias": [{"tipo":"sinal_vital|medicacao|nota|exame|alerta","campo":"nome do campo","valor":"valor observado","relevancia":"alta|media"}], "disclaimer": "..." }`
      : `És um sistema de apoio à observação clínica de enfermagem em contexto hospitalar português. Só observações de sinais vitais. Nunca sugiras tratamentos. JSON: { "observacoes": ["..."], "evidencias": [{"tipo":"sinal_vital","campo":"nome do campo","valor":"valor observado","relevancia":"alta|media"}], "disclaimer": "..." }`;

    const gCtx = await this.guidelinesCtx(doente.diagnosticoPrincipal ?? '');
    return { contexto, systemPrompt, gCtx };
  }

  analisarStream(doenteId: string, roleRequerente: string, utilizadorId?: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        const built = await this.buildContextoAnalisar(doenteId, roleRequerente);
        if (!built) {
          subscriber.next({ data: { erro: 'Doente não encontrado' } } as MessageEvent);
          subscriber.complete();
          return;
        }
        const { contexto, systemPrompt, gCtx } = built;
        const stream = await this.client.messages.stream({
          model: this.MODEL_CLINICAL,
          max_tokens: 700,
          system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: `Analisa este doente:\n\n${contexto}${gCtx}` }],
        });
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && (chunk as any).delta?.type === 'text_delta') {
            subscriber.next({ data: { texto: (chunk as any).delta.text } } as MessageEvent);
          }
        }
        subscriber.next({ data: { done: true } } as MessageEvent);
        subscriber.complete();
      })().catch((err) => {
        this.logger.warn('analisarStream erro', err);
        subscriber.next({ data: { erro: 'Erro ao processar análise' } } as MessageEvent);
        subscriber.complete();
      });
    });
  }

  async analisar(doenteId: string, roleRequerente: string, utilizadorId?: string) {
    const cacheKey = `doente:${doenteId}:${roleRequerente}`;
    const cached = this.cached<any>(cacheKey);
    if (cached) return cached;

    const [doente, ultimosSV, medicacoes, alertas, sinalizacoes, baseline, sepsis, exames] = await Promise.all([
      this.prisma.doente.findUnique({
        where: { id: doenteId },
        select: { nome: true, diagnosticoPrincipal: true, dataAdmissao: true },
      }),
      this.prisma.sinalVital.findMany({
        where: { doenteId }, orderBy: { data: 'desc' }, take: 5,
        select: { data: true, news2: true, pulso: true, pressaoSistolica: true, pressaoDiastolica: true, temperatura: true, saturacaoO2: true, frequenciaRespiratoria: true },
      }),
      this.prisma.medicacao.findMany({ where: { doenteId, ativo: true }, select: { nome: true, dose: true, via: true }, take: 10 }),
      this.prisma.alertaClinico.findMany({ where: { doenteId, lido: false }, select: { mensagem: true, urgencia: true }, orderBy: { criadoEm: 'desc' }, take: 5 }),
      this.prisma.sinalizacaoPreocupante.findMany({ where: { doenteId, resolvida: false }, select: { motivo: true, nivelUrgencia: true }, take: 3 }),
      this.prisma.baselineDoente.findUnique({ where: { doenteId } }),
      this.prisma.alertaSepsis.findFirst({ where: { doenteId, resolvido: false }, select: { criterio: true, score: true } }),
      (this.prisma as any).resultadoAnalise?.findMany({
        where: { doenteId }, orderBy: { registadoEm: 'desc' }, take: 10,
        select: { parametro: true, valor: true, unidade: true, alterado: true, critico: true, registadoEm: true },
      }).catch(() => []) ?? Promise.resolve([]),
    ]);

    if (!doente) return null;

    const isMedico = roleRequerente === 'medico';
    const diasInternamento = Math.floor((Date.now() - new Date(doente.dataAdmissao).getTime()) / 86_400_000);

    const formatSV = (sv: typeof ultimosSV[0]) =>
      `[${new Date(sv.data).toLocaleDateString('pt-PT')} ${new Date(sv.data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}] TA ${sv.pressaoSistolica}/${sv.pressaoDiastolica} FC ${sv.pulso} SpO2 ${sv.saturacaoO2}% Temp ${sv.temperatura}°C FR ${sv.frequenciaRespiratoria} NEWS2 ${sv.news2}`;

    const examesCriticos = (exames as any[]).filter((e) => e.critico || e.alterado);

    const contexto = `
Doente: ${doente.nome} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'não registado'} | Internado há ${diasInternamento} dias

SINAIS VITAIS (últimos ${ultimosSV.length}):
${ultimosSV.map(formatSV).join('\n') || 'Sem registos'}

MEDICAÇÃO ACTIVA (${medicacoes.length} fármacos):
${medicacoes.map((m) => `${m.nome} ${m.dose} ${m.via}`).join(', ') || 'Sem medicação activa'}

${examesCriticos.length > 0 ? `ANALÍTICAS ALTERADAS:\n${examesCriticos.map((e: any) => `${e.parametro}: ${e.valor} ${e.unidade}${e.critico ? ' [CRÍTICO]' : ' [ALTERADO]'}`).join(' | ')}` : ''}

ALERTAS NÃO LIDOS: ${alertas.map((a) => `${a.urgencia ? '[URGENTE] ' : ''}${a.mensagem}`).join(' | ') || 'Nenhum'}
SINALIZAÇÕES ACTIVAS: ${sinalizacoes.map((s) => `${s.nivelUrgencia}: ${s.motivo}`).join(' | ') || 'Nenhuma'}
${sepsis ? `ALERTA SÉPSIS ACTIVO: ${sepsis.criterio.toUpperCase()} score ${sepsis.score}` : ''}
${baseline && (baseline as any).nRegistos >= 8 ? `BASELINE: FC ${(baseline as any).fcMedia}±${(baseline as any).fcSd} PAS ${(baseline as any).pasSistolicaMedia}±${(baseline as any).pasSistolicaSd}` : ''}
`.trim();

    const systemPrompt = isMedico
      ? `És um sistema de apoio à decisão clínica para médicos em contexto hospitalar português. Analisa padrões nos sinais vitais, analíticas e contexto clínico. Nunca prescrevas medicamentos específicos. Termina com disclaimer. Para cada observação, inclui em evidencias[] os dados específicos que a suportam. JSON: { "observacoes": ["..."], "padroesDetectados": ["..."], "investigacoesAConsiderar": ["..."], "evidencias": [{"tipo":"sinal_vital|medicacao|nota|exame|alerta","campo":"nome do campo","valor":"valor observado","relevancia":"alta|media"}], "disclaimer": "..." }`
      : `És um sistema de apoio à observação clínica de enfermagem em contexto hospitalar português. Só observações de sinais vitais. Nunca sugiras tratamentos. JSON: { "observacoes": ["..."], "evidencias": [{"tipo":"sinal_vital","campo":"nome do campo","valor":"valor observado","relevancia":"alta|media"}], "disclaimer": "..." }`;

    const gCtx = await this.guidelinesCtx(doente.diagnosticoPrincipal ?? '');

    try {
      const msg = await this.callAI('analisar', {
        model: this.MODEL_CLINICAL, max_tokens: 700, temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Analisa este doente:\n\n${contexto}${gCtx}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado = parseWithSchema(texto, AnaliseClinicoSchema, { observacoes: [texto], disclaimer: 'Apoio à decisão clínica. Não substitui avaliação médica.' });
      this.store(cacheKey, resultado);
      if (utilizadorId) {
        this.logDecisao('analise', resultado, utilizadorId, doenteId, { contexto, systemPrompt }).then(id => {
          if (id) resultado._decisaoId = id;
        });
      }
      return resultado;
    } catch (err) {
      this.logger.warn('Erro ao chamar API Anthropic (analisar)', err);
      throw err;
    }
  }

  // ── 2. Apoio à Triagem de Urgência ──────────────────────────────────────────

  async analisarTriagem(episodio: EpisodioTriagem, utilizadorId?: string) {
    const cacheKey = `triagem:${JSON.stringify(episodio)}`;
    const cached = this.cached<any>(cacheKey);
    if (cached) return cached;

    const contexto = `
Queixa principal: ${episodio.queixaPrincipal}
Dados do doente: ${episodio.idadeAproximada ? `${episodio.idadeAproximada} anos` : 'idade desconhecida'} | ${episodio.sexo ?? 'sexo desconhecido'}
Consciência: ${episodio.consciente === true ? 'Consciente' : episodio.consciente === false ? 'Inconsciente' : 'N/A'} | Glasgow: ${episodio.glasgow ?? 'N/A'}/15
Mecanismo: ${episodio.mecanismo ?? 'N/A'} | Condição prévia: ${episodio.condicaoPrevia ?? 'Nenhuma'}
Vitais: TA ${episodio.vitalsPASistolica ?? '?'}/${episodio.vitalsPADiastolica ?? '?'} | FC ${episodio.vitalsFC ?? '?'} | SpO2 ${episodio.vitalsSpO2 ?? '?'}% | FR ${episodio.vitalsFR ?? '?'} | NEWS2 ${episodio.news2Triagem ?? 'N/A'}
`.trim();

    try {
      const msg = await this.callAI('triagem', {
        model: this.MODEL_FAST, max_tokens: 500, temperature: 0.15 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à triagem de urgência hospitalar português (Sistema Manchester). Analisa o episódio e identifica: sinais de alarme imediatos, observações relevantes para o enfermeiro triador, e discriminadores Manchester a avaliar. REGRAS: Nunca diagnósticas definitivamente. Nunca substituis o enfermeiro triador. A decisão final é sempre do profissional. JSON: { "alertasVermelhos": ["..."], "nivelSugerido": "vermelho|laranja|amarelo|verde|azul", "observacoes": ["..."], "discriminadoresAvaliar": ["..."], "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Analisa este episódio de urgência:\n\n${contexto}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado = parseWithSchema(texto, TriagemSchema, {
        alertasVermelhos: [], nivelSugerido: 'amarelo' as const,
        observacoes: ['Não foi possível analisar o episódio automaticamente.'],
        discriminadoresAvaliar: [],
        disclaimer: 'Apoio à triagem. Decisão final do enfermeiro triador.',
      });
      this.store(cacheKey, resultado);
      if (utilizadorId) {
        this.logDecisao('triagem', resultado, utilizadorId, undefined, { contexto }).then(id => {
          if (id) resultado._decisaoId = id;
        });
      }
      return resultado;
    } catch (err) {
      this.logger.warn('Erro ao analisar triagem', err);
      throw err;
    }
  }

  // ── 3. Verificação de Aderência a Protocolos ────────────────────────────────

  async verificarProtocolos(doenteId: string, utilizadorId?: string) {
    const cacheKey = `protocolo:${doenteId}`;
    const cached = this.cached<any>(cacheKey);
    if (cached) return cached;

    const [doente, ultimosSV, sepsis, sinalizacoes] = await Promise.all([
      this.prisma.doente.findUnique({ where: { id: doenteId }, select: { nome: true } }),
      this.prisma.sinalVital.findMany({ where: { doenteId }, orderBy: { data: 'desc' }, take: 3, select: { news2: true, data: true } }),
      this.prisma.alertaSepsis.findFirst({ where: { doenteId, resolvido: false }, select: { criadoEm: true, criterio: true, score: true, hemoculturasColhidas: true, antibioticosIniciados: true, lactatoMedido: true, fluidoterapiaIniciada: true } }),
      this.prisma.sinalizacaoPreocupante.findMany({ where: { doenteId, resolvida: false }, select: { nivelUrgencia: true } }),
    ]);

    if (!doente) return null;

    const protocolos: { nome: string; estado: 'ok' | 'pendente' | 'violado'; detalhe: string }[] = [];
    const news2Atual = ultimosSV[0]?.news2 ?? null;
    const ultimoSVTs = ultimosSV[0]?.data;

    // P1 — Intervalo de monitorização NEWS2
    if (news2Atual != null && ultimoSVTs) {
      const horasDesde = (Date.now() - new Date(ultimoSVTs).getTime()) / 3_600_000;
      const intervalo = news2Atual >= 7 ? 4 : news2Atual >= 5 ? 4 : 12;
      const estado = horasDesde > intervalo ? 'violado' : horasDesde > intervalo * 0.85 ? 'pendente' : 'ok';
      protocolos.push({
        nome: `Monitorização NEWS2 (score ${news2Atual})`,
        estado,
        detalhe: `Último SV há ${horasDesde.toFixed(1)}h — intervalo recomendado: ${intervalo}h`,
      });
    } else if (!ultimoSVTs) {
      protocolos.push({ nome: 'Registo de Sinais Vitais', estado: 'violado', detalhe: 'Sem nenhum registo de sinais vitais' });
    }

    // P2 — Bundle Sépsis
    if (sepsis) {
      const horasDesde = (Date.now() - new Date(sepsis.criadoEm).getTime()) / 3_600_000;
      const accoesFeitas = [sepsis.hemoculturasColhidas, sepsis.antibioticosIniciados, sepsis.lactatoMedido, sepsis.fluidoterapiaIniciada].filter(Boolean).length;
      const estado = accoesFeitas < 4 && horasDesde > 3 ? 'violado' : accoesFeitas < 4 ? 'pendente' : 'ok';
      protocolos.push({
        nome: `Bundle Sépsis (${sepsis.criterio}, score ${sepsis.score})`,
        estado,
        detalhe: `${accoesFeitas}/4 acções completas · Alerta activo há ${horasDesde.toFixed(1)}h`,
      });
    }

    // P3 — Escalamento NEWS2 ≥5
    if (news2Atual != null && news2Atual >= 5) {
      const temSinal = sinalizacoes.some((s) => s.nivelUrgencia === 'urgente');
      protocolos.push({
        nome: 'Escalamento NEWS2 ≥5',
        estado: temSinal ? 'ok' : 'pendente',
        detalhe: temSinal ? 'Sinalização urgente registada' : 'NEWS2 ≥5 sem sinalização urgente ao médico',
      });
    }

    // Explicação AI para violações
    let observacoesAI: string[] = [];
    const temDesvio = protocolos.some((p) => p.estado !== 'ok');
    if (temDesvio) {
      try {
        const contextoStr = protocolos.map((p) => `${p.nome}: ${p.estado.toUpperCase()} — ${p.detalhe}`).join('\n');
        const msg = await this.callAI('protocolo', {
          model: this.MODEL_FAST, max_tokens: 350, temperature: 0.1 as any,
          system: [{ type: 'text' as const, text: 'Gera observações clínicas concisas sobre protocolos em desvio num hospital português. Nunca prescrevas tratamentos. JSON: { "observacoes": ["..."] }', cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: `Doente: ${doente.nome}\nProtocolos:\n${contextoStr}` }],
        });
        const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
        const parsed = parseWithSchema(texto, ProtocoloAiSchema, { observacoes: [] });
        observacoesAI = parsed.observacoes ?? [];
      } catch { /* silencioso */ }
    }

    const resultado: any = {
      protocolos,
      observacoesAI,
      disclaimer: 'Verificação automática de protocolos. Não substitui avaliação clínica.',
    };
    this.cache.set(cacheKey, { data: resultado, ts: Date.now() });
    if (utilizadorId) {
      this.logDecisao('protocolo', resultado, utilizadorId, doenteId, { protocolos }).then(id => {
        if (id) resultado._decisaoId = id;
      });
    }
    return resultado;
  }

  // ── 4. Sumarização de Passagem de Turno ─────────────────────────────────────

  async sumarizarTurno(doentes: DoenteTurno[], utilizadorId?: string) {
    if (doentes.length === 0) return { narrativa: 'Sem doentes no serviço.', destaques: [], disclaimer: '' };

    const contexto = doentes
      .map((d, i) => `${i + 1}. ${d.nome} (Cama ${d.cama}) — ${d.diagnostico} — NEWS2: ${d.news2 ?? 'sem registo'} — Alertas: ${d.alertas.join(', ') || 'nenhum'} — Tarefas pendentes: ${d.tarefasPendentes.join(', ') || 'nenhuma'}`)
      .join('\n');

    try {
      const msg = await this.callAI('turno', {
        model: this.MODEL_FAST, max_tokens: 900, temperature: 0.3 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à passagem de turno hospitalar português. Gera uma narrativa de passagem de turno profissional, concisa e em português europeu. Destaca doentes críticos, alertas activos e tarefas pendentes. Termina com 3 destaques prioritários para o turno seguinte. JSON: { "narrativa": "...", "destaques": ["...", "...", "..."], "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Resume a passagem de turno para ${doentes.length} doentes:\n\n${contexto}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado: any = parseWithSchema(texto, TurnoSchema, { narrativa: texto, destaques: [], disclaimer: 'Gerado por IA. Verificar com equipa clínica.' });
      if (utilizadorId) {
        this.logDecisao('turno', resultado, utilizadorId, undefined, { contexto }).then(id => {
          if (id) resultado._decisaoId = id;
        });
      }
      return resultado;
    } catch (err) {
      this.logger.warn('Erro ao sumarizar turno', err);
      throw err;
    }
  }

  // ── 5. Sumarização automática por serviço (frontend envia só { servico }) ────

  async sumarizarTurnoServico(servico: string, utilizadorId?: string) {
    const cacheKey = `turno-servico:${servico}`;
    const cached = this.cached<any>(cacheKey);
    if (cached) return cached;

    const doentesDb: any[] = await (this.prisma.doente as any).findMany({
      where: { ativo: true, estadoRegisto: 'internado' },
      select: {
        id: true, nome: true, diagnosticoPrincipal: true,
        cama: { select: { numero: true, quarto: true } },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 1, select: { news2: true } },
        alertasClinicos: { where: { lido: false }, select: { tipo: true } },
        tarefas: { where: { estado: { in: ['pendente', 'em_progresso'] } }, select: { descricao: true, prioridade: true } },
      },
    });

    const doentes: DoenteTurno[] = doentesDb.map(d => ({
      nome: d.nome,
      cama: d.cama ? `${d.cama.quarto}/${d.cama.numero}` : '—',
      diagnostico: d.diagnosticoPrincipal ?? 'sem diagnóstico',
      news2: d.sinaisVitais[0]?.news2 ?? null,
      alertas: d.alertasClinicos.map((a: any) => a.tipo),
      tarefasPendentes: d.tarefas.map((t: any) => `${t.descricao}${t.prioridade === 'urgente' ? ' (urgente)' : ''}`),
    }));

    const resultado = await this.sumarizarTurno(doentes, utilizadorId);
    this.store(cacheKey, resultado);
    return resultado;
  }

  // ── 6. Previsão LOS (Length of Stay) ────────────────────────────────────────

  async preverLOS(doenteId: string, utilizadorId?: string) {
    const cacheKey = `los:${doenteId}`;
    const cached = this.cached<any>(cacheKey, this.TTL_LOS_MS);
    if (cached) return cached;

    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        nome: true, diagnosticoPrincipal: true, dataAdmissao: true, dataNascimento: true,
        estado: true, dataAltaPrevista: true,
        sinaisVitais: { orderBy: { data: 'desc' }, take: 3, select: { news2: true, data: true } },
        alertasClinicos: { where: { lido: false }, select: { tipo: true } },
        alertasSepsis: { where: { resolvido: false }, take: 1 },
      },
    });
    if (!doente) return null;

    const diasInternamento = Math.floor((Date.now() - new Date(doente.dataAdmissao).getTime()) / 86_400_000);
    const idade = doente.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 86_400_000))
      : null;
    const news2Atual = doente.sinaisVitais[0]?.news2 ?? null;
    const temSepsis = doente.alertasSepsis.length > 0;
    const altaPrevista = doente.dataAltaPrevista;
    const diasParaAlta = altaPrevista
      ? Math.ceil((new Date(altaPrevista).getTime() - Date.now()) / 86_400_000)
      : null;

    const contexto = `
Diagnóstico: ${doente.diagnosticoPrincipal ?? 'não registado'}
Dias internado: ${diasInternamento}
Idade: ${idade ?? 'desconhecida'} anos | Estado clínico: ${doente.estado}
NEWS2 actual: ${news2Atual ?? 'sem registo'}
Alertas activos: ${doente.alertasClinicos.map(a => a.tipo).join(', ') || 'nenhum'}
Sépsis activa: ${temSepsis ? 'SIM' : 'Não'}
Alta prevista: ${altaPrevista ? new Date(altaPrevista).toLocaleDateString('pt-PT') : 'não definida'}
`.trim();

    try {
      const msg = await this.callAI('los', {
        model: this.MODEL_FAST, max_tokens: 400, temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à previsão de tempo de internamento (LOS) hospitalar português. Com base nos dados clínicos, estima o número de dias adicionais de internamento esperados. JSON: { "losEstimadoDias": <número>, "confianca": "alta|media|baixa", "factores": ["..."], "alertaAtraso": <boolean>, "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Estima o LOS para este doente:\n\n${contexto}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado: any = parseWithSchema(texto, LOSSchema, {
        losEstimadoDias: diasParaAlta ?? 3,
        confianca: 'baixa' as const, factores: [], alertaAtraso: false,
        disclaimer: 'Estimativa automática. Não substitui avaliação clínica.',
      });
      resultado.diasJaInternado = diasInternamento;
      this.store(cacheKey, resultado);
      if (utilizadorId) {
        this.logDecisao('los', resultado, utilizadorId, doenteId, { contexto }).then(id => {
          if (id) resultado._decisaoId = id;
        });
      }
      return resultado;
    } catch (err) {
      this.logger.warn('Erro ao prever LOS', err);
      throw err;
    }
  }

  // ── 7. Escalação Automática — alertas urgentes sem resposta >30min ───────────

  @Cron('*/15 * * * *')
  async escalarAlertasNaoRespondidos(): Promise<void> {
    const limite = new Date(Date.now() - 30 * 60_000);

    const alertas = await this.prisma.alertaClinico.findMany({
      where: {
        urgencia: true,
        lido: false,
        escaladoEm: null,
        criadoEm: { lte: limite },
        tipo: { in: ['news2_critico', 'sepsis', 'sos', 'ia_watchdog'] },
      },
      include: {
        doente: {
          select: {
            id: true,
            nome: true,
            cama: { select: { numero: true, quarto: true } },
          },
        },
      },
    });

    if (alertas.length === 0) return;

    const turnoAtivo = await this.prisma.turno.findFirst({
      where: { dataInicio: { lte: new Date() }, dataFim: { gte: new Date() } },
      select: { chefeTurnoId: true },
      orderBy: { dataInicio: 'desc' },
    });

    for (const alerta of alertas) {
      await this.prisma.alertaClinico.update({
        where: { id: alerta.id },
        data: { escaladoEm: new Date() },
      });

      const d = alerta.doente as any;
      const localizacao = d?.cama ? `Quarto ${d.cama.quarto}, Cama ${d.cama.numero}` : '';
      const mensagem = `⬆️ ESCALAÇÃO: Alerta urgente sem resposta há >30min — ${d?.nome ?? 'Doente'} ${localizacao}`.trim();

      await this.alertasService.criarAlerta(d.id, 'escalacao_automatica', mensagem);

      if (turnoAtivo?.chefeTurnoId) {
        await this.prisma.notificacaoInApp.create({
          data: {
            utilizadorId: turnoAtivo.chefeTurnoId,
            titulo: '⬆️ Escalação Automática',
            corpo: mensagem,
            dadosExtra: { tipo: 'escalacao' },
          },
        }).catch(() => { /* notificacaoInApp pode não existir — ignorar */ });
      }

      this.logger.warn(`Escalação automática: doente ${d?.id}, alerta ${alerta.id}`);
    }
  }

  // ── 8. Watchdog IA — análise proactiva de todos os doentes internados ─────────

  private calcularSlopeNews2(sinais: { news2: number | null; data: Date }[]): number {
    const validos = sinais.filter(s => s.news2 !== null) as { news2: number; data: Date }[];
    if (validos.length < 3) return 0;
    const n = validos.length;
    const xs = validos.map((_, i) => i);
    const ys = validos.map(s => s.news2);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return 0;
    return (n * sumXY - sumX * sumY) / denom;
  }

  private async verificarLabsCriticos(doenteId: string): Promise<string[]> {
    try {
      const limite = new Date(Date.now() - 48 * 3600_000);
      const labs = await (this.prisma as any).resultadoAnalise.findMany({
        where: { doenteId, registadoEm: { gte: limite } },
        orderBy: { registadoEm: 'desc' },
        take: 50,
      });

      const alertas: string[] = [];
      const valoresPorParametro: Record<string, number[]> = {};

      for (const lab of labs) {
        const p = (lab.parametro ?? '').toLowerCase();
        const v = typeof lab.valor === 'number' ? lab.valor : parseFloat(String(lab.valor ?? ''));
        if (isNaN(v)) continue;

        if (!valoresPorParametro[p]) valoresPorParametro[p] = [];
        valoresPorParametro[p].push(v);

        if (p.includes('troponina') && v > 0.04) alertas.push(`Troponina elevada: ${v} µg/L`);
        if (p.includes('lactato') && v > 2.0) alertas.push(`Lactato elevado: ${v} mmol/L`);
        if ((p === 'hb' || p === 'hemoglobina' || p.includes('hemoglobin')) && v < 7.0) alertas.push(`Hemoglobina crítica: ${v} g/dL`);
        if ((p.includes('leucocit') || p === 'wbc') && (v > 12.0 || v < 4.0)) alertas.push(`Leucócitos anómalos: ${v} ×10⁹/L`);
      }

      // AKI: progressão creatinina > 0.3 mg/dL nas últimas 48h
      const creatKeys = Object.keys(valoresPorParametro).filter(k => k.includes('creatinin'));
      for (const key of creatKeys) {
        const vals = valoresPorParametro[key]; // mais recente primeiro (orderBy desc)
        if (vals.length >= 2 && vals[0] - vals[vals.length - 1] > 0.3) {
          alertas.push(`Progressão creatinina: ${vals[vals.length - 1]} → ${vals[0]} mg/dL (AKI suspeito)`);
        }
      }

      return [...new Set(alertas)]; // deduplica
    } catch {
      return [];
    }
  }

  @Cron('0 */30 * * * *')
  async watchdogDeterioration(): Promise<void> {
    const doentes = await this.prisma.doente.findMany({
      where: { ativo: true, estadoRegisto: 'internado' },
      select: { id: true, nome: true, estado: true, diagnosticoPrincipal: true },
    });

    if (doentes.length === 0) return;

    let flagged = 0;
    const vintequatroHorasAtras = new Date(Date.now() - 24 * 3600_000);

    for (const doente of doentes) {
      try {
        const sinais24h = await this.prisma.sinalVital.findMany({
          where: { doenteId: doente.id, data: { gte: vintequatroHorasAtras } },
          orderBy: { data: 'asc' },
          select: { news2: true, data: true, pressaoSistolica: true, saturacaoO2: true, pulso: true },
        });

        const ultimoSinal = sinais24h.at(-1);
        const slopeNews2 = this.calcularSlopeNews2(sinais24h);

        const labsAlertas = await this.verificarLabsCriticos(doente.id);

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
        const contextoCompacto = `Doente: ${doente.nome} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'desconhecido'} | Estado: ${doente.estado} | NEWS2 atual: ${ultimoSinal?.news2 ?? 'sem registo'} | Tendência NEWS2 (slope/medição): ${slopeNews2.toFixed(2)} | Medições 24h: ${sinais24h.length} | SpO2: ${ultimoSinal?.saturacaoO2 ?? '?'}% | FC: ${ultimoSinal?.pulso ?? '?'} | Alertas urgentes: ${alertasAtivos}${labsInfo}`;

        const msg = await this.callAI('watchdog', {
          model: this.MODEL_FAST,
          max_tokens: 100,
          temperature: 0.1 as any,
          system: [{ type: 'text' as const, text: 'És um sistema de vigilância clínica hospitalar. Analisa dados e responde APENAS com JSON válido, sem texto adicional: {"deterioracao": boolean, "razao": "máx 80 chars"}', cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: contextoCompacto }],
        });

        const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
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

    const msg = await this.callAI('readmissao', {
      model: this.MODEL_CLINICAL,
      max_tokens: 350,
      temperature: 0.15 as any,
      system: [{ type: 'text' as const, text: 'Avalia risco de readmissão hospitalar nos 30 dias pós-alta com base em dados clínicos portugueses. Responde APENAS com JSON: { "risco": "baixo|medio|alto", "factores": ["string",...], "recomendacoes": ["string",...] }', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: contexto }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const resultado = parseWithSchema(texto, ReadmissaoSchema, { risco: 'baixo' as const, factores: [], recomendacoes: [] });

    await this.prisma.sumarioAlta.update({
      where: { doenteId },
      data: {
        riscReadmissao: resultado.risco,
        fatoresReadmissao: JSON.stringify(resultado.factores ?? []),
        recomendacoesAlta: JSON.stringify(resultado.recomendacoes ?? []),
      },
    }).catch(err => this.logger.warn('Erro ao guardar risco readmissão', (err as any)?.message));
  }

  // ── 10. NLQ — Natural Language Query sobre dados hospitalares ────────────────

  async diagnosticoDiferencial(doenteId: string, sintomas: string, utilizadorId: string) {
    const built = await this.buildContextoAnalisar(doenteId, 'medico');
    if (!built) return [];

    const SYSTEM_DD = `És um especialista em medicina interna. Gera um diagnóstico diferencial estruturado em JSON.
Formato de resposta: [{"diagnostico":"...","probabilidade":"Alta|Média|Baixa","justificacao":"...","proximos_passos":"..."}]
Máximo 5 diagnósticos. Ordena por probabilidade decrescente. Responde APENAS com JSON válido, sem texto adicional.`;

    const msg = await this.callAI('diagnostico_diferencial', {
      model: this.MODEL_CLINICAL,
      max_tokens: 1200,
      system: [
        { type: 'text', text: SYSTEM_DD, cache_control: { type: 'ephemeral' as const } },
        { type: 'text', text: built.contexto },
      ],
      messages: [{ role: 'user', content: `Sintomas/queixa actual: ${sanitizeForPrompt(sintomas, 600)}` }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    const resultado = (() => { try { return JSON.parse(texto); } catch { return []; } })();

    this.logDecisao('diagnostico_diferencial', { sintomas, resultado }, utilizadorId, doenteId, { sintomas }).catch(() => {});
    return resultado;
  }

  async executarNLQ(query: string, utilizadorId: string) {
    const schemaSimplificado = `
Tabelas disponíveis e campos:
- doente: id, nome, estado(estavel|grave|critico|alta_prevista), estadoRegisto(internado|ambulatorio), diagnosticoPrincipal, dataAdmissao, ativo
- sinalVital: doenteId, news2(número), pressaoSistolica, saturacaoO2, pulso, criadoEm
- medicacao: doenteId, nome, ativo(boolean), criadoEm
- stewardshipAntibiotico: doenteId, diasTerapia(número), aprovadoPor(null=não aprovado)
- alertaClinico: doenteId, tipo, lido(boolean), urgencia(boolean), criadoEm
    `.trim();

    const msg = await this.callAI('nlq', {
      model: this.MODEL_FAST,
      max_tokens: 400,
      temperature: 0.1 as any,
      system: [{ type: 'text' as const, text: `Converte queries em linguagem natural para filtros Prisma sobre dados hospitalares.\n${schemaSimplificado}\nResponde APENAS com JSON válido (sem markdown): { "where": {filtros para tabela doente}, "include": {"sinaisVitais":{"orderBy":{"criadoEm":"desc"},"take":1}}, "take": número máx 20, "explicacao": "string curta em português" }\nPara relações (ex: doentes com news2 alto), usa where com nested sinaisVitais some.\nNunca retornes mais de 20 resultados. Sempre inclui ativo:true no where.`, cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: sanitizeForPrompt(query, 400) }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const filtros = parseWithSchema(texto, NLQSchema, { where: { ativo: true }, take: 10, explicacao: 'Sem resultados' });

    const where = { ativo: true, ...(filtros.where ?? {}) };
    const take = Math.min(filtros.take ?? 10, 20);

    const resultados = await this.prisma.doente.findMany({
      where,
      include: {
        cama: { select: { numero: true, quarto: true } },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 1, select: { news2: true, data: true } },
      },
      take,
      orderBy: { dataAdmissao: 'desc' },
    });

    if (utilizadorId) {
      this.logDecisao('nlq', { filtros, count: resultados.length }, utilizadorId, undefined, { query }).catch(() => {});
    }

    return { resultados, explicacao: filtros.explicacao ?? 'Pesquisa concluída', total: resultados.length };
  }

  // ── 11. Carta de Alta para Médico de Família ──────────────────────────────────

  async gerarCartaAlta(doenteId: string): Promise<void> {
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        nome: true,
        diagnosticoPrincipal: true,
        dataAdmissao: true,
        dataNascimento: true,
        sumarioAlta: {
          select: { motivoAlta: true, resumoClinical: true, prescricaoSaida: true, medicoFamilia: true, criadoEm: true },
        },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 1, select: { news2: true, pulso: true, pressaoSistolica: true, saturacaoO2: true, temperatura: true } },
        medicacoes: { where: { ativo: false }, orderBy: { iniciadoEm: 'desc' }, take: 10, select: { nome: true, dose: true, via: true } },
        problemas: { where: { estado: 'ativo' }, select: { descricao: true }, take: 5 },
        notasClincias: { orderBy: { criadaEm: 'desc' }, take: 2, select: { subjetivo: true, plano: true } },
      },
    });

    if (!doente?.sumarioAlta) return;

    const dataAdmissao = new Date(doente.dataAdmissao).toLocaleDateString('pt-PT');
    const dataAlta = new Date(doente.sumarioAlta.criadoEm).toLocaleDateString('pt-PT');
    const idade = doente.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 86_400_000))
      : null;

    const contexto = JSON.stringify({
      nomePaciente: doente.nome,
      idade,
      dataAdmissao,
      dataAlta,
      diagnosticoPrincipal: doente.diagnosticoPrincipal,
      motivoAlta: doente.sumarioAlta.motivoAlta,
      resumoClinical: doente.sumarioAlta.resumoClinical,
      prescricaoSaida: doente.sumarioAlta.prescricaoSaida,
      medicoFamilia: doente.sumarioAlta.medicoFamilia,
      medicacoes: doente.medicacoes.map(m => `${m.nome}${m.dose ? ' ' + m.dose : ''}${m.via ? ' (' + m.via + ')' : ''}`),
      problemasActivos: doente.problemas.map(p => p.descricao),
    });

    const msg = await this.callAI('carta_alta', {
      model: this.MODEL_CLINICAL,
      max_tokens: 900,
      system: [{ type: 'text' as const, text: 'Gera uma carta de alta médica em português europeu formal (formato A4, 280-350 palavras). A carta é enviada ao médico de família. Inclui: cabeçalho com data, identificação do doente, diagnóstico principal, resumo da evolução clínica, medicação de saída (com doses e via), recomendações pós-alta e follow-up. Assina como "Equipa Clínica — CuraSphere". Responde APENAS com o texto da carta, sem JSON, sem markdown.', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: contexto }],
    });

    const carta = msg.content[0].type === 'text' ? msg.content[0].text : '';
    if (!carta) return;

    await this.prisma.sumarioAlta.update({
      where: { doenteId },
      data: { cartaAlta: carta },
    }).catch(err => this.logger.warn('Erro ao guardar carta de alta', (err as any)?.message));
  }

  // ── 12. Insights de Rejeição IA ──────────────────────────────────────────────

  async insightsRejeicao(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.criadoEm = {};
      if (from) where.criadoEm.gte = new Date(from);
      if (to) where.criadoEm.lte = new Date(to);
    }

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

  // ── 13. Predictive Staffing AI ───────────────────────────────────────────────

  async preverNecessidadesPessoal(): Promise<{ geradas: number }> {
    const hoje = new Date();
    const seteDigasData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i + 1);
      return d;
    });

    // Dados históricos: admissões por dia da semana nas últimas 8 semanas
    const oitoSemanasAtras = new Date(hoje);
    oitoSemanasAtras.setDate(oitoSemanasAtras.getDate() - 56);

    const admissoes = await this.prisma.doente.groupBy({
      by: ['dataAdmissao'],
      where: { dataAdmissao: { gte: oitoSemanasAtras } },
      _count: { id: true },
      orderBy: { dataAdmissao: 'asc' },
    });

    // Número total de internados actuais
    const internados = await this.prisma.doente.count({
      where: { ativo: true, estadoRegisto: 'internado' },
    });

    // Calcular média diária por dia da semana
    const mediasPorDia: number[] = Array(7).fill(0);
    const contagemPorDia: number[] = Array(7).fill(0);
    for (const a of admissoes) {
      const dow = new Date(a.dataAdmissao).getDay();
      mediasPorDia[dow] += a._count.id;
      contagemPorDia[dow]++;
    }
    const medias = mediasPorDia.map((s, i) => (contagemPorDia[i] > 0 ? s / contagemPorDia[i] : 0));

    const turnos = ['manha', 'tarde', 'noite'] as const;
    const ratioTurno: Record<string, number> = { manha: 0.4, tarde: 0.35, noite: 0.25 };
    const RATIO_DOENTES_POR_ENFERMEIRO = 6;

    let geradas = 0;

    for (const data of seteDigasData) {
      const dow = data.getDay();
      const admissoesEsperadas = medias[dow] ?? 2;

      const msg = await this.callAI('staffing', {
        model: this.MODEL_FAST,
        max_tokens: 200,
        temperature: 0.1 as any,
        system: [{ type: 'text' as const, text: 'Prevê necessidades de pessoal de enfermagem hospitalar para o dia indicado. Responde APENAS com JSON: [{"turno":"manha|tarde|noite","pessoalRecomendado":N,"motivo":"máx 80 chars","confianca":"alta|media|baixa"}]', cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: JSON.stringify({
          data: data.toISOString().slice(0, 10),
          diaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dow],
          internadosActuais: internados,
          admissoesEsperadas: Math.round(admissoesEsperadas),
          ratioEnfermeiro: RATIO_DOENTES_POR_ENFERMEIRO,
        }) }],
      }).catch(() => null);

      if (!msg) continue;
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
      let previsoes: any[] = [];
      try {
        const match = texto.match(/\[[\s\S]*\]/);
        previsoes = match ? JSON.parse(match[0]) : [];
      } catch { continue; }

      for (const p of previsoes) {
        if (!turnos.includes(p.turno)) continue;
        const base = Math.ceil((internados + admissoesEsperadas) * ratioTurno[p.turno] / RATIO_DOENTES_POR_ENFERMEIRO);
        const existente = await this.prisma.aiStaffingPrevisao.findFirst({
          where: { data, turno: p.turno, servicoId: null },
        });
        if (existente) {
          await this.prisma.aiStaffingPrevisao.update({
            where: { id: existente.id },
            data: { pessoalRecomendado: p.pessoalRecomendado ?? base, motivo: p.motivo ?? '', confianca: p.confianca ?? 'media' },
          }).catch(() => null);
        } else {
          await this.prisma.aiStaffingPrevisao.create({
            data: { data, turno: p.turno, servicoId: null, pessoalAtual: null, pessoalRecomendado: p.pessoalRecomendado ?? base, motivo: p.motivo ?? '', confianca: p.confianca ?? 'media' },
          }).catch(() => null);
        }
        geradas++;
      }
    }

    this.logger.log(`Staffing previsão: ${geradas} previsões geradas para 7 dias`);
    return { geradas };
  }

  @Cron('0 22 * * *')
  async cronStaffingPrevisao(): Promise<void> {
    try {
      await this.preverNecessidadesPessoal();
    } catch (err) {
      this.logger.error('Cron staffing previsão falhou', err);
    }
  }

  async listarStaffingPrevisoes(dias = 7): Promise<any[]> {
    const inicio = new Date();
    const fim = new Date();
    fim.setDate(fim.getDate() + dias);
    return this.prisma.aiStaffingPrevisao.findMany({
      where: { data: { gte: inicio, lte: fim } },
      orderBy: [{ data: 'asc' }, { turno: 'asc' }],
    });
  }

  // ── 15. ICD-10 AI Suggestion ────────────────────────────────────────────────

  async sugerirIcd10(notaClinica: string): Promise<{ code: string; descricao: string; confianca: number }[]> {
    const msg = await this.callAI('icd10_sugestao', {
      model: this.MODEL_FAST,
      max_tokens: 300,
      temperature: 0.1 as any,
      system: [{ type: 'text' as const, text: 'És um sistema de codificação ICD-10 para hospital português. Com base na nota clínica, sugere os 3 códigos ICD-10 mais prováveis. Responde APENAS com JSON: [{"code":"X00.0","descricao":"descrição em português","confianca":0.95}]. Usa códigos ICD-10 reais. Ordena por confiança decrescente.', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: sanitizeForPrompt(notaClinica, 800) }],
    });
    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    try {
      const match = texto.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
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

      const msg = await this.callAI('feedback_analysis', {
        model: this.MODEL_FAST,
        max_tokens: 600,
        temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: 'Analisa padrões de rejeição de sugestões IA num sistema hospitalar e sugere ajustes nos prompts. Responde com JSON: [{"tipo":"string","taxaRejeicao":0.0,"padroes":"descrição dos padrões observados","sugestao":"ajuste recomendado no prompt"}]', cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Dados de rejeição da semana:\n${resumo}` }],
      });

      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
      let insights: any[] = [];
      try { const m = texto.match(/\[[\s\S]*\]/); insights = m ? JSON.parse(m[0]) : []; } catch { insights = []; }

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
          }).catch(() => null);
        } else {
          await this.prisma.aiPromptInsight.create({
            data: {
              semana,
              tipo: insight.tipo ?? 'desconhecido',
              taxaRejeicao: insight.taxaRejeicao ?? 0,
              padroes: insight.padroes ?? '',
              sugestao: insight.sugestao ?? '',
            },
          }).catch(() => null);
        }
      }

      if (insights.length > 0) {
        await this.notificacoes.enviarParaRole('ti',
          '⚠ IA: Taxa de rejeição elevada detectada',
          `${insights.length} tipo(s) com rejeição >20% na última semana. Ver insights em Auditoria IA.`,
        ).catch(() => null);
      }

      this.logger.log(`Feedback analysis semanal: ${insights.length} insights gerados`);
    } catch (err) {
      this.logger.error('Erro no feedback analysis semanal', err);
    }
  }

  @Cron('0 8 * * 1')
  async relatorioSemanalOutcomes(): Promise<void> {
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
