import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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

  async analisar(doenteId: string, roleRequerente: string, utilizadorId?: string) {
    const cacheKey = `doente:${doenteId}:${roleRequerente}`;
    const cached = this.cached<any>(cacheKey);
    if (cached) return cached;

    const [doente, ultimosSV, medicacoes, alertas, sinalizacoes, baseline, sepsis, exames] = await Promise.all([
      this.prisma.doente.findUnique({
        where: { id: doenteId },
        select: { nome: true, diagnosticoPrincipal: true, dataAdmissao: true, servico: true },
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
Doente: ${doente.nome} | Diagnóstico: ${doente.diagnosticoPrincipal ?? 'não registado'} | Internado há ${diasInternamento} dias | Serviço: ${doente.servico}

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

    try {
      const msg = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 700, temperature: 0.2 as any,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Analisa este doente:\n\n${contexto}` }],
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
        system: `És um sistema de apoio à triagem de urgência hospitalar português (Sistema Manchester). Analisa o episódio e identifica: sinais de alarme imediatos, observações relevantes para o enfermeiro triador, e discriminadores Manchester a avaliar. REGRAS: Nunca diagnósticas definitivamente. Nunca substituis o enfermeiro triador. A decisão final é sempre do profissional. JSON: { "alertasVermelhos": ["..."], "nivelSugerido": "vermelho|laranja|amarelo|verde|azul", "observacoes": ["..."], "discriminadoresAvaliar": ["..."], "disclaimer": "..." }`,
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
      this.prisma.alertaSepsis.findFirst({ where: { doenteId, resolvido: false }, select: { criadoEm: true, criterio: true, score: true, bundle: true } }),
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
      const bundle = (sepsis.bundle as Record<string, boolean>) ?? {};
      const accoesFeitas = Object.values(bundle).filter(Boolean).length;
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
          system: 'Gera observações clínicas concisas sobre protocolos em desvio num hospital português. Nunca prescrevas tratamentos. JSON: { "observacoes": ["..."] }',
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
        system: `És um sistema de apoio à passagem de turno hospitalar português. Gera uma narrativa de passagem de turno profissional, concisa e em português europeu. Destaca doentes críticos, alertas activos e tarefas pendentes. Termina com 3 destaques prioritários para o turno seguinte. JSON: { "narrativa": "...", "destaques": ["...", "...", "..."], "disclaimer": "..." }`,
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

    const doentesDb = await this.prisma.doente.findMany({
      where: { ativo: true, servico: servico as any },
      select: {
        id: true, nome: true, diagnosticoPrincipal: true,
        cama: { select: { numero: true, quarto: true } },
        sinaisVitais: { orderBy: { registadoEm: 'desc' }, take: 1, select: { news2: true } },
        alertasClinicos: { where: { resolvido: false }, select: { tipo: true } },
        tarefas: { where: { estado: { in: ['pendente', 'em_progresso'] } }, select: { descricao: true, prioridade: true } },
      },
    });

    const doentes: DoenteTurno[] = doentesDb.map(d => ({
      nome: d.nome,
      cama: d.cama ? `${d.cama.quarto}/${d.cama.numero}` : '—',
      diagnostico: d.diagnosticoPrincipal ?? 'sem diagnóstico',
      news2: d.sinaisVitais[0]?.news2 ?? null,
      alertas: d.alertasClinicos.map(a => a.tipo),
      tarefasPendentes: d.tarefas.map(t => `${t.descricao}${t.prioridade === 'urgente' ? ' (urgente)' : ''}`),
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
        estado: true, servico: true,
        sinaisVitais: { orderBy: { data: 'desc' }, take: 3, select: { news2: true, data: true } },
        alertasClinicos: { where: { resolvido: false }, select: { tipo: true } },
        alertasSepsis: { where: { resolvido: false }, take: 1 },
        planoAlta: { select: { dataAltaPrevista: true } },
      },
    });
    if (!doente) return null;

    const diasInternamento = Math.floor((Date.now() - new Date(doente.dataAdmissao).getTime()) / 86_400_000);
    const idade = doente.dataNascimento
      ? Math.floor((Date.now() - new Date(doente.dataNascimento).getTime()) / (365.25 * 86_400_000))
      : null;
    const news2Atual = doente.sinaisVitais[0]?.news2 ?? null;
    const temSepsis = doente.alertasSepsis.length > 0;
    const altaPrevista = doente.planoAlta?.dataAltaPrevista;
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
        system: `És um sistema de apoio à previsão de tempo de internamento (LOS) hospitalar português. Com base nos dados clínicos, estima o número de dias adicionais de internamento esperados. JSON: { "losEstimadoDias": <número>, "confianca": "alta|media|baixa", "factores": ["..."], "alertaAtraso": <boolean>, "disclaimer": "..." }`,
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
}
