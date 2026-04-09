import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const include = {
  solicitante: { select: { id: true, nome: true, role: true, equipa: true } },
  destinatario: { select: { id: true, nome: true, role: true, equipa: true } },
  turno: { select: { id: true, tipo: true, data: true } },
  aprovadoPor: { select: { id: true, nome: true } },
};

@Injectable()
export class TrocasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(utilizadorId: string, role: string) {
    if (role === 'chefe_enfermeiros') {
      return this.prisma.pedidoTrocaTurno.findMany({
        where: { estado: 'pendente_chefe' },
        include,
        orderBy: { criadoEm: 'desc' },
      });
    }
    return this.prisma.pedidoTrocaTurno.findMany({
      where: { OR: [{ solicitanteId: utilizadorId }, { destinatarioId: utilizadorId }] },
      include,
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Colegas do mesmo role no mesmo turno ou na mesma escala
  async colegasDisponiveis(solicitanteId: string, turnoId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({
      where: { id: turnoId },
      include: {
        profissionais: { include: { utilizador: { select: { id: true, nome: true, role: true, equipa: true } } } },
        escala: true,
      },
    });
    if (!turno) throw new NotFoundException('Turno não encontrado');

    const solicitante = turno.profissionais.find((p) => p.utilizadorId === solicitanteId);
    if (!solicitante) throw new BadRequestException('Não pertences a este turno');

    const role = solicitante.utilizador.role;

    // Buscar todos os utilizadores do mesmo role ativos (excluindo o próprio)
    return this.prisma.utilizador.findMany({
      where: { role: role as any, ativo: true, id: { not: solicitanteId } },
      select: { id: true, nome: true, role: true, equipa: true, ordemExperiencia: true },
      orderBy: [{ equipa: 'asc' }, { ordemExperiencia: 'asc' }],
    });
  }

  async criar(solicitanteId: string, turnoId: string, destinatarioId: string) {
    const turno = await this.prisma.horarioTurno.findUnique({
      where: { id: turnoId },
      include: { profissionais: true },
    });
    if (!turno) throw new NotFoundException('Turno não encontrado');
    if (!turno.profissionais.some((p) => p.utilizadorId === solicitanteId)) {
      throw new BadRequestException('Não pertences a este turno');
    }

    const existente = await this.prisma.pedidoTrocaTurno.findFirst({
      where: { solicitanteId, turnoId, destinatarioId, estado: { in: ['pendente_destinatario', 'pendente_chefe'] } },
    });
    if (existente) throw new BadRequestException('Já existe um pedido pendente para este turno e colega');

    return this.prisma.pedidoTrocaTurno.create({
      data: { solicitanteId, turnoId, destinatarioId },
      include,
    });
  }

  async responderDestinatario(pedidoId: string, utilizadorId: string, aceitar: boolean) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.destinatarioId !== utilizadorId) throw new ForbiddenException('Não és o destinatário');
    if (pedido.estado !== 'pendente_destinatario') throw new BadRequestException('Pedido já respondido');

    return this.prisma.pedidoTrocaTurno.update({
      where: { id: pedidoId },
      data: { estado: aceitar ? 'pendente_chefe' : 'rejeitado', respondidoEm: new Date() },
      include,
    });
  }

  async aprovarChefe(pedidoId: string, chefeId: string, aprovar: boolean) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.estado !== 'pendente_chefe') throw new BadRequestException('Pedido não está pendente de aprovação');

    if (!aprovar) {
      return this.prisma.pedidoTrocaTurno.update({
        where: { id: pedidoId },
        data: { estado: 'rejeitado', aprovadoPorId: chefeId, respondidoEm: new Date() },
        include,
      });
    }

    // Aprovar: remover solicitante do turno e adicionar destinatário
    return this.prisma.$transaction(async (tx) => {
      await tx.horarioTurnoProfissional.delete({
        where: { horarioTurnoId_utilizadorId: { horarioTurnoId: pedido.turnoId, utilizadorId: pedido.solicitanteId } },
      });
      await tx.horarioTurnoProfissional.upsert({
        where: { horarioTurnoId_utilizadorId: { horarioTurnoId: pedido.turnoId, utilizadorId: pedido.destinatarioId } },
        create: { horarioTurnoId: pedido.turnoId, utilizadorId: pedido.destinatarioId },
        update: {},
      });
      return tx.pedidoTrocaTurno.update({
        where: { id: pedidoId },
        data: { estado: 'aprovado', aprovadoPorId: chefeId, respondidoEm: new Date() },
        include,
      });
    });
  }

  async cancelar(pedidoId: string, utilizadorId: string) {
    const pedido = await this.prisma.pedidoTrocaTurno.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.solicitanteId !== utilizadorId) throw new ForbiddenException('Apenas o solicitante pode cancelar');
    if (pedido.estado !== 'pendente_destinatario') throw new BadRequestException('Não é possível cancelar este pedido');
    return this.prisma.pedidoTrocaTurno.delete({ where: { id: pedidoId } });
  }
}
