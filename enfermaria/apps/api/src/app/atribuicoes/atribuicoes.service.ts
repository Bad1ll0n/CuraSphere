import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AtribuicoesService {
  constructor(private readonly prisma: PrismaService) {}

  // Retorna o turno ativo agora (ou do dia de hoje pelo tipo)
  async turnoAtivo() {
    const agora = new Date();
    const hora = agora.getHours();

    // manha: 7-15, tarde: 15-23, noite: 23-7
    let tipo: string;
    if (hora >= 7 && hora < 15) tipo = 'manha';
    else if (hora >= 15 && hora < 23) tipo = 'tarde';
    else tipo = 'noite';

    const diaStr = agora.toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');

    const turno = await this.prisma.horarioTurno.findFirst({
      where: { tipo: tipo as any, data: { gte: dataInicio, lte: dataFim } },
      include: {
        profissionais: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } },
          },
        },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
            utilizador: { select: { id: true, nome: true, role: true } },
          },
        },
      },
    });

    return turno;
  }

  // Retorna turno por id com atribuições
  async buscarTurno(turnoId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({
      where: { id: turnoId },
      include: {
        profissionais: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } },
          },
        },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
            utilizador: { select: { id: true, nome: true, role: true } },
          },
        },
      },
    });

    if (!turno) throw new NotFoundException('Turno não encontrado');
    return turno;
  }

  // Chefe do turno = enfermeiro com menor ordemExperiencia no turno
  chefeDeTurno(turno: any): string | null {
    const enfermeiros = turno.profissionais
      .filter((p: any) => p.utilizador.role === 'enfermeiro')
      .sort((a: any, b: any) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999));
    return enfermeiros[0]?.utilizador.id ?? null;
  }

  // Atribuir doente a enfermeiro no turno
  async atribuir(turnoId: string, doenteId: string, utilizadorId: string, atribuidoPorId: string) {
    const turno = await this.buscarTurno(turnoId);

    const chefeId = this.chefeDeTurno(turno);
    if (chefeId !== atribuidoPorId) {
      throw new ForbiddenException('Apenas o chefe de turno pode fazer atribuições');
    }

    const profissionalNoTurno = turno.profissionais.some((p: any) => p.utilizadorId === utilizadorId);
    if (!profissionalNoTurno) {
      throw new ForbiddenException('Utilizador não está neste turno');
    }

    // Só transfere tarefas se o turno atribuído já está ativo (hora atual >= início do turno)
    const min = new Date().getHours() * 60 + new Date().getMinutes();
    const turnoAtivo =
      (turno.tipo === 'manha' && min >= 8 * 60 && min < 16 * 60) ||
      (turno.tipo === 'tarde' && min >= 16 * 60 && min < 23 * 60) ||
      (turno.tipo === 'noite' && (min >= 23 * 60 || min < 8 * 60 + 30));

    if (turnoAtivo) {
      await this.transferirTarefasDoente(doenteId, utilizadorId);
    }

    return this.prisma.atribuicaoHorarioTurno.upsert({
      where: { horarioTurnoId_doenteId_utilizadorId: { horarioTurnoId: turnoId, doenteId, utilizadorId } },
      create: { horarioTurnoId: turnoId, doenteId, utilizadorId, atribuidoPorId },
      update: { atribuidoPorId },
    });
  }

  // Remover atribuição
  async remover(turnoId: string, doenteId: string, utilizadorId: string, atribuidoPorId: string) {
    const turno = await this.buscarTurno(turnoId);
    const chefeId = this.chefeDeTurno(turno);
    if (chefeId !== atribuidoPorId) {
      throw new ForbiddenException('Apenas o chefe de turno pode remover atribuições');
    }

    await this.prisma.atribuicaoHorarioTurno.deleteMany({
      where: { horarioTurnoId: turnoId, doenteId, utilizadorId },
    });

    return { mensagem: 'Atribuição removida' };
  }

  // Transfere tarefas pendentes do doente para o novo utilizador (mesmo grupo de role)
  private async transferirTarefasDoente(doenteId: string, utilizadorId: string): Promise<void> {
    const utilizador = await this.prisma.utilizador.findUnique({
      where: { id: utilizadorId },
      select: { role: true },
    });
    if (!utilizador) return;

    const grupoMedico = ['medico'];
    const grupoEnfermagem = ['enfermeiro', 'chefe_enfermeiros', 'chefe_turno', 'auxiliar'];
    const grupo = grupoMedico.includes(utilizador.role) ? grupoMedico : grupoEnfermagem;

    const tarefas = await this.prisma.tarefa.findMany({
      where: {
        doenteId,
        estado: { in: ['pendente', 'em_progresso'] as any },
        responsavelId: { not: utilizadorId },
        responsavel: { role: { in: grupo as any } },
      },
      select: { id: true },
    });

    if (tarefas.length === 0) return;

    await this.prisma.tarefa.updateMany({
      where: { id: { in: tarefas.map((t) => t.id) } },
      data: { responsavelId: utilizadorId },
    });
  }

  // Lista turnos do dia (para o chefe escolher qual gerir)
  async turnosDoDia(data?: string) {
    const diaStr = data ?? new Date().toISOString().split('T')[0];
    const dataInicio = new Date(diaStr + 'T00:00:00.000Z');
    const dataFim = new Date(diaStr + 'T23:59:59.999Z');

    return this.prisma.horarioTurno.findMany({
      where: { data: { gte: dataInicio, lte: dataFim } },
      include: {
        profissionais: {
          include: {
            utilizador: { select: { id: true, nome: true, role: true, ordemExperiencia: true, equipa: true } },
          },
        },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, numeroProcesso: true, estado: true, diagnosticoPrincipal: true, cama: true } },
            utilizador: { select: { id: true, nome: true, role: true } },
          },
        },
      },
      orderBy: { data: 'asc' },
    });
  }
}
