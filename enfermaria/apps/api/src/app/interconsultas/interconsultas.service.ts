import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InterconsultasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(doenteId: string, requisitanteId: string, dto: {
    especialidadeAlvo: string;
    motivo: string;
    urgente?: boolean;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    return this.prisma.interconsulta.create({
      data: {
        doenteId,
        requisitanteId,
        especialidadeAlvo: dto.especialidadeAlvo,
        motivo: dto.motivo,
        urgente: dto.urgente ?? false,
      },
      include: {
        requisitante: { select: { id: true, nome: true, role: true, subRole: true } },
        doente: { select: { id: true, nome: true } },
      },
    });
  }

  async listarPorDoente(doenteId: string) {
    return this.prisma.interconsulta.findMany({
      where: { doenteId },
      include: {
        requisitante: { select: { id: true, nome: true, role: true, subRole: true } },
        medicoResposta: { select: { id: true, nome: true, role: true, subRole: true } },
      },
      orderBy: { criadaEm: 'desc' },
    });
  }

  async listarPendentes(especialidade: string) {
    return this.prisma.interconsulta.findMany({
      where: { especialidadeAlvo: especialidade, estado: 'pendente' },
      include: {
        doente: { select: { id: true, nome: true, cama: { select: { numero: true, quarto: true } } } },
        requisitante: { select: { id: true, nome: true, role: true } },
      },
      orderBy: [{ urgente: 'desc' }, { criadaEm: 'asc' }],
    });
  }

  async listarMinhas(utilizadorId: string) {
    return this.prisma.interconsulta.findMany({
      where: { requisitanteId: utilizadorId },
      include: {
        doente: { select: { id: true, nome: true } },
        medicoResposta: { select: { id: true, nome: true } },
      },
      orderBy: { criadaEm: 'desc' },
    });
  }

  async responder(id: string, medicoRespostaId: string, resposta: string) {
    const interconsulta = await this.prisma.interconsulta.findUnique({ where: { id } });
    if (!interconsulta) throw new NotFoundException('Interconsulta não encontrada');
    if (interconsulta.estado === 'respondida') throw new ForbiddenException('Interconsulta já respondida');

    return this.prisma.interconsulta.update({
      where: { id },
      data: {
        estado: 'respondida',
        medicoRespostaId,
        resposta,
        respondidaEm: new Date(),
      },
      include: {
        medicoResposta: { select: { id: true, nome: true } },
      },
    });
  }

  async aceitar(id: string, medicoRespostaId: string) {
    const interconsulta = await this.prisma.interconsulta.findUnique({ where: { id } });
    if (!interconsulta) throw new NotFoundException('Interconsulta não encontrada');

    return this.prisma.interconsulta.update({
      where: { id },
      data: { estado: 'aceite', medicoRespostaId },
    });
  }

  async cancelar(id: string, utilizadorId: string) {
    const interconsulta = await this.prisma.interconsulta.findUnique({ where: { id } });
    if (!interconsulta) throw new NotFoundException('Interconsulta não encontrada');
    if (interconsulta.requisitanteId !== utilizadorId) throw new ForbiddenException('Sem permissão');

    return this.prisma.interconsulta.update({
      where: { id },
      data: { estado: 'cancelada' },
    });
  }
}
