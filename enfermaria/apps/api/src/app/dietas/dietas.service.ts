import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DietasService {
  constructor(private readonly prisma: PrismaService) {}

  async prescrever(dto: {
    doenteId: string;
    tipo: string;
    restricoes?: string[];
    observacoes?: string;
    criadaPorId: string;
  }) {
    const doente = await this.prisma.doente.findUnique({ where: { id: dto.doenteId } });
    if (!doente) throw new NotFoundException(`Doente (ID ${dto.doenteId}) não encontrado`);

    return this.prisma.$transaction(async (tx) => {
      await tx.prescricaoDieta.updateMany({
        where: { doenteId: dto.doenteId, ativa: true },
        data: { ativa: false },
      });

      return tx.prescricaoDieta.create({
        data: {
          doenteId: dto.doenteId,
          tipo: dto.tipo,
          restricoes: dto.restricoes ?? [],
          observacoes: dto.observacoes,
          criadaPorId: dto.criadaPorId,
        },
        include: {
          criadaPor: { select: { id: true, nome: true, role: true } },
          doente: { select: { id: true, nome: true } },
        },
      });
    });
  }

  async dietaAtual(doenteId: string) {
    return this.prisma.prescricaoDieta.findFirst({
      where: { doenteId, ativa: true },
      include: { criadaPor: { select: { id: true, nome: true, role: true } } },
    });
  }

  async historico(doenteId: string) {
    return this.prisma.prescricaoDieta.findMany({
      where: { doenteId },
      orderBy: { criadaEm: 'desc' },
      include: { criadaPor: { select: { id: true, nome: true } } },
    });
  }

  async dietasHoje() {
    const doentesInternados = await this.prisma.doente.findMany({
      where: { ativo: true, estadoRegisto: 'internado' },
      select: { id: true, nome: true, cama: { select: { quarto: true, numero: true } } },
    });

    const doenteIds = doentesInternados.map((d) => d.id);
    const dietas = await this.prisma.prescricaoDieta.findMany({
      where: { doenteId: { in: doenteIds }, ativa: true },
      include: { doente: { select: { id: true, nome: true, cama: { select: { quarto: true, numero: true } } } } },
    });

    const doentesSemDieta = doentesInternados
      .filter((d) => !dietas.find((diet) => diet.doenteId === d.id))
      .map((d) => ({ doente: d, dieta: null }));

    return [
      ...dietas.map((d) => ({ doente: d.doente, dieta: d })),
      ...doentesSemDieta,
    ];
  }
}
