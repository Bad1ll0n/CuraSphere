import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoTarefa, PrioridadeTarefa, EstadoTarefa } from '../common/enums';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class TarefasService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TarefasService.name);
  private intervalo: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  onApplicationBootstrap() {
    // Verificar tarefas urgentes não iniciadas a cada 10 minutos
    this.intervalo = setInterval(() => this.alertarTarefasUrgentesPendentes(), 10 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async alertarTarefasUrgentesPendentes() {
    try {
      const limiar = new Date(Date.now() - 30 * 60 * 1000); // 30 minutos atrás
      const tarefas = await this.prisma.tarefa.findMany({
        where: {
          prioridade: 'urgente',
          estado: 'pendente',
          criadaEm: { lt: limiar },
        },
        include: {
          doente: { select: { nome: true } },
          responsavel: { select: { id: true } },
          criadoPor: { select: { id: true } },
        },
        take: 20,
      });

      for (const t of tarefas) {
        const titulo = `⚠ Tarefa urgente pendente — ${t.doente.nome}`;
        const corpo = `"${t.descricao}" está pendente há mais de 30 minutos. Acção imediata necessária.`;
        const ids = new Set<string>();
        if (t.responsavel?.id) ids.add(t.responsavel.id);
        if (t.criadoPor?.id) ids.add(t.criadoPor.id);
        for (const id of ids) {
          this.notificacoes.enviarParaUtilizador(id, titulo, corpo, { tarefaId: t.id, doenteId: t.doenteId }).catch(() => {});
        }
      }

      if (tarefas.length > 0) {
        this.logger.warn(`${tarefas.length} tarefa(s) urgente(s) pendente(s) há >30min — notificações enviadas`);
      }
    } catch (e) {
      this.logger.error('Erro ao verificar tarefas urgentes', e);
    }
  }

  /**
   * Lista tarefas pendentes/em_progresso:
   * - Tarefas diretamente atribuídas a este utilizador (responsavelId)
   * - Tarefas sem responsável dos doentes atribuídos no turno atual
   */
  async listarPorResponsavel(utilizadorId: string) {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();

    let tipo: string;
    const dataRef = new Date(agora);
    if (min >= 8 * 60 && min < 16 * 60 + 30)      { tipo = 'manha'; }
    else if (min >= 16 * 60 && min < 23 * 60 + 30) { tipo = 'tarde'; }
    else {
      tipo = 'noite';
      if (min < 8 * 60 + 30) dataRef.setDate(dataRef.getDate() - 1);
    }

    const diaStr = dataRef.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim    = new Date(diaStr + 'T23:59:59.999Z');

    // Doentes atribuídos no turno atual
    const atribuicoes = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        utilizadorId,
        horarioTurno: { tipo: tipo as any, data: { gte: dataInicio, lte: dataFim } },
      },
      select: { doenteId: true },
    });

    const doenteIds = atribuicoes.map((a) => a.doenteId);

    // Determinar o grupo do utilizador para tarefas sem responsável concreto
    const roleGrupoMap: Record<string, string> = {
      medico: 'medico', chefe_medicos: 'medico',
      enfermeiro: 'enfermeiro', chefe_enfermeiros: 'enfermeiro', chefe_turno: 'enfermeiro',
      auxiliar: 'auxiliar',
    };
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { role: true },
    });
    const meuGrupo = roleGrupoMap[utilizador?.role ?? ''] ?? null;

    return this.prisma.tarefa.findMany({
      where: {
        estado: { in: ['pendente', 'em_progresso'] },
        OR: [
          { responsavelId: utilizadorId },
          ...(doenteIds.length > 0 && meuGrupo ? [{
            doenteId: { in: doenteIds },
            responsavelId: null,
            grupoResponsavel: meuGrupo,
          }] : []),
        ],
      },
      include: {
        doente: { select: { id: true, nome: true, estado: true, cama: true } },
        criadoPor: { select: { id: true, nome: true, role: true } },
        responsavel: { select: { id: true, nome: true, role: true } },
      },
      orderBy: [{ prazo: 'asc' }, { criadaEm: 'desc' }],
    });
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.tarefa.findMany({
      where: { doenteId },
      include: {
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: [{ estado: 'asc' }, { prioridade: 'asc' }, { criadaEm: 'desc' }],
    });
  }

  async criar(data: {
    doenteId: string;
    tipo: TipoTarefa;
    descricao: string;
    prioridade: PrioridadeTarefa;
    prazo?: Date;
    criadoPorId: string;
  }) {
    const tarefa = await this.prisma.tarefa.create({
      data: {
        doenteId: data.doenteId,
        tipo: data.tipo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        prazo: data.prazo ? new Date(data.prazo) : undefined,
        criadoPorId: data.criadoPorId,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });

    // Notificar responsável se atribuído diretamente
    if ((data as any).responsavelId && (data as any).responsavelId !== data.criadoPorId) {
      const prioLabel: Record<string, string> = { urgente: '🚨 Urgente', alta: '⚠️ Alta', media: 'Média', baixa: 'Baixa' };
      this.notificacoes.enviarParaUtilizador(
        (data as any).responsavelId,
        `Nova Tarefa — ${prioLabel[data.prioridade] ?? data.prioridade}`,
        `${tarefa.doente.nome}: ${data.descricao}`,
        { tipo: 'tarefa', tarefaId: tarefa.id },
      ).catch(() => {});
    }

    return tarefa;
  }

  async atualizarEstado(id: string, estado: EstadoTarefa) {
    const tarefa = await this.prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) throw new NotFoundException(`Tarefa (ID ${id}) não encontrada`);

    return this.prisma.tarefa.update({
      where: { id },
      data: {
        estado,
        concluidaEm: estado === 'concluida' ? new Date() : undefined,
      },
      include: {
        doente: { select: { id: true, nome: true } },
      },
    });
  }

  async editar(id: string, dto: { descricao?: string; prioridade?: PrioridadeTarefa; prazo?: string | null; grupoResponsavel?: string }) {
    const tarefa = await this.prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) throw new NotFoundException(`Tarefa (ID ${id}) não encontrada`);
    return this.prisma.tarefa.update({
      where: { id },
      data: {
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.prioridade !== undefined && { prioridade: dto.prioridade }),
        ...(dto.grupoResponsavel !== undefined && { grupoResponsavel: dto.grupoResponsavel }),
        ...(dto.prazo !== undefined && { prazo: dto.prazo ? new Date(dto.prazo) : null }),
      },
      include: { doente: { select: { id: true, nome: true } } },
    });
  }

  async transitarParaTurno(turnoAnteriorId: string, turnoAtualId: string) {
    const tarefasPendentes = await this.prisma.tarefa.findMany({
      where: {
        turnoId: turnoAnteriorId,
        estado: { in: ['pendente', 'em_progresso'] },
      },
    });

    if (tarefasPendentes.length === 0) return [];

    await this.prisma.tarefa.updateMany({
      where: { id: { in: tarefasPendentes.map((t) => t.id) } },
      data: { turnoId: turnoAtualId, transitouDeTurno: true },
    });

    return tarefasPendentes;
  }
}
