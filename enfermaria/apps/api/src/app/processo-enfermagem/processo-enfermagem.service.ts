import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConjuntoCuidadosResumo, DiagnosticoPlano, ItemCatalogoCuidados, PlanoCuidados } from '@org/shared';
import { PrismaService } from '../prisma/prisma.service';
import { classificarTomas, tomasPlaneadas } from '../medicacao/posologia';
import { frequenciaValida, sugerirDiagnosticos } from './sugestoes';
import base from './catalogo-base.json';

/** Janela do turno para os registos devidos (como em "O meu turno"). */
const ANTES_MS = 4 * 3_600_000;
const DEPOIS_MS = 60 * 60_000;

interface NovaIntervencao { catalogoId?: string; termo?: string; frequencia: string }
export interface NovoDiagnostico {
  catalogoId?: string;
  termo?: string;
  juizo?: string;
  resultadoEsperado?: string;
  origem?: 'manual' | 'escala' | 'conjunto';
  origemRef?: string;
  intervencoes?: NovaIntervencao[];
}

/**
 * PROD-07 — processo de enfermagem: avaliação inicial → diagnósticos com juízo →
 * intervenções com frequência (os registos devidos entram no turno) → execuções → reavaliação.
 */
@Injectable()
export class ProcessoEnfermagemService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Catálogo ────────────────────────────────────────────────────────────────

  /** Carrega o catálogo base (idempotente: só acrescenta o que falta). */
  async importarCatalogoBase() {
    const antes = await this.prisma.catalogoCuidados.count();
    for (const d of base.diagnosticos) {
      await this.prisma.catalogoCuidados.upsert({
        where: { tipo_termo: { tipo: 'diagnostico', termo: d.termo } },
        update: {},
        create: { tipo: 'diagnostico', termo: d.termo, foco: d.foco },
      });
    }
    for (const i of base.intervencoes) {
      await this.prisma.catalogoCuidados.upsert({
        where: { tipo_termo: { tipo: 'intervencao', termo: i.termo } },
        update: {},
        create: { tipo: 'intervencao', termo: i.termo, frequenciaSugerida: i.frequenciaSugerida },
      });
    }
    for (const c of base.conjuntos) {
      await this.prisma.conjuntoCuidados.upsert({
        where: { nome: c.nome },
        update: {},
        create: { nome: c.nome, descricao: c.descricao, itens: c.itens as object },
      });
    }
    const criados = (await this.prisma.catalogoCuidados.count()) - antes;
    return { diagnosticos: base.diagnosticos.length, intervencoes: base.intervencoes.length, conjuntos: base.conjuntos.length, criados };
  }

  async catalogo(tipo?: string, servico?: string): Promise<ItemCatalogoCuidados[]> {
    const itens = await this.prisma.catalogoCuidados.findMany({
      where: {
        ativo: true,
        ...(tipo ? { tipo } : {}),
        ...(servico ? { OR: [{ servicos: { isEmpty: true } }, { servicos: { has: servico } }] } : {}),
      },
      orderBy: { termo: 'asc' },
      take: 500,
    });
    return itens.map((i) => ({ id: i.id, tipo: i.tipo as 'diagnostico' | 'intervencao', termo: i.termo, foco: i.foco, codigoCipe: i.codigoCipe, frequenciaSugerida: i.frequenciaSugerida }));
  }

  async conjuntos(servico?: string): Promise<ConjuntoCuidadosResumo[]> {
    const cs = await this.prisma.conjuntoCuidados.findMany({
      where: { ativo: true, ...(servico ? { OR: [{ servicos: { isEmpty: true } }, { servicos: { has: servico } }] } : {}) },
      orderBy: { nome: 'asc' },
    });
    return cs.map((c) => ({ id: c.id, nome: c.nome, descricao: c.descricao }));
  }

  // ── Avaliação inicial ───────────────────────────────────────────────────────

  private async episodioAtivo(doenteId: string): Promise<string | null> {
    const e = await this.prisma.episodioInternamento.findFirst({ where: { doenteId, estado: 'ativo' }, select: { id: true }, orderBy: { criadoEm: 'desc' } });
    return e?.id ?? null;
  }

  async avaliacaoInicial(doenteId: string) {
    const episodioId = await this.episodioAtivo(doenteId);
    return this.prisma.avaliacaoInicialEnfermagem.findFirst({
      where: { doenteId, ...(episodioId ? { episodioId } : {}) },
      orderBy: { atualizadaEm: 'desc' },
      include: { avaliadoPor: { select: { nome: true } } },
    });
  }

  /** Uma avaliação por episódio: guardar de novo actualiza-a (o histórico fica na auditoria). */
  async guardarAvaliacaoInicial(doenteId: string, utilizadorId: string, dto: { dados: Record<string, unknown>; completa?: boolean }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const episodioId = await this.episodioAtivo(doenteId);
    const existente = await this.prisma.avaliacaoInicialEnfermagem.findFirst({ where: { doenteId, episodioId }, select: { id: true } });
    const data = { dados: dto.dados as object, completa: !!dto.completa, avaliadoPorId: utilizadorId };
    return existente
      ? this.prisma.avaliacaoInicialEnfermagem.update({ where: { id: existente.id }, data })
      : this.prisma.avaliacaoInicialEnfermagem.create({ data: { ...data, doenteId, episodioId } });
  }

  // ── Plano de cuidados ───────────────────────────────────────────────────────

  async plano(doenteId: string, agora = new Date()): Promise<PlanoCuidados<Date>> {
    const desde = new Date(agora.getTime() - ANTES_MS);
    const ate = new Date(agora.getTime() + DEPOIS_MS);
    const [diagnosticos, avaliacao, sugestoes] = await Promise.all([
      this.prisma.diagnosticoEnfermagem.findMany({
        where: { doenteId, estado: 'ativo' },
        orderBy: { identificadoEm: 'asc' },
        include: {
          identificadoPor: { select: { nome: true } },
          avaliacoes: { orderBy: { avaliadoEm: 'desc' }, take: 1 },
          intervencoes: {
            where: { estado: 'ativa' },
            orderBy: { iniciadaEm: 'asc' },
            include: {
              execucoes: {
                where: { executadaEm: { gte: new Date(desde.getTime() - 3 * 3_600_000) } },
                orderBy: { executadaEm: 'desc' },
                include: { executadaPor: { select: { nome: true } } },
              },
            },
          },
        },
      }),
      this.avaliacaoInicial(doenteId),
      this.sugestoes(doenteId),
    ]);

    let devidas = 0;
    let emAtraso = 0;
    const ds: DiagnosticoPlano<Date>[] = diagnosticos.map((d) => ({
      id: d.id, termo: d.termo, juizo: d.juizo, origem: d.origem, estado: d.estado,
      resultadoEsperado: d.resultadoEsperado, identificadoEm: d.identificadoEm, identificadoPor: d.identificadoPor.nome,
      ultimaAvaliacao: d.avaliacoes[0] ? { evolucao: d.avaliacoes[0].evolucao, em: d.avaliacoes[0].avaliadoEm, nota: d.avaliacoes[0].nota } : null,
      intervencoes: d.intervencoes.map((i) => {
        const feitas = i.execucoes.filter((e) => e.realizada).map((e) => e.executadaEm);
        const tomas = classificarTomas(tomasPlaneadas(i.frequencia, desde, ate, i.iniciadaEm), feitas, agora)
          .filter((t) => t.hora.getTime() <= ate.getTime());
        for (const t of tomas) {
          if (t.estado === 'em_atraso') emAtraso++;
          else if (t.estado === 'devida') devidas++;
        }
        const ult = i.execucoes[0];
        return {
          id: i.id, termo: i.termo, frequencia: i.frequencia, estado: i.estado, iniciadaEm: i.iniciadaEm,
          devidas: tomas.map((t) => ({ hora: t.hora, estado: t.estado === 'administrada' ? 'realizada' as const : t.estado })),
          ultimaExecucao: ult ? { em: ult.executadaEm, por: ult.executadaPor.nome, realizada: ult.realizada, nota: ult.nota ?? ult.motivoNaoRealizada } : null,
        };
      }),
    }));

    return {
      avaliacaoInicial: avaliacao ? { id: avaliacao.id, completa: avaliacao.completa, atualizadaEm: avaliacao.atualizadaEm, por: avaliacao.avaliadoPor.nome } : null,
      diagnosticos: ds,
      sugestoes,
      resumo: { devidas, emAtraso },
    };
  }

  /** Para "O meu turno": registos de enfermagem devidos/em atraso por doente. */
  async resumoTurno(doenteIds: string[], agora = new Date()): Promise<Map<string, { devidas: number; emAtraso: number }>> {
    const res = new Map<string, { devidas: number; emAtraso: number }>();
    if (!doenteIds.length) return res;
    const desde = new Date(agora.getTime() - ANTES_MS);
    const ate = new Date(agora.getTime() + DEPOIS_MS);
    const ints = await this.prisma.intervencaoEnfermagem.findMany({
      where: { doenteId: { in: doenteIds }, estado: 'ativa', diagnostico: { estado: 'ativo' } },
      select: { doenteId: true, frequencia: true, iniciadaEm: true, execucoes: { where: { realizada: true, executadaEm: { gte: new Date(desde.getTime() - 3 * 3_600_000) } }, select: { executadaEm: true } } },
    });
    for (const i of ints) {
      const r = res.get(i.doenteId) ?? { devidas: 0, emAtraso: 0 };
      for (const t of classificarTomas(tomasPlaneadas(i.frequencia, desde, ate, i.iniciadaEm), i.execucoes.map((e) => e.executadaEm), agora)) {
        if (t.hora.getTime() > ate.getTime()) continue;
        if (t.estado === 'em_atraso') r.emAtraso++;
        else if (t.estado === 'devida') r.devidas++;
      }
      res.set(i.doenteId, r);
    }
    return res;
  }

  async sugestoes(doenteId: string) {
    const [riscos, escalas, dor, ativos] = await Promise.all([
      this.prisma.avaliacaoRisco.findMany({ where: { doenteId, tipo: { in: ['braden', 'morse'] } }, orderBy: { criadaEm: 'desc' }, take: 10 }),
      this.prisma.escalaClinica.findMany({ where: { doenteId, tipo: { in: ['Barthel', 'NRS2002'] } }, orderBy: { registadaEm: 'desc' }, take: 10 }),
      this.prisma.sinalVital.findFirst({ where: { doenteId, dor: { not: null }, data: { gte: new Date(Date.now() - 12 * 3_600_000) } }, orderBy: { data: 'desc' }, select: { id: true, dor: true } }),
      this.prisma.diagnosticoEnfermagem.findMany({ where: { doenteId, estado: 'ativo' }, select: { termo: true } }),
    ]);
    const braden = riscos.find((r) => r.tipo === 'braden');
    const morse = riscos.find((r) => r.tipo === 'morse');
    const barthel = escalas.find((e) => e.tipo === 'Barthel');
    const nrs = escalas.find((e) => e.tipo === 'NRS2002');
    return sugerirDiagnosticos({
      braden: braden ? { risco: braden.risco, pontuacao: braden.pontuacao, id: braden.id } : null,
      morse: morse ? { risco: morse.risco, pontuacao: morse.pontuacao, id: morse.id } : null,
      barthel: barthel ? { pontuacao: barthel.pontuacao, id: barthel.id } : null,
      nrs2002: nrs ? { pontuacao: nrs.pontuacao, id: nrs.id } : null,
      dor: dor?.dor != null ? { valor: dor.dor, id: dor.id } : null,
      ativos: ativos.map((a) => a.termo),
    });
  }

  private async termoDoCatalogo(tipo: 'diagnostico' | 'intervencao', catalogoId?: string, termo?: string) {
    if (catalogoId) {
      const c = await this.prisma.catalogoCuidados.findUnique({ where: { id: catalogoId } });
      if (!c || c.tipo !== tipo) throw new BadRequestException(`Item do catálogo inválido para ${tipo}.`);
      return { catalogoId: c.id, termo: c.termo };
    }
    const t = termo?.trim();
    if (!t) throw new BadRequestException(`Indique o ${tipo} (do catálogo ou por extenso).`);
    const c = await this.prisma.catalogoCuidados.findUnique({ where: { tipo_termo: { tipo, termo: t } } });
    return { catalogoId: c?.id ?? null, termo: t };
  }

  async criarDiagnostico(doenteId: string, utilizadorId: string, dto: NovoDiagnostico) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const diag = await this.termoDoCatalogo('diagnostico', dto.catalogoId, dto.termo);
    const ativo = await this.prisma.diagnosticoEnfermagem.findFirst({ where: { doenteId, estado: 'ativo', termo: diag.termo }, select: { id: true } });
    if (ativo) throw new ConflictException(`O diagnóstico "${diag.termo}" já está ativo no plano.`);
    const intervencoes: { catalogoId: string | null; termo: string; frequencia: string }[] = [];
    for (const i of dto.intervencoes ?? []) {
      if (!frequenciaValida(i.frequencia)) throw new BadRequestException(`Frequência inválida: "${i.frequencia}" (ex.: 8/8h, 3x/dia, 1x/dia, SOS).`);
      intervencoes.push({ ...(await this.termoDoCatalogo('intervencao', i.catalogoId, i.termo)), frequencia: i.frequencia.trim() });
    }
    const episodioId = await this.episodioAtivo(doenteId);
    return this.prisma.diagnosticoEnfermagem.create({
      data: {
        doenteId, episodioId, catalogoId: diag.catalogoId, termo: diag.termo,
        juizo: dto.juizo?.trim() || null, resultadoEsperado: dto.resultadoEsperado?.trim() || null,
        origem: dto.origem ?? 'manual', origemRef: dto.origemRef ?? null, identificadoPorId: utilizadorId,
        intervencoes: { create: intervencoes.map((i) => ({ ...i, doenteId, criadaPorId: utilizadorId })) },
      },
      include: { intervencoes: true },
    });
  }

  /** Aplica um conjunto tipo: cria os diagnósticos que ainda não estão ativos. */
  async aplicarConjunto(doenteId: string, utilizadorId: string, conjuntoId: string) {
    const c = await this.prisma.conjuntoCuidados.findUnique({ where: { id: conjuntoId } });
    if (!c || !c.ativo) throw new NotFoundException('Conjunto de cuidados não encontrado.');
    const itens = c.itens as unknown as { diagnostico: string; juizo?: string; intervencoes: { termo: string; frequencia: string }[] }[];
    const criados: string[] = [];
    const ignorados: string[] = [];
    for (const it of itens) {
      try {
        await this.criarDiagnostico(doenteId, utilizadorId, { termo: it.diagnostico, juizo: it.juizo, origem: 'conjunto', origemRef: c.id, intervencoes: it.intervencoes });
        criados.push(it.diagnostico);
      } catch (e) {
        if (e instanceof ConflictException) ignorados.push(it.diagnostico);
        else throw e;
      }
    }
    return { conjunto: c.nome, criados, ignorados };
  }

  async encerrarDiagnostico(id: string, utilizadorId: string, dto: { estado: 'resolvido' | 'cancelado'; motivo?: string }) {
    const d = await this.prisma.diagnosticoEnfermagem.findUnique({ where: { id }, select: { estado: true } });
    if (!d) throw new NotFoundException('Diagnóstico não encontrado.');
    if (d.estado !== 'ativo') throw new ConflictException('O diagnóstico já não está ativo.');
    if (dto.estado === 'cancelado' && (dto.motivo?.trim().length ?? 0) < 5) {
      throw new BadRequestException('Indique porque se cancela o diagnóstico (mínimo 5 caracteres).');
    }
    const [, r] = await this.prisma.$transaction([
      this.prisma.intervencaoEnfermagem.updateMany({ where: { diagnosticoId: id, estado: 'ativa' }, data: { estado: 'concluida' } }),
      this.prisma.diagnosticoEnfermagem.update({
        where: { id },
        data: { estado: dto.estado, encerradoEm: new Date(), encerradoPorId: utilizadorId, motivoEncerramento: dto.motivo?.trim() || null },
      }),
    ]);
    return r;
  }

  async avaliarDiagnostico(id: string, utilizadorId: string, dto: { evolucao: 'melhorou' | 'igual' | 'piorou' | 'resolvido'; nota?: string }) {
    const d = await this.prisma.diagnosticoEnfermagem.findUnique({ where: { id }, select: { estado: true } });
    if (!d) throw new NotFoundException('Diagnóstico não encontrado.');
    if (d.estado !== 'ativo') throw new ConflictException('O diagnóstico já não está ativo.');
    const a = await this.prisma.avaliacaoDiagnostico.create({ data: { diagnosticoId: id, evolucao: dto.evolucao, nota: dto.nota?.trim() || null, avaliadoPorId: utilizadorId } });
    if (dto.evolucao === 'resolvido') await this.encerrarDiagnostico(id, utilizadorId, { estado: 'resolvido' });
    return a;
  }

  async alterarIntervencao(id: string, dto: { estado?: 'ativa' | 'suspensa' | 'concluida'; frequencia?: string }) {
    const i = await this.prisma.intervencaoEnfermagem.findUnique({ where: { id }, select: { id: true } });
    if (!i) throw new NotFoundException('Intervenção não encontrada.');
    if (dto.frequencia != null && !frequenciaValida(dto.frequencia)) throw new BadRequestException(`Frequência inválida: "${dto.frequencia}".`);
    return this.prisma.intervencaoEnfermagem.update({
      where: { id },
      data: { ...(dto.estado ? { estado: dto.estado } : {}), ...(dto.frequencia ? { frequencia: dto.frequencia.trim() } : {}) },
    });
  }

  /**
   * Registo de uma execução. `executadaEm` é a hora do ato (pode ser anterior ao registo, até
   * 24 h — PROD-16); nunca no futuro. "Não realizada" exige o motivo.
   */
  async registarExecucao(intervencaoId: string, utilizadorId: string, dto: { executadaEm?: string; realizada?: boolean; nota?: string; motivoNaoRealizada?: string }) {
    const i = await this.prisma.intervencaoEnfermagem.findUnique({ where: { id: intervencaoId }, select: { doenteId: true, estado: true } });
    if (!i) throw new NotFoundException('Intervenção não encontrada.');
    if (i.estado !== 'ativa') throw new ConflictException('A intervenção não está ativa.');
    const agora = Date.now();
    const quando = dto.executadaEm ? new Date(dto.executadaEm) : new Date(agora);
    if (Number.isNaN(quando.getTime())) throw new BadRequestException('Hora de execução inválida.');
    if (quando.getTime() > agora + 60_000) throw new BadRequestException('A hora de execução não pode ser no futuro.');
    if (quando.getTime() < agora - 24 * 3_600_000) throw new BadRequestException('Registos com mais de 24 h exigem uma nota de enfermagem tardia.');
    const realizada = dto.realizada !== false;
    if (!realizada && (dto.motivoNaoRealizada?.trim().length ?? 0) < 5) {
      throw new BadRequestException('Indique porque não foi realizada (mínimo 5 caracteres).');
    }
    return this.prisma.execucaoIntervencao.create({
      data: {
        intervencaoId, doenteId: i.doenteId, executadaEm: quando, executadaPorId: utilizadorId, realizada,
        nota: dto.nota?.trim() || null, motivoNaoRealizada: realizada ? null : dto.motivoNaoRealizada!.trim(),
      },
    });
  }
}
