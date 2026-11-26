import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { BarramentoService } from '../redis/barramento.service';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { TipoTarefa, PrioridadeTarefa, EstadoTarefa } from '../common/infra/enums';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

import { chaveDiaClinico } from '../common/clinico/dia-clinico.helper';
@Injectable()
export class TarefasService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TarefasService.name);
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private readonly eventos$ = new Subject<{ data: string; type: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    @Optional() private readonly barramento?: BarramentoService,
  ) {
    this.barramento?.subscrever<{ data: string; type: string }>('sse:tarefas', (e) => this.eventos$.next(e));
  }

  eventStream() {
    return this.eventos$.asObservable();
  }

  // ARQ-17/OPS-09: o evento SSE vai pelo barramento (Redis) para chegar aos browsers ligados a
  // QUALQUER réplica; sem barramento (testes), fica local como antes.
  private emit(type: string, payload: unknown) {
    const e = { type, data: JSON.stringify(payload) };
    if (this.barramento) this.barramento.publicar('sse:tarefas', e);
    else this.eventos$.next(e);
  }

  onApplicationBootstrap() {
    // Verificar tarefas urgentes não iniciadas a cada 10 minutos
    this.intervalo = setInterval(() => this.alertarTarefasUrgentesPendentes(), 10 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async alertarTarefasUrgentesPendentes() {
    // ARQ-17: com várias réplicas, só uma avisa (8 min < intervalo de 10 min).
    if (typeof this.prisma.tryBecomeLeader === 'function' && !(await this.prisma.tryBecomeLeader('tarefas-urgentes-pendentes', 480_000))) return;
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
          this.notificacoes.enviarParaUtilizador(id, titulo, corpo, { tarefaId: t.id, doenteId: t.doenteId }).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
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

    const diaStr = chaveDiaClinico(dataRef);
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
      operacional: 'operacional',
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
      ).catch((err) => this.logger.warn('Notificação falhou', err?.message ?? String(err)));
    }

    this.emit('tarefa_criada', { id: tarefa.id, prioridade: tarefa.prioridade, grupoResponsavel: (tarefa as any).grupoResponsavel });
    return tarefa;
  }

  async atualizarEstado(id: string, estado: EstadoTarefa) {
    const tarefa = await this.prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) throw new NotFoundException(`Tarefa (ID ${id}) não encontrada`);

    const result = await this.prisma.tarefa.update({
      where: { id },
      data: {
        estado,
        concluidaEm: estado === 'concluida' ? new Date() : undefined,
      },
      include: {
        doente: { select: { id: true, nome: true } },
      },
    });

    this.emit('tarefa_atualizada', { id: result.id, estado: result.estado, doenteId: result.doenteId });
    return result;
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
