import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoTarefa, PrioridadeTarefa, EstadoTarefa, Role } from '../common/enums';

@Injectable()
export class TarefasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorResponsavel(responsavelId: string) {
    return this.prisma.tarefa.findMany({
      where: {
        responsavelId,
        estado: { in: ['pendente', 'em_progresso'] },
      },
      include: {
        doente: { select: { id: true, nome: true, estado: true, cama: true } },
        criadoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: [{ prioridade: 'asc' }, { prazo: 'asc' }],
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
