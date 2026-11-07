import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { AiClinicoService } from '../ai-clinico/ai-clinico.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { episodioAtivo, fecharEpisodio } from '../episodios/episodios.core';
import { temPapel } from '../common/roles.util';
import type { AltaEstruturadaDto, NotaAltaEnfermagemDto } from './dto/alta-estruturada.dto';

export type RequisitoAlta = 'reconciliacao' | 'nota_enfermagem' | 'plano';
const REQUISITOS_VALIDOS: RequisitoAlta[] = ['reconciliacao', 'nota_enfermagem', 'plano'];

/** Requisitos (gates) da alta, por instituição: ALTA_REQUISITOS="reconciliacao,nota_enfermagem,plano". */
export function requisitosConfigurados(): RequisitoAlta[] {
  const bruto = process.env['ALTA_REQUISITOS'] ?? 'reconciliacao,nota_enfermagem';
  return bruto.split(',').map((x) => x.trim()).filter((x): x is RequisitoAlta => (REQUISITOS_VALIDOS as string[]).includes(x));
}

const CRITERIOS_PLANO = [
  'afebrилApenas24h', 'mobilidadeAdequada', 'alimentacaoOral', 'doresControladas',
  'familiaInformada', 'transporteAssegurado', 'medicacaoPreparada', 'consultaSegAlt',
] as const;

const ROLES_ALTA = ['medico', 'chefe_medicos', 'chefe_turno', 'administrativo', 'chefe_enfermeiros'];

/**
 * PROD-12 — a alta é UMA operação, com requisitos verificados (reconciliação terapêutica,
 * nota de alta de enfermagem, plano de alta — configuráveis), que fecha o episódio e encerra
 * o que o internamento deixava pendurado: prescrições, tarefas e atribuições.
 */
@Injectable()
export class AltaService {
  private readonly logger = new Logger(AltaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly aiClinico: AiClinicoService,
    private readonly webhooks: WebhooksService,
  ) {}

