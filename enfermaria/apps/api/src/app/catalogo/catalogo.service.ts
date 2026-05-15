import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  listar(search?: string) {
    return this.prisma.catalogoMedicamento.findMany({
      where: {
        ativo: true,
        ...(search
          ? {
              OR: [
                { dci: { contains: search, mode: 'insensitive' } },
                { nomeMarca: { contains: search, mode: 'insensitive' } },
                { classeTerap: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { dci: 'asc' },
    });
  }

  criar(dto: {
    dci: string;
    nomeMarca?: string;
    formaFarmaceutica: string;
    classeTerap: string;
    unidade: string;
    concentracao?: string;
    codigoATC?: string;
  }) {
    return this.prisma.catalogoMedicamento.create({ data: dto });
  }

  async atualizar(id: string, dto: Partial<{
    dci: string;
    nomeMarca: string;
    formaFarmaceutica: string;
    classeTerap: string;
    unidade: string;
    concentracao: string;
    codigoATC: string;
  }>) {
    await this.findOrFail(id);
    return this.prisma.catalogoMedicamento.update({ where: { id }, data: dto });
  }

  async desativar(id: string) {
    await this.findOrFail(id);
    return this.prisma.catalogoMedicamento.update({ where: { id }, data: { ativo: false } });
  }

  private async findOrFail(id: string) {
    const item = await this.prisma.catalogoMedicamento.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Medicamento não encontrado no catálogo');
    return item;
  }
}
