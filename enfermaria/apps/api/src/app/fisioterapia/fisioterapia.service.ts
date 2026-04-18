import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FisioterapiaService {
  constructor(private readonly prisma: PrismaService) {}

  async criarPlano(doenteId: string, dto: { objetivos: string; dataInicio: string; dataFimPrevista?: string }, fisioterapeutaId: string) {
    return this.prisma.planoReabilitacao.create({
      data: { doenteId, fisioterapeutaId, objetivos: dto.objetivos, dataInicio: new Date(dto.dataInicio), dataFimPrevista: dto.dataFimPrevista ? new Date(dto.dataFimPrevista) : null },
      include: { fisioterapeuta: { select: { id: true, nome: true } }, sessoes: true },
    });
  }

  async planoPorDoente(doenteId: string) {
    return this.prisma.planoReabilitacao.findMany({
      where: { doenteId },
      orderBy: { criadoEm: 'desc' },
      include: { fisioterapeuta: { select: { id: true, nome: true } }, sessoes: { orderBy: { data: 'asc' } } },
    });
  }

  async agendarSessao(dto: { planoId: string; doenteId: string; data: string; duracao: number; descricao: string }, fisioterapeutaId: string) {
    return this.prisma.sessaoFisioterapia.create({
      data: { planoId: dto.planoId, doenteId: dto.doenteId, fisioterapeutaId, data: new Date(dto.data), duracao: dto.duracao, descricao: dto.descricao },
      include: { doente: { select: { id: true, nome: true } }, fisioterapeuta: { select: { id: true, nome: true } } },
    });
  }

  async realizarSessao(id: string, dto: { evolucao: string }) {
    const sessao = await this.prisma.sessaoFisioterapia.findUnique({ where: { id } });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    return this.prisma.sessaoFisioterapia.update({ where: { id }, data: { estado: 'realizada', evolucao: dto.evolucao } });
  }

  async agendaFisioterapeuta(fisioterapeutaId: string) {
    return this.prisma.sessaoFisioterapia.findMany({
      where: { fisioterapeutaId, estado: { in: ['agendada'] }, data: { gte: new Date() } },
      orderBy: { data: 'asc' },
      include: { doente: { select: { id: true, nome: true } } },
    });
  }
}