  /** Estado dos requisitos — o que a interface mostra antes de pedir a alta. */
  async requisitos(doenteId: string) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, ativo: true } });
    if (!doente) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    const ep = await episodioAtivo(this.prisma as any, doenteId);
    const [prescricoes, nota, plano] = await Promise.all([
      this.prisma.medicacao.findMany({
        where: { doenteId, ativo: true, deletedAt: null },
        select: { id: true, nome: true, dose: true, via: true, frequencia: true },
        orderBy: { nome: 'asc' },
      }),
      ep ? this.prisma.notaAltaEnfermagem.findUnique({ where: { episodioId: ep.id }, select: { id: true, atualizadaEm: true } }) : null,
      ep ? this.prisma.planoAlta.findUnique({ where: { episodioId: ep.id } }) : null,
    ]);
    const planoCumpridos = plano ? CRITERIOS_PLANO.filter((c) => (plano as any)[c] === true).length : 0;
    return {
      ativo: doente.ativo,
      episodioId: ep?.id ?? null,
      exigidos: requisitosConfigurados(),
      prescricoesAtivas: prescricoes,
      notaEnfermagem: nota,
      plano: { cumpridos: planoCumpridos, total: CRITERIOS_PLANO.length },
    };
  }

  /** Requisitos em falta para esta alta (vazio = pode sair). */
  private async emFalta(doenteId: string, episodioId: string | null, dto: AltaEstruturadaDto): Promise<string[]> {
    if (dto.motivoAlta === 'obito') return [];
    const falta: string[] = [];
    for (const r of requisitosConfigurados()) {
      if (r === 'reconciliacao') {
        const ativas = await this.prisma.medicacao.findMany({ where: { doenteId, ativo: true, deletedAt: null }, select: { id: true, nome: true } });
        const decididas = new Set((dto.reconciliacao ?? []).map((l) => l.medicacaoId).filter(Boolean));
        const semDecisao = ativas.filter((m) => !decididas.has(m.id));
        if (semDecisao.length) falta.push(`reconciliação: sem decisão para ${semDecisao.map((m) => m.nome).join(', ')}`);
      }
      if (r === 'nota_enfermagem') {
        const nota = episodioId ? await this.prisma.notaAltaEnfermagem.findUnique({ where: { episodioId }, select: { id: true } }) : null;
        if (!nota) falta.push('nota de alta de enfermagem por registar');
      }
      if (r === 'plano') {
        const plano = episodioId ? await this.prisma.planoAlta.findUnique({ where: { episodioId } }) : null;
        const cumpridos = plano ? CRITERIOS_PLANO.filter((c) => (plano as any)[c] === true).length : 0;
        if (cumpridos < CRITERIOS_PLANO.length) falta.push(`plano de alta: ${cumpridos}/${CRITERIOS_PLANO.length} critérios`);
      }
    }
    return falta;
  }

  async darAlta(doenteId: string, utilizador: { sub: string; role: string; subRole?: string | null }, dto: AltaEstruturadaDto) {
    if (!temPapel(utilizador, ROLES_ALTA)) throw new ForbiddenException('Sem permissão para dar alta');
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId }, select: { id: true, nome: true, ativo: true, camaId: true, deletedAt: true } });
    if (!doente || doente.deletedAt) throw new NotFoundException(`Doente (ID ${doenteId}) não encontrado`);
    if (!doente.ativo) throw new BadRequestException('O doente já teve alta.');

    const ep = await episodioAtivo(this.prisma as any, doenteId);
    const falta = await this.emFalta(doenteId, ep?.id ?? null, dto);
    if (falta.length && !dto.justificacaoRequisitos?.trim()) {
      throw new ConflictException({
        message: `ALTA_INCOMPLETA: ${falta.join('; ')}. Complete-os ou justifique a alta sem eles.`,
        errorCode: 'ALTA_INCOMPLETA',
        contexto: { emFalta: falta },
      });
    }

    // Linhas da reconciliação: completar nome/dose/via/frequência a partir da prescrição.
    const ativas = await this.prisma.medicacao.findMany({
      where: { doenteId, ativo: true, deletedAt: null }, select: { id: true, nome: true, dose: true, via: true, frequencia: true },
    });
    const linhas = (dto.reconciliacao ?? []).map((l) => {
      const m = l.medicacaoId ? ativas.find((a) => a.id === l.medicacaoId) : undefined;
      if (l.medicacaoId && !m) throw new BadRequestException(`A prescrição ${l.medicacaoId} não é uma prescrição activa deste doente.`);
      if (!m && l.decisao !== 'nova') throw new BadRequestException('Só um medicamento novo pode vir sem prescrição de origem.');
      if (m && l.decisao === 'nova') throw new BadRequestException(`"${m.nome}" já está prescrito: decida manter, alterar ou suspender.`);
      const nome = l.nome?.trim() || m?.nome;
      if (!nome) throw new BadRequestException('Indique o nome do medicamento novo.');
      return {
        medicacaoId: m?.id ?? null, decisao: l.decisao, nome,
        dose: l.dose ?? m?.dose ?? null, via: l.via ?? m?.via ?? null, frequencia: l.frequencia ?? m?.frequencia ?? null,
        notas: l.notas ?? null,
      };
    });
    const saida = linhas.filter((l) => l.decisao !== 'suspender');
    const prescricaoSaida = [
      ...saida.map((l) => `${l.decisao === 'nova' ? '[NOVO] ' : l.decisao === 'alterar' ? '[ALTERADO] ' : ''}${l.nome}`
        + `${l.dose ? ` ${l.dose}` : ''}${l.via ? ` ${l.via}` : ''}${l.frequencia ? ` ${l.frequencia}` : ''}${l.notas ? ` — ${l.notas}` : ''}`),
      ...linhas.filter((l) => l.decisao === 'suspender').map((l) => `[SUSPENSO] ${l.nome}${l.notas ? ` — ${l.notas}` : ''}`),
      ...(dto.prescricaoSaida?.trim() ? [dto.prescricaoSaida.trim()] : []),
    ].join('\n') || null;

    const agora = new Date();
    const sumario = await this.prisma.$transaction(async (tx) => {
      const episodio = await fecharEpisodio(tx, doenteId, { motivoAlta: dto.motivoAlta, destinoAlta: dto.destino, criadoPorId: utilizador.sub });
      if (linhas.length) {
        await tx.reconciliacaoAltaLinha.createMany({
          data: linhas.map((l) => ({ ...l, episodioId: episodio.id, doenteId, criadoPorId: utilizador.sub })),
        });
      }
      const s = await tx.sumarioAlta.create({
        data: {
          doenteId, episodioId: episodio.id, criadoPorId: utilizador.sub,
          motivoAlta: dto.motivoAlta, destino: dto.destino, resumoClinical: dto.resumoClinical,
          prescricaoSaida, medicoFamilia: dto.medicoFamilia,
          requisitosEmFalta: falta, justificacaoRequisitos: falta.length ? dto.justificacaoRequisitos!.trim() : null,
        },
      });
      // O internamento acabou: nada continua "activo" por esquecimento.
      await tx.medicacao.updateMany({ where: { doenteId, ativo: true, deletedAt: null }, data: { ativo: false, terminadoEm: agora } });
      await tx.tarefa.updateMany({ where: { doenteId, estado: { in: ['pendente', 'em_progresso'] } }, data: { estado: 'cancelada' } });
      await tx.atribuicaoDoente.deleteMany({ where: { doenteId, turno: { dataFim: { gte: agora } } } });
      await tx.atribuicaoHorarioTurno.deleteMany({ where: { doenteId, horarioTurno: { data: { gte: new Date(agora.toDateString()) } } } });
      // `Doente.camaId` é @unique: libertá-lo faz parte da alta (a cama vai para limpeza).
      await tx.doente.update({ where: { id: doenteId }, data: { ativo: false, dataAlta: agora, camaId: null, estado: 'alta_prevista' } });
      if (doente.camaId) await tx.cama.update({ where: { id: doente.camaId }, data: { estado: 'em_limpeza' } });
      return s;
    }, { isolationLevel: 'Serializable' });

    if (doente.camaId) {
      this.notificacoes.enviarParaRole('auxiliar', '🧹 Cama disponível para limpeza', `Doente teve alta. Por favor efectue a limpeza.`, { camaId: doente.camaId })
        .catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }
    if (dto.motivoAlta !== 'obito') {
      this.agendarFollowUps(doenteId, doente.nome, utilizador, ep?.dataAdmissao ?? null)
        .catch((err) => this.logger.warn(`Follow-ups falharam: ${err?.message}`));
      this.aiClinico.gerarCartaAlta(doenteId).catch((err) => this.logger.warn('gerarCartaAlta falhou', err?.message));
      this.aiClinico.calcularRiscoReadmissao(doenteId).catch((err) => this.logger.warn('calcularRiscoReadmissao falhou', err?.message));
    }
    this.webhooks.dispatcharEvento('doente.alta', { doenteId, nome: doente.nome }).catch(() => null);
    return sumario;
  }

  /**
   * Follow-ups de 7 e 30 dias para o médico responsável: quem deu a alta (se for médico) ou,
   * senão, quem prescreveu por último neste internamento. Antes iam para o primeiro médico
   * criado no hospital, que não conhecia o doente.
   */
  async medicoResponsavel(doenteId: string, utilizador: { sub: string; role: string }, desde: Date | null) {
    if (utilizador.role === 'medico') return utilizador.sub;
    const ultima = await this.prisma.medicacao.findFirst({
      where: { doenteId, ...(desde && { iniciadoEm: { gte: desde } }) },
      orderBy: { iniciadoEm: 'desc' },
      select: { prescritoPorId: true },
    });
    return ultima?.prescritoPorId ?? null;
  }

  private async agendarFollowUps(doenteId: string, nome: string, utilizador: { sub: string; role: string }, desde: Date | null) {
    const medicoId = await this.medicoResponsavel(doenteId, utilizador, desde);
    if (!medicoId) {
      this.logger.warn(`Alta de ${doenteId} sem médico responsável identificável — follow-ups não agendados.`);
      return;
    }
    const agora = Date.now();
    await this.prisma.followUpAgendado.createMany({
      data: [
        { doenteId, tipo: '7_dias', dataAgendada: new Date(agora + 7 * 86_400_000), responsavelId: medicoId },
        { doenteId, tipo: '30_dias', dataAgendada: new Date(agora + 30 * 86_400_000), responsavelId: medicoId },
      ],
    });
    await this.notificacoes.enviarParaUtilizador(medicoId, `Follow-up agendado: ${nome}`, 'Doente teve alta. Follow-ups agendados para 7 e 30 dias.');
  }

  // ── Nota de alta de enfermagem ───────────────────────────────────────────────

  async notaEnfermagem(doenteId: string) {
    const ep = await episodioAtivo(this.prisma as any, doenteId)
      ?? await this.prisma.episodioInternamento.findFirst({ where: { doenteId }, orderBy: { numero: 'desc' } });
    if (!ep) return { nota: null, sugestao: null, episodioId: null };
    const nota = await this.prisma.notaAltaEnfermagem.findUnique({ where: { episodioId: ep.id } });
    return { nota, sugestao: nota ? null : await this.sugestaoNota(doenteId), episodioId: ep.id };
  }

  /** Pré-preenchimento a partir do registo: dispositivos activos, feridas, Barthel, alergias. */
  async sugestaoNota(doenteId: string) {
    const [dispositivos, feridas, barthel, alergias] = await Promise.all([
      this.prisma.dispositivoInvasivo.findMany({ where: { doenteId, ativo: true }, select: { tipo: true, localizacao: true, dataInsercao: true } }),
      this.prisma.avaliacaoFerida.findMany({
        where: { doenteId, deletedAt: null }, orderBy: { criadaEm: 'desc' }, take: 5,
        select: { tipo: true, localizacao: true, estadoCicatrizacao: true, criadaEm: true },
      }),
      this.prisma.escalaClinica.findFirst({ where: { doenteId, tipo: 'Barthel' as any }, orderBy: { registadaEm: 'desc' }, select: { pontuacao: true, classificacao: true, registadaEm: true } }),
      this.prisma.alergia.findMany({ where: { doenteId, deletedAt: null }, select: { alergenio: true, severidade: true } }),
    ]);
    const d = (x: Date) => x.toLocaleDateString('pt-PT');
    return {
      autonomia: barthel ? `Barthel ${barthel.pontuacao} (${barthel.classificacao}) em ${d(barthel.registadaEm)}.` : '',
      dispositivos: dispositivos.map((x) => `${x.tipo}${x.localizacao ? ` (${x.localizacao})` : ''}, inserido em ${d(x.dataInsercao)}`).join('\n'),
      feridas: feridas.map((f) => `${f.tipo} — ${f.localizacao}, ${f.estadoCicatrizacao} (avaliada em ${d(f.criadaEm)})`).join('\n'),
      observacoes: alergias.length ? `Alergias: ${alergias.map((a) => `${a.alergenio} (${a.severidade})`).join(', ')}.` : 'Sem alergias registadas.',
    };
  }

  async guardarNotaEnfermagem(doenteId: string, autorId: string, dto: NotaAltaEnfermagemDto) {
    const ep = await episodioAtivo(this.prisma as any, doenteId);
    if (!ep) throw new BadRequestException('O doente não tem um internamento em curso.');
    return this.prisma.notaAltaEnfermagem.upsert({
      where: { episodioId: ep.id },
      create: { ...dto, episodioId: ep.id, doenteId, autorId },
      update: { ...dto, autorId },
    });
  }
}
