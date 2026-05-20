import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TarefasService } from '../tarefas/tarefas.service';
import { TipoTurno } from '../common/enums';

@Injectable()
export class TurnosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tarefasService: TarefasService,
  ) {}

  async turnoAtivo() {
    const agora = new Date();
    return this.prisma.turno.findFirst({
      where: { dataInicio: { lte: agora }, dataFim: { gte: agora } },
      include: {
        chefeTurno: { select: { id: true, nome: true } },
        atribuicoes: {
          include: {
            doente: { select: { id: true, nome: true, estado: true, cama: true } },
            enfermeiro: { select: { id: true, nome: true } },
          },
        },
        horariosEntrada: {
          include: { utilizador: { select: { id: true, nome: true, role: true } } },
        },
      },
    });
  }

  async checkIn(utilizadorId: string) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo neste momento');

    const jaFezCheckIn = await this.prisma.horarioEntrada.findUnique({
      where: { turnoId_utilizadorId: { turnoId: turno.id, utilizadorId } },
    });
    if (jaFezCheckIn) throw new BadRequestException('Check-in já realizado para este turno');

    // Verificar se o profissional está no horário deste turno
    const noHorario = await this.prisma.horarioTurnoProfissional.findFirst({
      where: {
        utilizadorId,
        horarioTurno: { data: { gte: turno.dataInicio, lte: turno.dataFim } },
      },
    });
    if (!noHorario) throw new ForbiddenException('Não está escalado para este turno');

    const entrada = await this.prisma.horarioEntrada.create({
      data: { turnoId: turno.id, utilizadorId },
    });

    // Gerar passagem de turno automática
    const passagem = await this.gerarPassagemTurno(utilizadorId, turno.id);

    return { entrada, passagem };
  }

  async confirmarPassagemTurno(utilizadorId: string) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo');

    await this.prisma.horarioEntrada.update({
      where: { turnoId_utilizadorId: { turnoId: turno.id, utilizadorId } },
      data: { passagemTurnoVista: true },
    });

    return { mensagem: 'Passagem de turno confirmada' };
  }

  private async gerarPassagemTurno(utilizadorId: string, turnoAtualId: string) {
    // Encontrar turno anterior
    const turnoAtual = await this.prisma.turno.findUnique({ where: { id: turnoAtualId } });
    if (!turnoAtual) return null;

    const turnoAnterior = await this.prisma.turno.findFirst({
      where: { dataFim: { lte: turnoAtual.dataInicio } },
      orderBy: { dataFim: 'desc' },
    });

    if (!turnoAnterior) return null;

    // Doentes atribuídos ao utilizador no turno atual
    const atribuicoes = await this.prisma.atribuicaoDoente.findMany({
      where: { turnoId: turnoAtualId, enfermeiroId: utilizadorId },
      include: { doente: true },
    });

    const passagens = [];
    for (const atribuicao of atribuicoes) {
      // Verificar se já existe passagem de turno para este doente
      const existente = await this.prisma.passagemTurno.findFirst({
        where: { doenteId: atribuicao.doenteId, turnoAtualId },
      });

      if (!existente) {
        const passagem = await this.prisma.passagemTurno.create({
          data: {
            turnoAnteriorId: turnoAnterior.id,
            turnoAtualId,
            doenteId: atribuicao.doenteId,
          },
        });
        passagens.push(passagem);
      }
    }

    // Transitar tarefas pendentes do turno anterior
    await this.tarefasService.transitarParaTurno(turnoAnterior.id, turnoAtualId);

    return passagens;
  }

  async passagemTurno(utilizadorId: string) {
    const turno = await this.turnoAtivo();
    if (!turno) throw new BadRequestException('Não existe turno ativo');

    const turnoAnterior = await this.prisma.turno.findFirst({
      where: { dataFim: { lte: turno.dataInicio } },
      orderBy: { dataFim: 'desc' },
    });

    // Doentes atribuídos no turno atual
    const atribuicoes = await this.prisma.atribuicaoDoente.findMany({
      where: { turnoId: turno.id, enfermeiroId: utilizadorId },
      include: {
        doente: {
          include: {
            cama: true,
            tarefas: { where: { estado: { in: ['pendente', 'em_progresso'] } } },
            notasTurno: {
              where: turnoAnterior ? { turnoId: turnoAnterior.id } : {},
              include: { autor: { select: { nome: true, role: true } } },
              orderBy: { criadaEm: 'desc' },
            },
            medicacoes: { where: { ativo: true } },
          },
        },
      },
    });

    return atribuicoes.map((a) => ({
      doente: a.doente,
      tarefasPendentes: a.doente.tarefas,
      notasAnteriores: a.doente.notasTurno,
      medicacoesAtivas: a.doente.medicacoes,
    }));
  }

  async atribuirDoentes(turnoId: string, atribuicoes: { doenteId: string; enfermeiroId: string }[]) {
    return this.prisma.$transaction([
      this.prisma.atribuicaoDoente.deleteMany({ where: { turnoId } }),
      this.prisma.atribuicaoDoente.createMany({
        data: atribuicoes.map((a) => ({ ...a, turnoId })),
      }),
    ]);
  }

  async adicionarNota(data: { turnoId: string; doenteId: string; autorId: string; texto: string }) {
    return this.prisma.notaTurno.create({
      data,
      include: { autor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async criar(data: { tipo: TipoTurno; dataInicio: Date; dataFim: Date; chefeTurnoId: string }) {
    return this.prisma.turno.create({
      data: {
        tipo: data.tipo,
        dataInicio: new Date(data.dataInicio),
        dataFim: new Date(data.dataFim),
        chefeTurnoId: data.chefeTurnoId,
      },
      include: { chefeTurno: { select: { id: true, nome: true } } },
    });
  }
}
