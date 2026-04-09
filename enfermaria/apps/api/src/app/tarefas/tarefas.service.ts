import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoTarefa, PrioridadeTarefa, EstadoTarefa, Role } from '../common/enums';

@Injectable()
export class TarefasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorResponsavel(responsavelId: string) {
    await this.transferirTarefasPendentes(responsavelId);

    return this.prisma.tarefa.findMany({
      where: {
        responsavelId,
        estado: { in: ['pendente', 'em_progresso'] },
      },
      include: {
        doente: { select: { id: true, nome: true, estado: true, cama: true } },
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: [{ prazo: 'asc' }, { criadaEm: 'desc' }],
    });
  }

  /**
   * Lazy transfer: quando o utilizador busca as suas tarefas no início do turno,
   * verifica se existem tarefas de doentes atribuídos a si neste turno que ainda
   * estão no responsável anterior (mesmo grupo de role). Transfere-as.
   */
  private async transferirTarefasPendentes(responsavelId: string): Promise<void> {
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();

    // Determina o turno atual e se está activo (passada a hora de início)
    let tipoTurno: string;
    let turnoAtivo: boolean;
    if (min >= 8 * 60 && min < 16 * 60 + 30) {
      tipoTurno = 'manha'; turnoAtivo = min >= 8 * 60;
    } else if (min >= 16 * 60 && min < 23 * 60 + 30) {
      tipoTurno = 'tarde'; turnoAtivo = min >= 16 * 60;
    } else {
      tipoTurno = 'noite'; turnoAtivo = min >= 23 * 60 || min < 8 * 60 + 30;
    }

    if (!turnoAtivo) return;

    // Role do utilizador
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: responsavelId },
      select: { role: true },
    });
    if (!utilizador) return;

    const grupoMedico = ['medico'];
    const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
    const grupo = grupoMedico.includes(utilizador.role) ? grupoMedico : grupoEnfermagem;

    // Atribuições do utilizador no turno atual
    const diaStr = agora.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');

    const atribuicoes = await this.prisma.atribuicaoHorarioTurno.findMany({
      where: {
        utilizadorId: responsavelId,
        horarioTurno: { tipo: tipoTurno as any, data: { gte: dataInicio, lte: dataFim } },
      },
      select: { doenteId: true },
    });

    if (atribuicoes.length === 0) return;

    const doenteIds = atribuicoes.map((a) => a.doenteId);

    const tarefas = await this.prisma.tarefa.findMany({
      where: {
        doenteId: { in: doenteIds },
        estado: { in: ['pendente', 'em_progresso'] },
        responsavelId: { not: responsavelId },
        responsavel: { role: { in: grupo as any } },
      },
      select: { id: true },
    });

    if (tarefas.length === 0) return;

    await this.prisma.tarefa.updateMany({
      where: { id: { in: tarefas.map((t) => t.id) } },
      data: { responsavelId },
    });
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.tarefa.findMany({
      where: { doenteId },
      include: {
        responsavel: { select: { id: true, nome: true, role: true } },
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
    responsavelId: string;
    criadoPorId: string;
    turnoId: string;
  }) {
    return this.prisma.tarefa.create({
      data: {
        doenteId: data.doenteId,
        tipo: data.tipo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        prazo: data.prazo ? new Date(data.prazo) : undefined,
        responsavelId: data.responsavelId,
        criadoPorId: data.criadoPorId,
        turnoId: data.turnoId,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
  }

  async atualizarEstado(id: string, estado: EstadoTarefa, utilizadorId: string, role: Role) {
    const tarefa = await this.prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada');

    // Apenas o responsável ou chefe pode alterar o estado
    if (tarefa.responsavelId !== utilizadorId && role !== Role.chefe_turno && role !== Role.chefe_enfermeiros) {
      throw new ForbiddenException('Sem permissão para alterar esta tarefa');
    }

    return this.prisma.tarefa.update({
      where: { id },
      data: {
        estado,
        concluidaEm: estado === 'concluida' ? new Date() : undefined,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
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
