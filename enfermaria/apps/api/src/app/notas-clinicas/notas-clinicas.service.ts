import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotasClinicasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(doenteId: string, dto: {
    subjetivo: string; objetivo: string; avaliacao: string; plano: string;
  }, autorId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.notaClinica.create({
      data: { doenteId, autorId, ...dto },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async listar(doenteId: string) {
    await this.buscarDoente(doenteId);
    return this.prisma.notaClinica.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async atualizar(id: string, dto: {
    subjetivo?: string; objetivo?: string; avaliacao?: string; plano?: string;
  }) {
    await this.buscarNota(id);
    return this.prisma.notaClinica.update({
      where: { id },
      data: { ...dto, editadaEm: new Date() },
      include: { autor: { select: { id: true, nome: true, role: true, subRole: true } } },
    });
  }

  async apagar(id: string) {
    await this.buscarNota(id);
    return this.prisma.notaClinica.delete({ where: { id } });
  }

  private async buscarDoente(id: string) {
    const d = await this.prisma.doente.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Doente não encontrado');
    return d;
  }

  private async buscarNota(id: string) {
    const n = await this.prisma.notaClinica.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Nota clínica não encontrada');
    return n;
  }
}
