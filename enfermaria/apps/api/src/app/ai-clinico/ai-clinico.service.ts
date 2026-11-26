import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeForPrompt } from './prompt-sanitizer';
import { AI_MODELS } from '../common/ai-models';
import { doentesComOposicaoIA, exigirTratamentoPermitido } from '../common/consentimento-tratamento';
import { registarFalha } from '../common/falhas';
import { IaNucleoService, PSEUDONIMO_DOENTE, MARCADOR_NOME, textoDaResposta, extrairArrayJson } from './ia-nucleo.service';
import {
  parseWithSchema,
  AnaliseClinicoSchema,
  TriagemSchema,
  ProtocoloAiSchema,
  TurnoSchema,
  LOSSchema,
  NLQSchema,
} from './ai-response-schemas';

const TTL_LOS_MS = 2 * 60 * 60 * 1000;

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

/**
 * ARQ-06 — apoio clínico a pedido: análise do doente, triagem, protocolos, turno, LOS,
 * diagnóstico diferencial, pesquisa em linguagem natural, rascunho da carta de alta e ICD-10.
 * A vigilância em segundo plano está em `AiVigilanciaService`, a auditoria e os relatórios em
 * `AiRelatoriosService`, e a escalação de alertas (sem IA) em `alertas/escalacao-alertas`.
 */
