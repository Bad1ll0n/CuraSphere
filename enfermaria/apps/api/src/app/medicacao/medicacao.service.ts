import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MedicacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorDoente(doenteId: string) {
    return this.prisma.medicacao.findMany({
      where: { doenteId },
      include: {
        prescritoPor: { select: { id: true, nome: true } },
        registos: {
          include: { administradoPor: { select: { id: true, nome: true } } },
          orderBy: { administradoEm: 'desc' },
          take: 10,
        },
      },
      orderBy: { iniciadoEm: 'desc' },
    });
  }

  async prescrever(data: {
    doenteId: string;
    nome: string;
    dose: string;
    via: string;
    frequencia: string;
    prescritoPorId: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: data.doenteId } });
    if (!doente) throw new NotFoundException('Doente não encontrado');

    return this.prisma.medicacao.create({
      data,
      include: { prescritoPor: { select: { id: true, nome: true } } },
    });
  }

  async registarAdministracao(data: {
    medicacaoId: string;
    administradoPorId: string;
    observacoes?: string;
  }) {
    const medicacao = await this.prisma.medicacao.findUnique({ where: { id: data.medicacaoId } });
    if (!medicacao) throw new NotFoundException('Medicação não encontrada');
    if (!medicacao.ativo) throw new NotFoundException('Medicação já foi descontinuada');

    return this.prisma.registoMedicacao.create({
      data: {
        medicacaoId: data.medicacaoId,
        doenteId: medicacao.doenteId,
        administradoPorId: data.administradoPorId,
        observacoes: data.observacoes,
      },
      include: {
        administradoPor: { select: { id: true, nome: true } },
        medicacao: { select: { nome: true, dose: true, via: true } },
      },
    });
  }

  async descontinuar(id: string) {
    const medicacao = await this.prisma.medicacao.findUnique({ where: { id } });
    if (!medicacao) throw new NotFoundException('Medicação não encontrada');

    return this.prisma.medicacao.update({
      where: { id },
      data: { ativo: false, terminadoEm: new Date() },
      select: { id: true, nome: true, ativo: true, terminadoEm: true },
    });
  }

  async historicoAdministracao(doenteId: string) {
    return this.prisma.registoMedicacao.findMany({
      where: { doenteId },
      include: {
        medicacao: { select: { nome: true, dose: true, via: true } },
        administradoPor: { select: { nome: true } },
      },
      orderBy: { administradoEm: 'desc' },
    });
  }
}
