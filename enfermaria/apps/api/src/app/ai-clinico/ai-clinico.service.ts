import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GuidelinesService } from '../guidelines/guidelines.service';
import { AlertasService } from '../alertas/alertas.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly guidelines: GuidelinesService,
    private readonly alertasService: AlertasService,
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

  private async logDecisao(
    tipo: string,
    payload: any,
    utilizadorId: string,
    doenteId?: string,
  ): Promise<string | null> {
    try {
      const decisao = await this.prisma.aiDecisao.create({
        data: { tipo, payload, utilizadorId, doenteId },
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
      ? `És um sistema de apoio à decisão clínica para médicos em contexto hospitalar português. Analisa padrões nos sinais vitais, analíticas e contexto clínico. Nunca prescrevas medicamentos específicos. Termina com disclaimer. JSON: { "observacoes": ["..."], "padroesDetectados": ["..."], "investigacoesAConsiderar": ["..."], "disclaimer": "..." }`
      : `És um sistema de apoio à observação clínica de enfermagem em contexto hospitalar português. Só observações de sinais vitais. Nunca sugiras tratamentos. JSON: { "observacoes": ["..."], "disclaimer": "..." }`;

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
          model: 'claude-haiku-4-5-20251001',
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
      ? `És um sistema de apoio à decisão clínica para médicos em contexto hospitalar português. Analisa padrões nos sinais vitais, analíticas e contexto clínico. Nunca prescrevas medicamentos específicos. Termina com disclaimer. JSON: { "observacoes": ["..."], "padroesDetectados": ["..."], "investigacoesAConsiderar": ["..."], "disclaimer": "..." }`
      : `És um sistema de apoio à observação clínica de enfermagem em contexto hospitalar português. Só observações de sinais vitais. Nunca sugiras tratamentos. JSON: { "observacoes": ["..."], "disclaimer": "..." }`;

    const gCtx = await this.guidelinesCtx(doente.diagnosticoPrincipal ?? '');

    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 700, temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Analisa este doente:\n\n${contexto}${gCtx}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado = this.parseJson(texto, { observacoes: [texto], disclaimer: 'Apoio à decisão clínica. Não substitui avaliação médica.' });
      this.store(cacheKey, resultado);
      if (utilizadorId) {
        this.logDecisao('analise', resultado, utilizadorId, doenteId).then(id => {
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
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 500, temperature: 0.15 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à triagem de urgência hospitalar português (Sistema Manchester). Analisa o episódio e identifica: sinais de alarme imediatos, observações relevantes para o enfermeiro triador, e discriminadores Manchester a avaliar. REGRAS: Nunca diagnósticas definitivamente. Nunca substituis o enfermeiro triador. A decisão final é sempre do profissional. JSON: { "alertasVermelhos": ["..."], "nivelSugerido": "vermelho|laranja|amarelo|verde|azul", "observacoes": ["..."], "discriminadoresAvaliar": ["..."], "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Analisa este episódio de urgência:\n\n${contexto}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado = this.parseJson(texto, {
        alertasVermelhos: [], nivelSugerido: 'amarelo',
        observacoes: ['Não foi possível analisar o episódio automaticamente.'],
        discriminadoresAvaliar: [],
        disclaimer: 'Apoio à triagem. Decisão final do enfermeiro triador.',
      });
      this.store(cacheKey, resultado);
      if (utilizadorId) {
        this.logDecisao('triagem', resultado, utilizadorId).then(id => {
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
        const msg = await this.client.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 350, temperature: 0.1 as any,
          system: [{ type: 'text' as const, text: 'Gera observações clínicas concisas sobre protocolos em desvio num hospital português. Nunca prescrevas tratamentos. JSON: { "observacoes": ["..."] }', cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: `Doente: ${doente.nome}\nProtocolos:\n${contextoStr}` }],
        });
        const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
        const parsed = this.parseJson(texto, { observacoes: [] });
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
      this.logDecisao('protocolo', resultado, utilizadorId, doenteId).then(id => {
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
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 900, temperature: 0.3 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à passagem de turno hospitalar português. Gera uma narrativa de passagem de turno profissional, concisa e em português europeu. Destaca doentes críticos, alertas activos e tarefas pendentes. Termina com 3 destaques prioritários para o turno seguinte. JSON: { "narrativa": "...", "destaques": ["...", "...", "..."], "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Resume a passagem de turno para ${doentes.length} doentes:\n\n${contexto}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado: any = this.parseJson(texto, { narrativa: texto, destaques: [], disclaimer: 'Gerado por IA. Verificar com equipa clínica.' });
      if (utilizadorId) {
        this.logDecisao('turno', resultado, utilizadorId).then(id => {
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
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400, temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à previsão de tempo de internamento (LOS) hospitalar português. Com base nos dados clínicos, estima o número de dias adicionais de internamento esperados. JSON: { "losEstimadoDias": <número>, "confianca": "alta|media|baixa", "factores": ["..."], "alertaAtraso": <boolean>, "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Estima o LOS para este doente:\n\n${contexto}` }],
      });
      const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const resultado: any = this.parseJson(texto, {
        losEstimadoDias: diasParaAlta ?? 3,
        confianca: 'baixa', factores: [], alertaAtraso: false,
        disclaimer: 'Estimativa automática. Não substitui avaliação clínica.',
      });
      resultado.diasJaInternado = diasInternamento;
      this.store(cacheKey, resultado);
      if (utilizadorId) {
        this.logDecisao('los', resultado, utilizadorId, doenteId).then(id => {
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

        const requerAnalise =
          (ultimoSinal?.news2 ?? 0) >= 5 ||
          doente.estado === 'grave' ||
          doente.estado === 'critico' ||
          slopeNews2 >= 0.4;

        if (!requerAnalise) continue;

        const alertasAtivos = await this.prisma.alertaClinico.count({
          where: { doenteId: doente.id, lido: false, urgencia: true },
        });

        const contextoCompacto = `Doente: ${doente.nome} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'desconhecido'} | Estado: ${doente.estado} | NEWS2 atual: ${ultimoSinal?.news2 ?? 'sem registo'} | Tendência NEWS2 (slope/medição): ${slopeNews2.toFixed(2)} | Medições 24h: ${sinais24h.length} | SpO2: ${ultimoSinal?.saturacaoO2 ?? '?'}% | FC: ${ultimoSinal?.pulso ?? '?'} | Alertas urgentes: ${alertasAtivos}`;

        const msg = await this.client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          temperature: 0.1 as any,
          system: [{ type: 'text' as const, text: 'És um sistema de vigilância clínica hospitalar. Analisa dados e responde APENAS com JSON válido, sem texto adicional: {"deterioracao": boolean, "razao": "máx 80 chars"}', cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: contextoCompacto }],
        });

        const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
        const resultado = this.parseJson(texto, { deterioracao: false, razao: '' });

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

    const msg = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      temperature: 0.15 as any,
      system: [{ type: 'text' as const, text: 'Avalia risco de readmissão hospitalar nos 30 dias pós-alta com base em dados clínicos portugueses. Responde APENAS com JSON: { "risco": "baixo|medio|alto", "factores": ["string",...], "recomendacoes": ["string",...] }', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: contexto }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const resultado = this.parseJson(texto, { risco: 'baixo', factores: [], recomendacoes: [] });

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

    const msg = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: [
        { type: 'text', text: SYSTEM_DD, cache_control: { type: 'ephemeral' as const } },
        { type: 'text', text: built.contexto },
      ],
      messages: [{ role: 'user', content: `Sintomas/queixa actual: ${sintomas}` }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    const resultado = (() => { try { return JSON.parse(texto); } catch { return []; } })();

    this.logDecisao('diagnostico_diferencial', { sintomas, resultado }, utilizadorId, doenteId).catch(() => {});
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

    const msg = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      temperature: 0.1 as any,
      system: [{ type: 'text' as const, text: `Converte queries em linguagem natural para filtros Prisma sobre dados hospitalares.\n${schemaSimplificado}\nResponde APENAS com JSON válido (sem markdown): { "where": {filtros para tabela doente}, "include": {"sinaisVitais":{"orderBy":{"criadoEm":"desc"},"take":1}}, "take": número máx 20, "explicacao": "string curta em português" }\nPara relações (ex: doentes com news2 alto), usa where com nested sinaisVitais some.\nNunca retornes mais de 20 resultados. Sempre inclui ativo:true no where.`, cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: query }],
    });

    const texto = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const filtros = this.parseJson(texto, { where: { ativo: true }, take: 10, explicacao: 'Sem resultados' });

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
      this.logDecisao('nlq', { query, filtros, count: resultados.length }, utilizadorId).catch(() => {});
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

    const msg = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
}
