import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventosAdversosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: {
    tipo: string; gravidade: string; descricao: string;
    servicoId?: string; doenteId?: string; acaoCorretiva?: string;
    ocorridoEm?: string;
  }, registadoPorId: string) {
    return this.prisma.eventoAdverso.create({
      data: {
        tipo: dto.tipo,
        gravidade: dto.gravidade,
        descricao: dto.descricao,
        servicoId: dto.servicoId ?? null,
        doenteId: dto.doenteId ?? null,
        acaoCorretiva: dto.acaoCorretiva ?? null,
        ocorridoEm: dto.ocorridoEm ? new Date(dto.ocorridoEm) : new Date(),
        registadoPorId,
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true, role: true } },
      },
    });
  }

  async listar(filtros: { tipo?: string; gravidade?: string; estado?: string; servicoId?: string }) {
    return this.prisma.eventoAdverso.findMany({
      where: {
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.gravidade ? { gravidade: filtros.gravidade } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.servicoId ? { servicoId: filtros.servicoId } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true, role: true } },
      },
      orderBy: { ocorridoEm: 'desc' },
    });
  }

  async atualizar(id: string, dto: { acaoCorretiva?: string; estado?: string }) {
    const ev = await this.prisma.eventoAdverso.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException(`Evento adverso (ID ${id}) não encontrado`);
    return this.prisma.eventoAdverso.update({
      where: { id },
      data: {
        ...(dto.acaoCorretiva !== undefined ? { acaoCorretiva: dto.acaoCorretiva } : {}),
        ...(dto.estado ? { estado: dto.estado } : {}),
      },
      include: {
        doente: { select: { id: true, nome: true } },
        registadoPor: { select: { id: true, nome: true } },
      },
    });
  }

  async indicadores() {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);
    const trintaDias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total30d, porTipo, porGravidade, porEstado, totalMes, totalMesPassado, abertos] = await Promise.all([
      this.prisma.eventoAdverso.count({ where: { ocorridoEm: { gte: trintaDias } } }),
      this.prisma.eventoAdverso.groupBy({
        by: ['tipo'],
        where: { ocorridoEm: { gte: trintaDias } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.eventoAdverso.groupBy({
        by: ['gravidade'],
        where: { ocorridoEm: { gte: trintaDias } },
        _count: { id: true },
      }),
      this.prisma.eventoAdverso.groupBy({
        by: ['estado'],
        _count: { id: true },
      }),
      this.prisma.eventoAdverso.count({ where: { ocorridoEm: { gte: inicioMes } } }),
      this.prisma.eventoAdverso.count({ where: { ocorridoEm: { gte: mesPassado, lte: fimMesPassado } } }),
      this.prisma.eventoAdverso.count({ where: { estado: 'aberto' } }),
    ]);

    return {
      total30d,
      porTipo: porTipo.map(g => ({ tipo: g.tipo, total: g._count.id })),
      porGravidade: porGravidade.map(g => ({ gravidade: g.gravidade, total: g._count.id })),
      porEstado: porEstado.map(g => ({ estado: g.estado, total: g._count.id })),
      totalMes,
      totalMesPassado,
      abertos,
    };
  }
}