@Injectable()
export class AiClinicoService {
  private readonly logger = new Logger(AiClinicoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: IaNucleoService,
  ) {}

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
      this.prisma.medicacao.findMany({ where: { doenteId, ativo: true, deletedAt: null }, select: { nome: true, dose: true, via: true }, take: 10 }),
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
Doente: ${PSEUDONIMO_DOENTE} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'não registado'} | Internado há ${diasInternamento} dias

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

    const gCtx = await this.ia.guidelinesCtx(doente.diagnosticoPrincipal ?? '');
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
        const stream = await this.ia.client.messages.stream({
          model: AI_MODELS.CLINICAL,
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
    await exigirTratamentoPermitido(this.prisma, doenteId, 'ia_clinica'); // SEC-19: oposição do doente
    const cacheKey = `doente:${doenteId}:${roleRequerente}`;
    const cached = this.ia.cached<any>(cacheKey);
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
      this.prisma.medicacao.findMany({ where: { doenteId, ativo: true, deletedAt: null }, select: { nome: true, dose: true, via: true }, take: 10 }),
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
Doente: ${PSEUDONIMO_DOENTE} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'não registado'} | Internado há ${diasInternamento} dias

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

    const gCtx = await this.ia.guidelinesCtx(doente.diagnosticoPrincipal ?? '');

    try {
      const msg = await this.ia.callAI('analisar', {
        model: AI_MODELS.CLINICAL, max_tokens: 700, temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Analisa este doente:\n\n${contexto}${gCtx}` }],
      });
      const texto = textoDaResposta(msg, '');
      const resultado = parseWithSchema(texto, AnaliseClinicoSchema, { observacoes: [texto], disclaimer: 'Apoio à decisão clínica. Não substitui avaliação médica.' });
      this.ia.store(cacheKey, resultado);
      if (utilizadorId) {
        this.ia.logDecisao('analise', resultado, utilizadorId, doenteId, { contexto, systemPrompt }).then(id => {
          if (id) (resultado as any)._decisaoId = id;
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
    const cached = this.ia.cached<any>(cacheKey);
    if (cached) return cached;

    const contexto = `
Queixa principal: ${episodio.queixaPrincipal}
Dados do doente: ${episodio.idadeAproximada ? `${episodio.idadeAproximada} anos` : 'idade desconhecida'} | ${episodio.sexo ?? 'sexo desconhecido'}
Consciência: ${episodio.consciente === true ? 'Consciente' : episodio.consciente === false ? 'Inconsciente' : 'N/A'} | Glasgow: ${episodio.glasgow ?? 'N/A'}/15
Mecanismo: ${episodio.mecanismo ?? 'N/A'} | Condição prévia: ${episodio.condicaoPrevia ?? 'Nenhuma'}
Vitais: TA ${episodio.vitalsPASistolica ?? '?'}/${episodio.vitalsPADiastolica ?? '?'} | FC ${episodio.vitalsFC ?? '?'} | SpO2 ${episodio.vitalsSpO2 ?? '?'}% | FR ${episodio.vitalsFR ?? '?'} | NEWS2 ${episodio.news2Triagem ?? 'N/A'}
`.trim();

    try {
      const msg = await this.ia.callAI('triagem', {
        model: AI_MODELS.FAST, max_tokens: 500, temperature: 0.15 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à triagem de urgência hospitalar português (Sistema Manchester). Analisa o episódio e identifica: sinais de alarme imediatos, observações relevantes para o enfermeiro triador, e discriminadores Manchester a avaliar. REGRAS: Nunca diagnósticas definitivamente. Nunca substituis o enfermeiro triador. A decisão final é sempre do profissional. JSON: { "alertasVermelhos": ["..."], "nivelSugerido": "vermelho|laranja|amarelo|verde|azul", "observacoes": ["..."], "discriminadoresAvaliar": ["..."], "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Analisa este episódio de urgência:\n\n${contexto}` }],
      });
      const texto = textoDaResposta(msg, '');
      const resultado = parseWithSchema(texto, TriagemSchema, {
        alertasVermelhos: [], nivelSugerido: 'amarelo' as const,
        observacoes: ['Não foi possível analisar o episódio automaticamente.'],
        discriminadoresAvaliar: [],
        disclaimer: 'Apoio à triagem. Decisão final do enfermeiro triador.',
      });
      this.ia.store(cacheKey, resultado);
      if (utilizadorId) {
        this.ia.logDecisao('triagem', resultado, utilizadorId, undefined, { contexto }).then(id => {
          if (id) (resultado as any)._decisaoId = id;
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
    await exigirTratamentoPermitido(this.prisma, doenteId, 'ia_clinica'); // SEC-19: oposição do doente
    const cacheKey = `protocolo:${doenteId}`;
    const cached = this.ia.cached<any>(cacheKey);
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
        const msg = await this.ia.callAI('protocolo', {
          model: AI_MODELS.FAST, max_tokens: 350, temperature: 0.1 as any,
          system: [{ type: 'text' as const, text: 'Gera observações clínicas concisas sobre protocolos em desvio num hospital português. Nunca prescrevas tratamentos. JSON: { "observacoes": ["..."] }', cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: `Doente: ${PSEUDONIMO_DOENTE}\nProtocolos:\n${contextoStr}` }],
        });
        const texto = textoDaResposta(msg, '');
        const parsed = parseWithSchema(texto, ProtocoloAiSchema, { observacoes: [] });
        observacoesAI = parsed.observacoes ?? [];
      } catch { /* silencioso */ }
    }

    const resultado: any = {
      protocolos,
      observacoesAI,
      disclaimer: 'Verificação automática de protocolos. Não substitui avaliação clínica.',
    };
    this.ia.store(cacheKey, resultado);
    if (utilizadorId) {
      this.ia.logDecisao('protocolo', resultado, utilizadorId, doenteId, { protocolos }).then(id => {
        if (id) resultado._decisaoId = id;
      });
    }
    return resultado;
  }

  // ── 4. Sumarização de Passagem de Turno ─────────────────────────────────────

  async sumarizarTurno(doentes: DoenteTurno[], utilizadorId?: string) {
    if (doentes.length === 0) return { narrativa: 'Sem doentes no serviço.', destaques: [], disclaimer: '' };

    const contexto = doentes
      .map((d, i) => `${i + 1}. Doente ${i + 1} (Cama ${d.cama}) — ${d.diagnostico} — NEWS2: ${d.news2 ?? 'sem registo'} — Alertas: ${d.alertas.join(', ') || 'nenhum'} — Tarefas pendentes: ${d.tarefasPendentes.join(', ') || 'nenhuma'}`)
      .join('\n');

    try {
      const msg = await this.ia.callAI('turno', {
        model: AI_MODELS.FAST, max_tokens: 900, temperature: 0.3 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à passagem de turno hospitalar português. Gera uma narrativa de passagem de turno profissional, concisa e em português europeu. Destaca doentes críticos, alertas activos e tarefas pendentes. Termina com 3 destaques prioritários para o turno seguinte. JSON: { "narrativa": "...", "destaques": ["...", "...", "..."], "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Resume a passagem de turno para ${doentes.length} doentes:\n\n${contexto}` }],
      });
      const texto = textoDaResposta(msg, '');
      const resultado: any = parseWithSchema(texto, TurnoSchema, { narrativa: texto, destaques: [], disclaimer: 'Gerado por IA. Verificar com equipa clínica.' });
      if (utilizadorId) {
        this.ia.logDecisao('turno', resultado, utilizadorId, undefined, { contexto }).then(id => {
          if (id) (resultado as any)._decisaoId = id;
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
    const cached = this.ia.cached<any>(cacheKey);
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

    // SEC-19: quem se opôs à IA clínica não entra no texto enviado ao modelo.
    const oposicao = await doentesComOposicaoIA(this.prisma, doentesDb.map((d) => d.id));
    const doentes: DoenteTurno[] = doentesDb.filter((d) => !oposicao.has(d.id)).map(d => ({
      nome: d.nome,
      cama: d.cama ? `${d.cama.quarto}/${d.cama.numero}` : '—',
      diagnostico: d.diagnosticoPrincipal ?? 'sem diagnóstico',
      news2: d.sinaisVitais[0]?.news2 ?? null,
      alertas: d.alertasClinicos.map((a: any) => a.tipo),
      tarefasPendentes: d.tarefas.map((t: any) => `${t.descricao}${t.prioridade === 'urgente' ? ' (urgente)' : ''}`),
    }));

    const resultado: any = await this.sumarizarTurno(doentes, utilizadorId);
    if (oposicao.size > 0) {
      resultado.excluidosPorOposicao = oposicao.size;
      resultado.narrativa = `${resultado.narrativa ?? ''}\n\n(${oposicao.size} doente(s) não incluído(s): oposição ao uso de IA — rever manualmente.)`;
    }
    this.ia.store(cacheKey, resultado);
    return resultado;
  }

  // ── 6. Previsão LOS (Length of Stay) ────────────────────────────────────────

  async preverLOS(doenteId: string, utilizadorId?: string) {
    await exigirTratamentoPermitido(this.prisma, doenteId, 'ia_clinica'); // SEC-19: oposição do doente
    const cacheKey = `los:${doenteId}`;
    const cached = this.ia.cached<any>(cacheKey, TTL_LOS_MS);
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
      const msg = await this.ia.callAI('los', {
        model: AI_MODELS.FAST, max_tokens: 400, temperature: 0.2 as any,
        system: [{ type: 'text' as const, text: `És um sistema de apoio à previsão de tempo de internamento (LOS) hospitalar português. Com base nos dados clínicos, estima o número de dias adicionais de internamento esperados. JSON: { "losEstimadoDias": <número>, "confianca": "alta|media|baixa", "factores": ["..."], "alertaAtraso": <boolean>, "disclaimer": "..." }`, cache_control: { type: 'ephemeral' as const } }],
        messages: [{ role: 'user', content: `Estima o LOS para este doente:\n\n${contexto}` }],
      });
      const texto = textoDaResposta(msg, '');
      const resultado: any = parseWithSchema(texto, LOSSchema, {
        losEstimadoDias: diasParaAlta ?? 3,
        confianca: 'baixa' as const, factores: [], alertaAtraso: false,
        disclaimer: 'Estimativa automática. Não substitui avaliação clínica.',
      });
      resultado.diasJaInternado = diasInternamento;
      this.ia.store(cacheKey, resultado);
      if (utilizadorId) {
        this.ia.logDecisao('los', resultado, utilizadorId, doenteId, { contexto }).then(id => {
          if (id) (resultado as any)._decisaoId = id;
        });
      }
      return resultado;
    } catch (err) {
      this.logger.warn('Erro ao prever LOS', err);
      throw err;
    }
  }

  // ── 10. NLQ — Natural Language Query sobre dados hospitalares ────────────────

  async diagnosticoDiferencial(doenteId: string, sintomas: string, utilizadorId: string) {
    await exigirTratamentoPermitido(this.prisma, doenteId, 'ia_clinica'); // SEC-19: oposição do doente
    const built = await this.buildContextoAnalisar(doenteId, 'medico');
    if (!built) return [];

    const SYSTEM_DD = `És um especialista em medicina interna. Gera um diagnóstico diferencial estruturado em JSON.
Formato de resposta: [{"diagnostico":"...","probabilidade":"Alta|Média|Baixa","justificacao":"...","proximos_passos":"..."}]
Máximo 5 diagnósticos. Ordena por probabilidade decrescente. Responde APENAS com JSON válido, sem texto adicional.`;

    const msg = await this.ia.callAI('diagnostico_diferencial', {
      model: AI_MODELS.CLINICAL,
      max_tokens: 1200,
      system: [
        { type: 'text', text: SYSTEM_DD, cache_control: { type: 'ephemeral' as const } },
        { type: 'text', text: built.contexto },
      ],
      messages: [{ role: 'user', content: `Sintomas/queixa actual: ${sanitizeForPrompt(sintomas, 600)}` }],
    });

    const texto = textoDaResposta(msg, '[]');
    const resultado = extrairArrayJson(texto);

    this.ia.logDecisao('diagnostico_diferencial', { sintomas, resultado }, utilizadorId, doenteId, { sintomas }).catch(registarFalha('ia:registo-decisao', 'erro'));
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

    const msg = await this.ia.callAI('nlq', {
      model: AI_MODELS.FAST,
      max_tokens: 400,
      temperature: 0.1 as any,
      system: [{ type: 'text' as const, text: `Converte queries em linguagem natural para filtros Prisma sobre dados hospitalares.\n${schemaSimplificado}\nResponde APENAS com JSON válido (sem markdown): { "where": {filtros para tabela doente}, "include": {"sinaisVitais":{"orderBy":{"criadoEm":"desc"},"take":1}}, "take": número máx 20, "explicacao": "string curta em português" }\nPara relações (ex: doentes com news2 alto), usa where com nested sinaisVitais some.\nNunca retornes mais de 20 resultados. Sempre inclui ativo:true no where.`, cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: sanitizeForPrompt(query, 400) }],
    });

    const texto = textoDaResposta(msg, '{}');
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
      this.ia.logDecisao('nlq', { filtros, count: resultados.length }, utilizadorId, undefined, { query }).catch(registarFalha('ia:registo-decisao', 'erro'));
    }

    return { resultados, explicacao: filtros.explicacao ?? 'Pesquisa concluída', total: resultados.length };
  }

  // ── 11. Carta de Alta para Médico de Família ──────────────────────────────────

  /**
   * PROD-11: gera apenas um RASCUNHO da carta (estado `rascunho`). Um médico tem de o rever
   * e assinar (`CartaAltaService`) antes de existir PDF. A medicação de saída NÃO é pedida
   * ao modelo — o PDF lista-a a partir das prescrições estruturadas — e a carta não é
   * "assinada" pelo produto. Uma carta já assinada nunca é reescrita.
   */
  async gerarCartaAlta(doenteId: string): Promise<void> {
    await exigirTratamentoPermitido(this.prisma, doenteId, 'ia_clinica'); // SEC-19: oposição do doente
    // PROD-02: a carta é a do último internamento (um sumário por episódio).
    const atual = await this.prisma.sumarioAlta.findFirst({ where: { doenteId }, orderBy: { criadoEm: 'desc' }, select: { id: true, cartaAltaEstado: true } });
    if (atual?.cartaAltaEstado === 'assinada') {
      throw new ConflictException('A carta de alta já está assinada e não pode ser regenerada.');
    }
    const doente = await this.prisma.doente.findUnique({
      where: { id: doenteId },
      select: {
        nome: true,
        diagnosticoPrincipal: true,
        dataAdmissao: true,
        dataNascimento: true,
        sumariosAlta: {
          orderBy: { criadoEm: 'desc' }, take: 1,
          select: { motivoAlta: true, resumoClinical: true, prescricaoSaida: true, medicoFamilia: true, criadoEm: true },
        },
        sinaisVitais: { orderBy: { data: 'desc' }, take: 1, select: { news2: true, pulso: true, pressaoSistolica: true, saturacaoO2: true, temperatura: true } },
        problemas: { where: { estado: 'ativo' }, select: { descricao: true }, take: 5 },
        notasClincias: { orderBy: { criadaEm: 'desc' }, take: 2, select: { subjetivo: true, plano: true } },
      },
    });

    const sumario = doente?.sumariosAlta[0];
    if (!doente || !sumario || !atual) return;

    const dataAdmissao = new Date(doente.dataAdmissao).toLocaleDateString('pt-PT');
    const dataAlta = new Date(sumario.criadoEm).toLocaleDateString('pt-PT');
    const idade = doente.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 86_400_000))
      : null;

    const contexto = JSON.stringify({
      // ARQ-05: o nome não sai do hospital — o modelo escreve o marcador e substitui-se cá.
      nomePaciente: MARCADOR_NOME,
      idade,
      dataAdmissao,
      dataAlta,
      diagnosticoPrincipal: doente.diagnosticoPrincipal,
      motivoAlta: sumario.motivoAlta,
      resumoClinical: sumario.resumoClinical,
      prescricaoSaida: sumario.prescricaoSaida,
      medicoFamilia: sumario.medicoFamilia,
      problemasActivos: doente.problemas.map(p => p.descricao),
    });

    const msg = await this.ia.callAI('carta_alta', {
      model: AI_MODELS.CLINICAL,
      max_tokens: 900,
      system: [{ type: 'text' as const, text: 'Gera uma carta de alta médica em português europeu formal (formato A4, 280-350 palavras). A carta é enviada ao médico de família. Inclui: cabeçalho com data, identificação do doente, diagnóstico principal, resumo da evolução clínica, recomendações pós-alta e follow-up. NÃO escrevas medicação nem doses: a medicação de saída é anexada pelo sistema a partir das prescrições. NÃO assines a carta nem inventes nomes: termina com "O médico assistente" — a carta é um rascunho que um médico vai rever e assinar. Usa só os dados fornecidos; se faltar informação, omite-a. Responde APENAS com o texto da carta, sem JSON, sem markdown.', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: contexto }],
    });

    const textoModelo = textoDaResposta(msg, '');
    if (!textoModelo) return;
    // Reidentificação local: o marcador volta a ser o nome só depois da resposta.
    const carta = textoModelo.split(MARCADOR_NOME).join(doente.nome);

    // Rascunho: qualquer revisão anterior deixa de valer, porque o texto mudou. Condicional
    // ao estado: se a carta foi assinada enquanto o modelo escrevia, não é reescrita.
    await this.prisma.sumarioAlta.updateMany({
      where: { id: atual.id, OR: [{ cartaAltaEstado: null }, { cartaAltaEstado: { not: 'assinada' } }] },
      data: { cartaAlta: carta, cartaAltaEstado: 'rascunho', cartaAltaRevistaPorId: null, cartaAltaRevistaEm: null },
    }).catch(err => this.logger.warn('Erro ao guardar carta de alta', (err as any)?.message));
  }

  // ── 13. Previsão de pessoal — PROD-17: retirada. O número de enfermeiros era pedido a um LLM
  // com um rácio fixo de 6 doentes por enfermeiro; passou a ser um cálculo determinístico por
  // serviço e turno (horas de cuidados por dependência vs horas disponíveis) — ver dotacoes/.

  // ── 15. ICD-10 AI Suggestion ────────────────────────────────────────────────

  async sugerirIcd10(notaClinica: string): Promise<{ code: string; descricao: string; confianca: number }[]> {
    const msg = await this.ia.callAI('icd10_sugestao', {
      model: AI_MODELS.FAST,
      max_tokens: 300,
      temperature: 0.1 as any,
      system: [{ type: 'text' as const, text: 'És um sistema de codificação ICD-10 para hospital português. Com base na nota clínica, sugere os 3 códigos ICD-10 mais prováveis. Responde APENAS com JSON: [{"code":"X00.0","descricao":"descrição em português","confianca":0.95}]. Usa códigos ICD-10 reais. Ordena por confiança decrescente.', cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: sanitizeForPrompt(notaClinica, 800) }],
    });
    const texto = textoDaResposta(msg, '[]');
    return extrairArrayJson(texto);
  }
}
